import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import pg from 'pg';
import { runTestcontainers } from '../helpers/testcontainers-env.js';
import { applyControlPlaneMigrations } from '../helpers/control-plane-migrate.js';
import { DomainError, ErrorCode } from '../../src/core/domain/errors/domain-error.js';
import type { ControlPlaneTransactionManagerPort } from '../../src/core/domain/ports/control-plane-transaction-manager.port.js';
import type { ControlPlaneOutboxStorePort } from '../../src/core/domain/ports/control-plane-outbox.port.js';
import { ControlPlaneOutboxTransactionService } from '../../src/shared/messaging/control-plane-outbox-transaction.service.js';
import { PgControlPlaneOutboxStore } from '../../src/shared/messaging/pg-control-plane-outbox.store.js';
import { PgAuditEventRepository } from '../../src/modules/edge/infrastructure/persistence/pg-audit-event.repository.js';
import { PgRegistryRepository } from '../../src/modules/edge/infrastructure/registry/pg-registry.repository.js';
import {
  RegisterProductUseCase,
  UpdateProductRegistryUseCase,
} from '../../src/modules/edge/application/registry/registry.use-cases.js';
import type { AuditEventRepositoryPort } from '../../src/modules/edge/domain/ports/audit-event-repository.port.js';
import type { RegistryRepositoryPort } from '../../src/modules/edge/domain/registry/registry-repository.port.js';
import { EDGE_P7_OUTBOX_TENANT } from '../../src/modules/edge/domain/provisioning/provisioning.events.js';

const ACTOR_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

describe.skipIf(!runTestcontainers)('P7.2 registry transactional atomicity (Testcontainers)', () => {
  let container: StartedPostgreSqlContainer;
  let pool: pg.Pool;
  let productId: string;
  let seq = 0;

  const cpDb = {
    getPool: () => pool,
  };

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

  function buildRepo(): PgRegistryRepository {
    return new PgRegistryRepository(cpDb as never);
  }

  function buildAudit(): PgAuditEventRepository {
    return new PgAuditEventRepository(cpDb as never);
  }

  async function counts() {
    const [registry, history, audit, outbox] = await Promise.all([
      pool.query<{ c: string }>(`SELECT COUNT(*)::text AS c FROM edge_p7_product_registry`),
      pool.query<{ c: string }>(`SELECT COUNT(*)::text AS c FROM edge_p7_registry_history`),
      pool.query<{ c: string }>(`SELECT COUNT(*)::text AS c FROM edge_audit_events`),
      pool.query<{ c: string }>(
        `SELECT COUNT(*)::text AS c FROM control_plane_outbox_events WHERE tenant_id = $1`,
        [EDGE_P7_OUTBOX_TENANT],
      ),
    ]);
    return {
      registry: Number(registry.rows[0]?.c ?? 0),
      history: Number(history.rows[0]?.c ?? 0),
      audit: Number(audit.rows[0]?.c ?? 0),
      outbox: Number(outbox.rows[0]?.c ?? 0),
    };
  }

  async function seedProduct(): Promise<string> {
    seq += 1;
    const code = `p72-prod-${seq}`;
    const vertical = await pool.query<{ id: string }>(
      `INSERT INTO edge_verticals (code, slug, display_name, status)
       VALUES ($1, $1, $2, 'DRAFT')
       RETURNING id`,
      [`p72-v-${seq}`, `P72 Vertical ${seq}`],
    );
    const product = await pool.query<{ id: string }>(
      `INSERT INTO edge_products (code, slug, name, vertical_id, lifecycle_status, commercial_availability)
       VALUES ($1, $1, $2, $3, 'PUBLISHED', 'AVAILABLE')
       RETURNING id`,
      [code, `Product ${seq}`, vertical.rows[0].id],
    );
    return product.rows[0].id;
  }

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine')
      .withDatabase('platform_control_registry_tx')
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
    expect(result.applied).toContain('096_edge_p7_product_platform_runtime_registry');
    // Edge control-plane outbox tenants are logical strings (edge-control-plane),
    // while migration 021 typed tenant_id as UUID FK. Loosen for TX proof only.
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
    productId = await seedProduct();
  });

  it('happy path: registry + history + audit + outbox land in one TX', async () => {
    const before = await counts();
    const products = { findById: vi.fn(async () => ({ id: productId })) };
    const uc = new RegisterProductUseCase(
      buildRepo(),
      products as never,
      buildOutbox(),
      buildAudit(),
    );

    const record = await uc.execute({
      actorId: ACTOR_ID,
      productId,
      code: `REG-${seq}`,
      name: `Registry ${seq}`,
    });

    const after = await counts();
    expect(record.id).toBeTruthy();
    expect(after.registry).toBe(before.registry + 1);
    expect(after.history).toBe(before.history + 1);
    expect(after.audit).toBe(before.audit + 1);
    expect(after.outbox).toBe(before.outbox + 1);

    const outboxRow = await pool.query(
      `SELECT event_type FROM control_plane_outbox_events
       WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [EDGE_P7_OUTBOX_TENANT],
    );
    expect(outboxRow.rows[0]?.event_type).toContain('registry.product.registered');
  }, 60_000);

  it('rolls back all four writes when audit fails inside TX', async () => {
    const before = await counts();
    const realAudit = buildAudit();
    const failingAudit: AuditEventRepositoryPort = {
      create: async (params, client) => {
        await realAudit.create(params, client);
        throw new Error('forced audit failure after insert');
      },
      list: (p) => realAudit.list(p),
    };
    const products = { findById: vi.fn(async () => ({ id: productId })) };
    const uc = new RegisterProductUseCase(
      buildRepo(),
      products as never,
      buildOutbox(),
      failingAudit,
    );

    await expect(
      uc.execute({
        actorId: ACTOR_ID,
        productId,
        code: `REG-AUDIT-FAIL-${seq}`,
        name: `Audit fail ${seq}`,
      }),
    ).rejects.toMatchObject({ code: ErrorCode.DEPENDENCY_UNAVAILABLE });

    expect(await counts()).toEqual(before);
  }, 60_000);

  it('rolls back all four writes when outbox enqueue fails inside TX', async () => {
    const before = await counts();
    const realStore = buildOutboxStore();
    const failingStore: ControlPlaneOutboxStorePort = {
      enqueue: async () => {
        throw new Error('forced outbox insert failure');
      },
      fetchPending: (t, l) => realStore.fetchPending(t, l),
      markPublished: (t, id) => realStore.markPublished(t, id),
      markFailed: (t, id, err) => realStore.markFailed(t, id, err),
      markDeadLetter: (t, id, err) => realStore.markDeadLetter(t, id, err),
    };
    const products = { findById: vi.fn(async () => ({ id: productId })) };
    const uc = new RegisterProductUseCase(
      buildRepo(),
      products as never,
      buildOutbox(buildTxManager(), failingStore),
      buildAudit(),
    );

    await expect(
      uc.execute({
        actorId: ACTOR_ID,
        productId,
        code: `REG-OUTBOX-FAIL-${seq}`,
        name: `Outbox fail ${seq}`,
      }),
    ).rejects.toThrow(/forced outbox insert failure/);

    expect(await counts()).toEqual(before);
  }, 60_000);

  it('rolls back all four writes when history insert fails inside TX', async () => {
    const before = await counts();
    const realRepo = buildRepo();
    const sabotaged: RegistryRepositoryPort = new Proxy(realRepo, {
      get(target, prop, receiver) {
        if (prop === 'appendHistory') {
          return async () => {
            throw new Error('forced history insert failure');
          };
        }
        const value = Reflect.get(target, prop, receiver);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    const products = { findById: vi.fn(async () => ({ id: productId })) };
    const uc = new RegisterProductUseCase(
      sabotaged,
      products as never,
      buildOutbox(),
      buildAudit(),
    );

    await expect(
      uc.execute({
        actorId: ACTOR_ID,
        productId,
        code: `REG-HIST-FAIL-${seq}`,
        name: `History fail ${seq}`,
      }),
    ).rejects.toThrow(/forced history insert failure/);

    expect(await counts()).toEqual(before);
  }, 60_000);

  it('rolls back update mutation on expectedVersion conflict', async () => {
    const products = { findById: vi.fn(async () => ({ id: productId })) };
    const register = new RegisterProductUseCase(
      buildRepo(),
      products as never,
      buildOutbox(),
      buildAudit(),
    );
    const created = await register.execute({
      actorId: ACTOR_ID,
      productId,
      code: `REG-VER-${seq}`,
      name: `Version ${seq}`,
    });
    const before = await counts();

    const update = new UpdateProductRegistryUseCase(buildRepo(), buildOutbox(), buildAudit());
    await expect(
      update.execute({
        actorId: ACTOR_ID,
        id: created.id,
        expectedVersion: created.version + 99,
        patch: { name: 'should-not-persist' },
      }),
    ).rejects.toBeInstanceOf(DomainError);

    const after = await counts();
    expect(after).toEqual(before);
    const row = await pool.query<{ name: string; version: number }>(
      `SELECT name, version FROM edge_p7_product_registry WHERE id = $1`,
      [created.id],
    );
    expect(row.rows[0]?.name).toBe(`Version ${seq}`);
    expect(row.rows[0]?.version).toBe(created.version);
  }, 60_000);
});
