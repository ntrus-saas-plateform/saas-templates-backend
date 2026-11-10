import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { runTestcontainers } from '../helpers/testcontainers-env.js';
import { applyControlPlaneMigrations } from '../helpers/control-plane-migrate.js';
import type { ControlPlaneTransactionManagerPort } from '../../src/core/domain/ports/control-plane-transaction-manager.port.js';
import { ControlPlaneOutboxTransactionService } from '../../src/shared/messaging/control-plane-outbox-transaction.service.js';
import { PgControlPlaneOutboxStore } from '../../src/shared/messaging/pg-control-plane-outbox.store.js';
import { PgAuditEventRepository } from '../../src/modules/edge/infrastructure/persistence/pg-audit-event.repository.js';
import { PgInfrastructureRepository } from '../../src/modules/edge/infrastructure/infrastructure-provisioning/pg-infrastructure.repository.js';
import { EncryptedSecretsProvider } from '../../src/modules/edge/infrastructure/infrastructure-provisioning/secrets-provider.adapter.js';
import { DatabaseEngineAdapterRegistry } from '../../src/modules/edge/infrastructure/infrastructure-provisioning/database-engine.registry.js';
import { LocalInfrastructureProviderRegistry } from '../../src/modules/edge/infrastructure/infrastructure-provisioning/provider.registry.js';
import { LocalManagedInfrastructureProvider } from '../../src/modules/edge/infrastructure/infrastructure-provisioning/local-managed.provider.js';
import {
  CreateDatabaseCredentialsUseCase,
  CreateResourcePlanUseCase,
  ProvisionDatabaseUseCase,
  ProvisionNetworkUseCase,
  ValidateResourcePlanUseCase,
  VerifyDatabaseConnectivityUseCase,
  VerifyDatabaseIsolationUseCase,
} from '../../src/modules/edge/application/infrastructure-provisioning/infrastructure.use-cases.js';
import { DatabaseEngine } from '../../src/modules/edge/domain/infrastructure-provisioning/infrastructure.types.js';
import { EDGE_P7_OUTBOX_TENANT } from '../../src/modules/edge/domain/provisioning/provisioning.events.js';

const ACTOR = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

describe.skipIf(!runTestcontainers)(
  'P7.6 infrastructure/database transactional (Testcontainers)',
  () => {
    let container: StartedPostgreSqlContainer;
    let pool: pg.Pool;
    let providerId: string;
    let productId: string;
    let seq = 0;

    const cpDb = { getPool: () => pool };

    function buildTx(): ControlPlaneTransactionManagerPort {
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

    function buildOutbox() {
      return new ControlPlaneOutboxTransactionService(
        buildTx(),
        new PgControlPlaneOutboxStore({
          getControlPlanePool: () => pool,
        } as never),
      );
    }

    beforeAll(async () => {
      container = await new PostgreSqlContainer('postgres:16-alpine').start();
      pool = new pg.Pool({ connectionString: container.getConnectionUri() });
      const result = await applyControlPlaneMigrations(pool);
      expect(result.applied).toContain('101_edge_p7_infrastructure_database_provisioning');
      await pool.query(`
        ALTER TABLE control_plane_outbox_events
          DROP CONSTRAINT IF EXISTS control_plane_outbox_events_tenant_id_fkey;
        ALTER TABLE control_plane_outbox_events
          ALTER COLUMN tenant_id TYPE TEXT USING tenant_id::text;
      `);
    }, 180_000);

    afterAll(async () => {
      await pool?.end();
      await container?.stop();
    });

    beforeEach(async () => {
      seq += 1;
      const vertical = randomUUID();
      productId = randomUUID();
      await pool.query(
        `INSERT INTO edge_verticals (id, code, slug, display_name, status)
         VALUES ($1,$2,$2,$3,'DRAFT')`,
        [vertical, `p76-v-${seq}`, `P76 V ${seq}`],
      );
      await pool.query(
        `INSERT INTO edge_products (id, code, slug, name, vertical_id, lifecycle_status, commercial_availability)
         VALUES ($1,$2,$2,$3,$4,'PUBLISHED','AVAILABLE')`,
        [productId, `p76-p-${seq}`, `Product ${seq}`, vertical],
      );
      const prov = await pool.query<{ id: string }>(
        `SELECT id FROM edge_p7_infrastructure_providers WHERE code = 'local-managed-v1'`,
      );
      providerId = prov.rows[0]!.id;
    });

    it('creates plan atomically with history+audit+outbox', async () => {
      const repo = new PgInfrastructureRepository(cpDb as never);
      const outbox = buildOutbox();
      const audit = new PgAuditEventRepository(cpDb as never);
      const uc = new CreateResourcePlanUseCase(repo, outbox, audit);
      const plan = await uc.execute({
        actorId: ACTOR,
        correlationId: randomUUID(),
        tenantId: randomUUID(),
        productId,
        providerId,
        region: 'local',
        databaseEngine: DatabaseEngine.POSTGRESQL,
        authorizationId: randomUUID(),
        placementDecisionId: randomUUID(),
        reservationId: randomUUID(),
        encryptionPolicy: { tls: true },
        networkRequirements: { mode: 'PRIVATE' },
        backupPolicy: { enabled: true, schedule: 'daily' },
      });
      const hist = await pool.query(
        `SELECT COUNT(*)::int AS c FROM edge_p7_resource_history WHERE resource_id = $1`,
        [plan.id],
      );
      const auditC = await pool.query(
        `SELECT COUNT(*)::int AS c FROM edge_audit_events WHERE subject_id = $1`,
        [plan.id],
      );
      const outboxC = await pool.query(
        `SELECT COUNT(*)::int AS c FROM control_plane_outbox_events WHERE tenant_id = $1`,
        [EDGE_P7_OUTBOX_TENANT],
      );
      expect(hist.rows[0].c).toBeGreaterThan(0);
      expect(auditC.rows[0].c).toBeGreaterThan(0);
      expect(outboxC.rows[0].c).toBeGreaterThan(0);
    });

    it('rolls back plan when audit fails', async () => {
      const repo = new PgInfrastructureRepository(cpDb as never);
      const outbox = buildOutbox();
      const audit = {
        create: async () => {
          throw new Error('audit boom');
        },
      } as never;
      const uc = new CreateResourcePlanUseCase(repo, outbox, audit);
      const before = await pool.query(`SELECT COUNT(*)::int AS c FROM edge_p7_resource_plans`);
      await expect(
        uc.execute({
          actorId: ACTOR,
          correlationId: randomUUID(),
          tenantId: randomUUID(),
          productId,
          providerId,
          region: 'local',
          databaseEngine: DatabaseEngine.POSTGRESQL,
          authorizationId: randomUUID(),
          placementDecisionId: randomUUID(),
          reservationId: randomUUID(),
          encryptionPolicy: { tls: true },
          networkRequirements: { mode: 'PRIVATE' },
          backupPolicy: { enabled: true, schedule: 'daily' },
        }),
      ).rejects.toThrow();
      const after = await pool.query(`SELECT COUNT(*)::int AS c FROM edge_p7_resource_plans`);
      expect(after.rows[0].c).toBe(before.rows[0].c);
    });

    it('provisions real PostgreSQL tenant database with isolation', async () => {
      const adminUrl = container.getConnectionUri();
      const repo = new PgInfrastructureRepository(cpDb as never);
      const outbox = buildOutbox();
      const audit = new PgAuditEventRepository(cpDb as never);
      const secrets = new EncryptedSecretsProvider('test-key');
      const engines = new DatabaseEngineAdapterRegistry();
      const local = new LocalManagedInfrastructureProvider({ postgresql: adminUrl }, providerId);
      const providers = new LocalInfrastructureProviderRegistry(repo, local);
      providers.register(local);

      const createPlan = new CreateResourcePlanUseCase(repo, outbox, audit);
      const validate = new ValidateResourcePlanUseCase(repo, outbox, audit);
      const deps = { repo, providers, engines, secrets, outbox, audit };
      const provisionNetwork = new ProvisionNetworkUseCase(deps);
      const provisionDb = new ProvisionDatabaseUseCase(deps);
      const createCreds = new CreateDatabaseCredentialsUseCase(deps);
      const verifyConn = new VerifyDatabaseConnectivityUseCase(deps);
      const verifyIso = new VerifyDatabaseIsolationUseCase(deps);

      const plan = await createPlan.execute({
        actorId: ACTOR,
        correlationId: randomUUID(),
        tenantId: randomUUID(),
        productId,
        providerId,
        region: 'local',
        databaseEngine: DatabaseEngine.POSTGRESQL,
        authorizationId: randomUUID(),
        placementDecisionId: randomUUID(),
        reservationId: randomUUID(),
        encryptionPolicy: { tls: true },
        networkRequirements: { mode: 'PRIVATE' },
        backupPolicy: { enabled: true, schedule: 'daily' },
      });
      await validate.execute({
        planId: plan.id,
        actorId: ACTOR,
        correlationId: randomUUID(),
        context: {
          authorizationValid: true,
          authorizationExpired: false,
          authorizationRevoked: false,
          placementValid: true,
          reservationValid: true,
          reservationCommitted: true,
        },
      });
      await provisionNetwork.execute({
        planId: plan.id,
        actorId: ACTOR,
        correlationId: randomUUID(),
      });
      const { database } = await provisionDb.execute({
        planId: plan.id,
        actorId: ACTOR,
        correlationId: randomUUID(),
      });
      const withCreds = await createCreds.execute({
        databaseResourceId: database.id,
        actorId: ACTOR,
        correlationId: randomUUID(),
      });
      expect(withCreds.credentialRef).toMatch(/^sec_/);
      expect((withCreds as { password?: string }).password).toBeUndefined();

      const connected = await verifyConn.execute({
        databaseResourceId: database.id,
        actorId: ACTOR,
        correlationId: randomUUID(),
      });
      expect(connected.connectivityVerified).toBe(true);

      // Foreign tenant DB with PUBLIC revoked (same baseline as adapter).
      const foreign = `foreign_${seq}`;
      await pool.query(`CREATE DATABASE ${foreign}`);
      await pool.query(`REVOKE ALL ON DATABASE ${foreign} FROM PUBLIC`);
      const ready = await verifyIso.execute({
        databaseResourceId: database.id,
        actorId: ACTOR,
        correlationId: randomUUID(),
        foreignDatabaseName: foreign,
      });
      expect(ready.isolationVerified).toBe(true);
      expect(ready.status).toBe('READY');
    }, 120_000);
  },
);
