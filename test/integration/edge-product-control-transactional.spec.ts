import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { runTestcontainers } from '../helpers/testcontainers-env.js';
import { applyControlPlaneMigrations } from '../helpers/control-plane-migrate.js';
import { DomainError, ErrorCode } from '../../src/core/domain/errors/domain-error.js';
import type { ControlPlaneTransactionManagerPort } from '../../src/core/domain/ports/control-plane-transaction-manager.port.js';
import type { ControlPlaneOutboxStorePort } from '../../src/core/domain/ports/control-plane-outbox.port.js';
import { ControlPlaneOutboxTransactionService } from '../../src/shared/messaging/control-plane-outbox-transaction.service.js';
import { PgControlPlaneOutboxStore } from '../../src/shared/messaging/pg-control-plane-outbox.store.js';
import { PgAuditEventRepository } from '../../src/modules/edge/infrastructure/persistence/pg-audit-event.repository.js';
import { PgProductControlRepository } from '../../src/modules/edge/infrastructure/product-control/pg-product-control.repository.js';
import { FakeCredentialProvider } from '../../src/modules/edge/infrastructure/product-control/credential-provider.adapter.js';
import { SignatureService } from '../../src/modules/edge/infrastructure/product-control/signature.service.js';
import {
  HandshakeProductControlEndpointUseCase,
  QuarantineProductControlEndpointUseCase,
  ReceiveProductControlCallbackUseCase,
  RegisterProductControlEndpointUseCase,
  ValidateProductControlEndpointUseCase,
} from '../../src/modules/edge/application/product-control/product-control.use-cases.js';
import { EDGE_P7_OUTBOX_TENANT } from '../../src/modules/edge/domain/provisioning/provisioning.events.js';
import { ProductControlEndpointStatus } from '../../src/modules/edge/domain/product-control/product-control.types.js';
import type { ProductControlClientPort } from '../../src/modules/edge/domain/product-control/product-control-client.port.js';

const ACTOR_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

describe.skipIf(!runTestcontainers)(
  'P7.5 product-control transactional atomicity (Testcontainers)',
  () => {
    let container: StartedPostgreSqlContainer;
    let pool: pg.Pool;
    let seq = 0;
    let fixture: {
      productId: string;
      registryId: string;
      platformId: string;
      environmentId: string;
    };

    const cpDb = { getPool: () => pool };

    function buildTxManager(): ControlPlaneTransactionManagerPort {
      return {
        async runInTransaction<T>(fn: (client: unknown) => Promise<T>): Promise<T> {
          const client = await pool.connect();
          try {
            await client.query('BEGIN');
            const result = await fn(client);
            await client.query('COMMIT');
            return result;
          } catch (error) {
            await client.query('ROLLBACK');
            throw error;
          } finally {
            client.release();
          }
        },
      };
    }

    function buildOutboxStore(): PgControlPlaneOutboxStore {
      return new PgControlPlaneOutboxStore({
        getControlPlanePool: () => pool,
      } as never);
    }

    function buildOutbox(
      tx = buildTxManager(),
      store: ControlPlaneOutboxStorePort = buildOutboxStore(),
    ) {
      return new ControlPlaneOutboxTransactionService(tx, store);
    }

    function buildRepo() {
      return new PgProductControlRepository(cpDb as never);
    }

    function buildAudit() {
      return new PgAuditEventRepository(cpDb as never);
    }

    async function counts() {
      const [endpoints, history, audit, outbox, exchanges, callbacks] = await Promise.all([
        pool.query<{ c: string }>(
          `SELECT COUNT(*)::text AS c FROM edge_p7_product_control_endpoints`,
        ),
        pool.query<{ c: string }>(
          `SELECT COUNT(*)::text AS c FROM edge_p7_product_control_history`,
        ),
        pool.query<{ c: string }>(`SELECT COUNT(*)::text AS c FROM edge_audit_events`),
        pool.query<{ c: string }>(
          `SELECT COUNT(*)::text AS c FROM control_plane_outbox_events WHERE tenant_id = $1`,
          [EDGE_P7_OUTBOX_TENANT],
        ),
        pool.query<{ c: string }>(
          `SELECT COUNT(*)::text AS c FROM edge_p7_product_control_exchanges`,
        ),
        pool.query<{ c: string }>(
          `SELECT COUNT(*)::text AS c FROM edge_p7_product_control_callbacks`,
        ),
      ]);
      return {
        endpoints: Number(endpoints.rows[0]?.c ?? 0),
        history: Number(history.rows[0]?.c ?? 0),
        audit: Number(audit.rows[0]?.c ?? 0),
        outbox: Number(outbox.rows[0]?.c ?? 0),
        exchanges: Number(exchanges.rows[0]?.c ?? 0),
        callbacks: Number(callbacks.rows[0]?.c ?? 0),
      };
    }

    async function seedFixture() {
      seq += 1;
      const ids = {
        vertical: randomUUID(),
        product: randomUUID(),
        registry: randomUUID(),
        platform: randomUUID(),
        environment: randomUUID(),
      };
      await pool.query(
        `INSERT INTO edge_verticals (id, code, slug, display_name, status)
         VALUES ($1, $2, $2, $3, 'DRAFT')`,
        [ids.vertical, `p75-v-${seq}`, `P75 Vertical ${seq}`],
      );
      await pool.query(
        `INSERT INTO edge_products (id, code, slug, name, vertical_id, lifecycle_status, commercial_availability)
         VALUES ($1, $2, $2, $3, $4, 'PUBLISHED', 'AVAILABLE')`,
        [ids.product, `p75-prod-${seq}`, `Product ${seq}`, ids.vertical],
      );
      await pool.query(
        `INSERT INTO edge_p7_product_registry (
           id, product_id, code, name, registry_status, certification_status, provisionable, created_by
         ) VALUES ($1,$2,$3,$4,'CERTIFIED','CERTIFIED',TRUE,'system')`,
        [ids.registry, ids.product, `REG-P75-${seq}`, `Registry ${seq}`],
      );
      await pool.query(
        `INSERT INTO edge_p7_product_platforms (
           id, code, name, platform_type, certification_status, operational_status, created_by
         ) VALUES ($1,$2,$3,'SHARED_SAAS_PLATFORM','CERTIFIED','ACTIVE','system')`,
        [ids.platform, `plat-p75-${seq}`, `Platform ${seq}`],
      );
      await pool.query(
        `INSERT INTO edge_p7_runtime_environments (
           id, platform_id, code, name, environment_type, environment_status, created_by
         ) VALUES ($1,$2,$3,$4,'PRODUCTION','ACTIVE','system')`,
        [ids.environment, ids.platform, `env-p75-${seq}`, `Env ${seq}`],
      );
      return {
        productId: ids.product,
        registryId: ids.registry,
        platformId: ids.platform,
        environmentId: ids.environment,
      };
    }

    beforeAll(async () => {
      container = await new PostgreSqlContainer('postgres:16-alpine')
        .withDatabase('platform_control_pci_tx')
        .withUsername('platform')
        .withPassword('platform')
        .start();
      pool = new pg.Pool({
        host: container.getHost(),
        port: container.getPort(),
        database: container.getDatabase(),
        user: container.getUsername(),
        password: container.getPassword(),
      });
      const result = await applyControlPlaneMigrations(pool);
      expect(result.applied).toContain('100_edge_p7_product_control_integration');
      await pool.query(`
        ALTER TABLE control_plane_outbox_events
          DROP CONSTRAINT IF EXISTS control_plane_outbox_events_tenant_id_fkey;
        ALTER TABLE control_plane_outbox_events
          ALTER COLUMN tenant_id TYPE TEXT USING tenant_id::text;
      `);
    }, 300_000);

    afterAll(async () => {
      await pool?.end();
      await container?.stop();
    });

    beforeEach(async () => {
      fixture = await seedFixture();
    });

    it('atomic register + history/audit/outbox', async () => {
      const before = await counts();
      const uc = new RegisterProductControlEndpointUseCase(
        buildRepo(),
        buildOutbox(),
        buildAudit(),
      );
      const endpoint = await uc.execute({
        actorId: ACTOR_ID,
        correlationId: randomUUID(),
        productRegistryId: fixture.registryId,
        productId: fixture.productId,
        platformId: fixture.platformId,
        environmentId: fixture.environmentId,
        code: `pc-${seq}`,
        baseUrl: `https://pc-${seq}.example.com/v1`,
        contractVersion: '1.0.0',
        authProfile: 'HMAC_SIGNED',
        credentialRef: `vault:pci-${seq}`,
      });
      expect(endpoint.status).toBe(ProductControlEndpointStatus.PENDING_VALIDATION);
      const after = await counts();
      expect(after.endpoints).toBe(before.endpoints + 1);
      expect(after.history).toBeGreaterThan(before.history);
      expect(after.audit).toBeGreaterThan(before.audit);
      expect(after.outbox).toBeGreaterThan(before.outbox);
    });

    it('rollback when audit fails', async () => {
      const before = await counts();
      const audit = {
        create: vi.fn(async () => {
          throw new Error('audit down');
        }),
      };
      const uc = new RegisterProductControlEndpointUseCase(
        buildRepo(),
        buildOutbox(),
        audit as never,
      );
      await expect(
        uc.execute({
          actorId: ACTOR_ID,
          correlationId: randomUUID(),
          productRegistryId: fixture.registryId,
          productId: fixture.productId,
          platformId: fixture.platformId,
          environmentId: fixture.environmentId,
          code: `pc-audit-fail-${seq}`,
          baseUrl: `https://pc-audit-${seq}.example.com/v1`,
          contractVersion: '1.0.0',
          authProfile: 'OAUTH2_CC',
          credentialRef: `vault:pci-audit-${seq}`,
        }),
      ).rejects.toBeInstanceOf(DomainError);
      const after = await counts();
      expect(after.endpoints).toBe(before.endpoints);
      expect(after.history).toBe(before.history);
      expect(after.outbox).toBe(before.outbox);
    });

    it('rollback when outbox fails', async () => {
      const before = await counts();
      const realStore = buildOutboxStore();
      const store: ControlPlaneOutboxStorePort = {
        enqueue: async () => {
          throw new Error('outbox down');
        },
        fetchPending: (t, l) => realStore.fetchPending(t, l),
        markPublished: (t, id) => realStore.markPublished(t, id),
        markFailed: (t, id, err) => realStore.markFailed(t, id, err),
        markDeadLetter: (t, id, err) => realStore.markDeadLetter(t, id, err),
      };
      const uc = new RegisterProductControlEndpointUseCase(
        buildRepo(),
        buildOutbox(buildTxManager(), store),
        buildAudit(),
      );
      await expect(
        uc.execute({
          actorId: ACTOR_ID,
          correlationId: randomUUID(),
          productRegistryId: fixture.registryId,
          productId: fixture.productId,
          platformId: fixture.platformId,
          environmentId: fixture.environmentId,
          code: `pc-outbox-fail-${seq}`,
          baseUrl: `https://pc-outbox-${seq}.example.com/v1`,
          contractVersion: '1.0.0',
          authProfile: 'OAUTH2_CC',
          credentialRef: `vault:pci-outbox-${seq}`,
        }),
      ).rejects.toThrow();
      const after = await counts();
      expect(after.endpoints).toBe(before.endpoints);
      expect(after.audit).toBe(before.audit);
    });

    it('idempotent exchange on handshake', async () => {
      const register = new RegisterProductControlEndpointUseCase(
        buildRepo(),
        buildOutbox(),
        buildAudit(),
      );
      const endpoint = await register.execute({
        actorId: ACTOR_ID,
        correlationId: randomUUID(),
        productRegistryId: fixture.registryId,
        productId: fixture.productId,
        platformId: fixture.platformId,
        environmentId: fixture.environmentId,
        code: `pc-idem-${seq}`,
        baseUrl: `https://pc-idem-${seq}.example.com/v1`,
        contractVersion: '1.0.0',
        authProfile: 'HMAC_SIGNED',
        credentialRef: `vault:pci-idem-${seq}`,
      });
      await new ValidateProductControlEndpointUseCase(
        buildRepo(),
        buildOutbox(),
        buildAudit(),
      ).execute({
        actorId: ACTOR_ID,
        correlationId: randomUUID(),
        endpointId: endpoint.id,
      });

      const client: ProductControlClientPort = {
        handshake: vi.fn(async () => ({
          httpStatus: 200,
          body: {
            productId: fixture.productId,
            productCode: 'X',
            productControlId: 'pc',
            productControlVersion: '1',
            supportedProtocolVersions: ['1'],
            supportedContractVersions: ['1.0.0'],
            supportedCapabilities: ['control.handshake'],
            supportedOperationTypes: ['handshake'],
            authenticationMethods: ['HMAC_SIGNED'],
            signatureAlgorithms: ['HS256'],
            callbackSupport: true,
            idempotencySupport: true,
            correlationSupport: true,
            healthStatus: 'HEALTHY',
            contractFingerprint: 'fp',
            issuedAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 60_000).toISOString(),
          },
          responseDigest: 'd',
          durationMs: 5,
          discovery: {
            productId: fixture.productId,
            productCode: 'X',
            productControlId: 'pc',
            productControlVersion: '1',
            supportedProtocolVersions: ['1'],
            supportedContractVersions: ['1.0.0'],
            supportedCapabilities: ['control.handshake'],
            supportedOperationTypes: ['handshake'],
            authenticationMethods: ['HMAC_SIGNED'],
            signatureAlgorithms: ['HS256'],
            callbackSupport: true,
            idempotencySupport: true,
            correlationSupport: true,
            healthStatus: 'HEALTHY',
            contractFingerprint: 'fp',
            issuedAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 60_000).toISOString(),
          },
        })),
        discoverContract: vi.fn(),
        discoverCapabilities: vi.fn(),
        verifyConnectivity: vi.fn(),
        verifyHealth: vi.fn(),
        verifyConformance: vi.fn(),
      };

      const handshake = new HandshakeProductControlEndpointUseCase(
        buildRepo(),
        client,
        buildOutbox(),
        buildAudit(),
      );
      const idem = `handshake-idem-${seq}`;
      const corr = randomUUID();
      const first = await handshake.execute({
        actorId: ACTOR_ID,
        correlationId: corr,
        endpointId: endpoint.id,
        idempotencyKey: idem,
      });
      const second = await handshake.execute({
        actorId: ACTOR_ID,
        correlationId: corr,
        endpointId: endpoint.id,
        idempotencyKey: idem,
      });
      expect(second.id).toBe(first.id);
      expect(client.handshake).toHaveBeenCalledTimes(1);
      const after = await counts();
      expect(after.exchanges).toBeGreaterThan(0);
    });

    it('quarantine blocks dispatch', async () => {
      const register = new RegisterProductControlEndpointUseCase(
        buildRepo(),
        buildOutbox(),
        buildAudit(),
      );
      const endpoint = await register.execute({
        actorId: ACTOR_ID,
        correlationId: randomUUID(),
        productRegistryId: fixture.registryId,
        productId: fixture.productId,
        platformId: fixture.platformId,
        environmentId: fixture.environmentId,
        code: `pc-q-${seq}`,
        baseUrl: `https://pc-q-${seq}.example.com/v1`,
        contractVersion: '1.0.0',
        authProfile: 'OAUTH2_CC',
        credentialRef: `vault:pci-q-${seq}`,
      });
      await new ValidateProductControlEndpointUseCase(
        buildRepo(),
        buildOutbox(),
        buildAudit(),
      ).execute({
        actorId: ACTOR_ID,
        correlationId: randomUUID(),
        endpointId: endpoint.id,
      });
      // Force ACTIVE then quarantine
      await pool.query(
        `UPDATE edge_p7_product_control_endpoints SET status = 'ACTIVE', version = version + 1 WHERE id = $1`,
        [endpoint.id],
      );
      await new QuarantineProductControlEndpointUseCase(
        buildRepo(),
        buildOutbox(),
        buildAudit(),
      ).execute({
        actorId: ACTOR_ID,
        correlationId: randomUUID(),
        endpointId: endpoint.id,
        reason: 'security incident',
      });

      const client: ProductControlClientPort = {
        handshake: vi.fn(),
        discoverContract: vi.fn(),
        discoverCapabilities: vi.fn(),
        verifyConnectivity: vi.fn(),
        verifyHealth: vi.fn(),
        verifyConformance: vi.fn(),
      };
      const handshake = new HandshakeProductControlEndpointUseCase(
        buildRepo(),
        client,
        buildOutbox(),
        buildAudit(),
      );
      await expect(
        handshake.execute({
          actorId: ACTOR_ID,
          correlationId: randomUUID(),
          endpointId: endpoint.id,
          idempotencyKey: `q-block-${seq}`,
        }),
      ).rejects.toSatisfy((err: unknown) => {
        expect(err).toBeInstanceOf(DomainError);
        expect((err as DomainError).code).toBe(ErrorCode.FORBIDDEN);
        return true;
      });
      expect(client.handshake).not.toHaveBeenCalled();
    });

    it('inbox callback dedup', async () => {
      const register = new RegisterProductControlEndpointUseCase(
        buildRepo(),
        buildOutbox(),
        buildAudit(),
      );
      const endpoint = await register.execute({
        actorId: ACTOR_ID,
        correlationId: randomUUID(),
        productRegistryId: fixture.registryId,
        productId: fixture.productId,
        platformId: fixture.platformId,
        environmentId: fixture.environmentId,
        code: `pc-cb-${seq}`,
        baseUrl: `https://pc-cb-${seq}.example.com/v1`,
        contractVersion: '1.0.0',
        authProfile: 'HMAC_SIGNED',
        credentialRef: `vault:pci-cb-${seq}`,
      });

      const creds = new FakeCredentialProvider();
      creds.seed(`vault:pci-cb-${seq}`, 'HMAC_SIGNED', { hmacSecret: 'cb-secret' });
      const sigs = new SignatureService(creds);
      const uc = new ReceiveProductControlCallbackUseCase(
        buildRepo(),
        sigs,
        buildOutbox(),
        buildAudit(),
      );
      const before = await counts();
      const payload = { ok: true };
      const first = await uc.execute({
        actorId: ACTOR_ID,
        correlationId: randomUUID(),
        endpointId: endpoint.id,
        callbackId: `cb-${seq}-1`,
        idempotencyKey: `cb-idem-${seq}`,
        payload,
      });
      const second = await uc.execute({
        actorId: ACTOR_ID,
        correlationId: randomUUID(),
        endpointId: endpoint.id,
        callbackId: `cb-${seq}-2`,
        idempotencyKey: `cb-idem-${seq}`,
        payload,
      });
      expect(first.duplicate).toBe(false);
      expect(second.duplicate).toBe(true);
      expect(second.id).toBe(first.id);
      const after = await counts();
      expect(after.callbacks).toBe(before.callbacks + 1);
    });
  },
);
