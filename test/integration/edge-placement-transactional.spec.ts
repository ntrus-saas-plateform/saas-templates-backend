import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
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
import { PgPlacementRepository } from '../../src/modules/edge/infrastructure/placement/pg-placement.repository.js';
import { PgRegistryRepository } from '../../src/modules/edge/infrastructure/registry/pg-registry.repository.js';
import {
  ExpireReservationUseCase,
  ReleaseReservationUseCase,
  UpsertCapacityInventoryUseCase,
} from '../../src/modules/edge/application/placement/placement.use-cases.js';
import type { AuditEventRepositoryPort } from '../../src/modules/edge/domain/ports/audit-event-repository.port.js';
import type { PlacementRepositoryPort } from '../../src/modules/edge/domain/placement/placement-repository.port.js';
import { EDGE_P7_OUTBOX_TENANT } from '../../src/modules/edge/domain/provisioning/provisioning.events.js';
import { CapacityReservationStatus } from '../../src/modules/edge/domain/placement/placement.types.js';

const ACTOR_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

describe.skipIf(!runTestcontainers)('P7.3 placement transactional atomicity (Testcontainers)', () => {
  let container: StartedPostgreSqlContainer;
  let pool: pg.Pool;
  let seq = 0;
  let platformId: string;
  let environmentId: string;
  let placementRequestId: string;

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

  function buildRepo(): PgPlacementRepository {
    return new PgPlacementRepository(cpDb as never);
  }

  function buildRegistry(): PgRegistryRepository {
    return new PgRegistryRepository(cpDb as never);
  }

  function buildAudit(): PgAuditEventRepository {
    return new PgAuditEventRepository(cpDb as never);
  }

  async function counts() {
    const [inventory, history, audit, outbox, reservations] = await Promise.all([
      pool.query<{ c: string }>(`SELECT COUNT(*)::text AS c FROM edge_p7_capacity_inventory`),
      pool.query<{ c: string }>(`SELECT COUNT(*)::text AS c FROM edge_p7_placement_history`),
      pool.query<{ c: string }>(`SELECT COUNT(*)::text AS c FROM edge_audit_events`),
      pool.query<{ c: string }>(
        `SELECT COUNT(*)::text AS c FROM control_plane_outbox_events WHERE tenant_id = $1`,
        [EDGE_P7_OUTBOX_TENANT],
      ),
      pool.query<{ c: string }>(`SELECT COUNT(*)::text AS c FROM edge_p7_capacity_reservations`),
    ]);
    return {
      inventory: Number(inventory.rows[0]?.c ?? 0),
      history: Number(history.rows[0]?.c ?? 0),
      audit: Number(audit.rows[0]?.c ?? 0),
      outbox: Number(outbox.rows[0]?.c ?? 0),
      reservations: Number(reservations.rows[0]?.c ?? 0),
    };
  }

  async function seedFixture() {
    seq += 1;
    const ids = {
      vertical: randomUUID(),
      product: randomUUID(),
      registry: randomUUID(),
      version: randomUUID(),
      platform: randomUUID(),
      environment: randomUUID(),
      contract: randomUUID(),
      auth: randomUUID(),
      authId: randomUUID(),
      provReq: randomUUID(),
      placementReq: randomUUID(),
      account: randomUUID(),
      subscription: randomUUID(),
    };

    await pool.query(
      `INSERT INTO edge_verticals (id, code, slug, display_name, status)
       VALUES ($1, $2, $2, $3, 'DRAFT')`,
      [ids.vertical, `p73-v-${seq}`, `P73 Vertical ${seq}`],
    );
    await pool.query(
      `INSERT INTO edge_products (id, code, slug, name, vertical_id, lifecycle_status, commercial_availability)
       VALUES ($1, $2, $2, $3, $4, 'PUBLISHED', 'AVAILABLE')`,
      [ids.product, `p73-prod-${seq}`, `Product ${seq}`, ids.vertical],
    );
    await pool.query(
      `INSERT INTO edge_p7_product_registry (
         id, product_id, code, name, registry_status, certification_status, provisionable, created_by
       ) VALUES ($1,$2,$3,$4,'CERTIFIED','CERTIFIED',TRUE,'system')`,
      [ids.registry, ids.product, `REG-${seq}`, `Registry ${seq}`],
    );
    await pool.query(
      `INSERT INTO edge_p7_product_technical_versions (
         id, product_registry_id, technical_version, version_status, created_by
       ) VALUES ($1,$2,$3,'PUBLISHED','system')`,
      [ids.version, ids.registry, `1.0.${seq}`],
    );
    await pool.query(
      `INSERT INTO edge_p7_product_platforms (
         id, code, name, platform_type, certification_status, operational_status, created_by
       ) VALUES ($1,$2,$3,'SHARED_SAAS_PLATFORM','CERTIFIED','ACTIVE','system')`,
      [ids.platform, `plat-${seq}`, `Platform ${seq}`],
    );
    await pool.query(
      `INSERT INTO edge_p7_runtime_environments (
         id, platform_id, code, name, environment_type, environment_status, created_by
       ) VALUES ($1,$2,$3,$4,'PRODUCTION','ACTIVE','system')`,
      [ids.environment, ids.platform, `env-${seq}`, `Env ${seq}`],
    );
    const profile = await pool.query<{ id: string }>(
      `SELECT id FROM edge_p7_deployment_profiles WHERE code = 'SHARED_SAAS' LIMIT 1`,
    );
    await pool.query(
      `INSERT INTO edge_p7_product_control_contracts (
         id, product_id, platform_id, contract_code, contract_version, schema_version,
         connectivity_model, contract_status, created_by
       ) VALUES ($1,$2,$3,$4,$5,'v1','EDGE_TO_SHARED_BACKEND','PUBLISHED','system')`,
      [ids.contract, ids.product, ids.platform, `CC-${seq}`, `1.0.${seq}`],
    );
    await pool.query(
      `INSERT INTO edge_provisioning_authorizations (
         id, authorization_id, authorization_version, authorization_type, operation,
         account_id, subscription_id, product_id, correlation_id, idempotency_key,
         decision, authorization_status, decision_timestamp, issued_at,
         entitlement_snapshot_reference, entitlement_version, issuer, audience, key_id,
         signature_algorithm, payload_digest, signature_present, issued_by_service_identity,
         revocation_status, environment_slot, verification_status, verified_at, payload_snapshot
       ) VALUES (
         $1,$2,1,'PROVISION','PROVISION',$3,$4,$5,$6,$7,
         'ALLOW','ACTIVE',NOW(),NOW(),
         'ent-ref','1','p5','okapi.edge.p7','kid-1',
         'EdDSA','digest',TRUE,'p5-svc',
         'NOT_REVOKED','PROD','VERIFIED',NOW(),'{}'::jsonb
       )`,
      [
        ids.auth,
        ids.authId,
        ids.account,
        ids.subscription,
        ids.product,
        randomUUID(),
        `auth-idem-${seq}`,
      ],
    );
    await pool.query(
      `INSERT INTO edge_p7_provisioning_requests (
         id, request_number, authorization_id, authorization_version, authorization_row_id,
         operation, account_id, product_id, subscription_id, correlation_id,
         request_status, environment_slot, idempotency_key, accepted_at
       ) VALUES (
         $1,$2,$3,1,$4,'PROVISION',$5,$6,$7,$8,'ACCEPTED','PROD',$9,NOW()
       )`,
      [
        ids.provReq,
        `PR-${seq}`,
        ids.authId,
        ids.auth,
        ids.account,
        ids.product,
        ids.subscription,
        randomUUID(),
        `prov-idem-${seq}`,
      ],
    );
    await pool.query(
      `INSERT INTO edge_p7_placement_requests (
         id, idempotency_key, correlation_id, provisioning_request_id, authorization_row_id,
         authorization_id, authorization_version, account_id, subscription_id, product_id,
         product_registry_id, technical_version_id, contract_id, deployment_profile_id,
         requested_environment_type, requested_deployment_model, capacity_requirements,
         request_status, created_by
       ) VALUES (
         $1,$2,$3,$4,$5,$6,1,$7,$8,$9,$10,$11,$12,$13,
         'PRODUCTION','SHARED_SAAS','{"TENANT_SLOT":1}'::jsonb,'PENDING','system'
       )`,
      [
        ids.placementReq,
        `place-idem-${seq}`,
        randomUUID(),
        ids.provReq,
        ids.auth,
        ids.authId,
        ids.account,
        ids.subscription,
        ids.product,
        ids.registry,
        ids.version,
        ids.contract,
        profile.rows[0]!.id,
      ],
    );

    platformId = ids.platform;
    environmentId = ids.environment;
    placementRequestId = ids.placementReq;
  }

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine')
      .withDatabase('platform_control_placement_tx')
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
    expect(result.applied).toContain('098_edge_p7_placement_capacity_management');
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
    await seedFixture();
  });

  it('happy path: inventory upsert + history + audit + outbox in one TX', async () => {
    const before = await counts();
    const uc = new UpsertCapacityInventoryUseCase(
      buildRepo(),
      buildRegistry(),
      buildOutbox(),
      buildAudit(),
    );
    const record = await uc.execute({
      actorId: ACTOR_ID,
      platformId,
      environmentId,
      resourceType: 'TENANT_SLOT',
      unit: 'slot',
      totalCapacity: 5,
      validUntil: new Date(Date.now() + 86_400_000),
    });
    const after = await counts();
    expect(record.id).toBeTruthy();
    expect(after.inventory).toBe(before.inventory + 1);
    expect(after.history).toBe(before.history + 1);
    expect(after.audit).toBe(before.audit + 1);
    expect(after.outbox).toBe(before.outbox + 1);
  }, 60_000);

  it('rolls back when audit fails inside TX', async () => {
    const before = await counts();
    const realAudit = buildAudit();
    const failingAudit: AuditEventRepositoryPort = {
      create: async (params, client) => {
        await realAudit.create(params, client);
        throw new Error('forced audit failure after insert');
      },
      list: (p) => realAudit.list(p),
    };
    const uc = new UpsertCapacityInventoryUseCase(
      buildRepo(),
      buildRegistry(),
      buildOutbox(),
      failingAudit,
    );
    await expect(
      uc.execute({
        actorId: ACTOR_ID,
        platformId,
        environmentId,
        resourceType: 'CPU',
        unit: 'core',
        totalCapacity: 2,
        validUntil: new Date(Date.now() + 86_400_000),
      }),
    ).rejects.toMatchObject({ code: ErrorCode.DEPENDENCY_UNAVAILABLE });
    expect(await counts()).toEqual(before);
  }, 60_000);

  it('rolls back when outbox enqueue fails inside TX', async () => {
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
    const uc = new UpsertCapacityInventoryUseCase(
      buildRepo(),
      buildRegistry(),
      buildOutbox(buildTxManager(), failingStore),
      buildAudit(),
    );
    await expect(
      uc.execute({
        actorId: ACTOR_ID,
        platformId,
        environmentId,
        resourceType: 'MEMORY',
        unit: 'GiB',
        totalCapacity: 8,
        validUntil: new Date(Date.now() + 86_400_000),
      }),
    ).rejects.toThrow(/forced outbox insert failure/);
    expect(await counts()).toEqual(before);
  }, 60_000);

  it('rolls back when history insert fails inside TX', async () => {
    const before = await counts();
    const realRepo = buildRepo();
    const sabotaged: PlacementRepositoryPort = new Proxy(realRepo, {
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
    const uc = new UpsertCapacityInventoryUseCase(
      sabotaged,
      buildRegistry(),
      buildOutbox(),
      buildAudit(),
    );
    await expect(
      uc.execute({
        actorId: ACTOR_ID,
        platformId,
        environmentId,
        resourceType: 'STORAGE',
        unit: 'GiB',
        totalCapacity: 100,
        validUntil: new Date(Date.now() + 86_400_000),
      }),
    ).rejects.toThrow(/forced history insert failure/);
    expect(await counts()).toEqual(before);
  }, 60_000);

  it('happy path place+reserve via reserveCapacityWithLock', async () => {
    const repo = buildRepo();
    await repo.createInventory({
      platformId,
      environmentId,
      resourceType: 'TENANT_SLOT',
      unit: 'slot',
      totalCapacity: 1,
      unavailableCapacity: 0,
      reservedCapacity: 0,
      allocatedCapacity: 0,
      measurementSource: 'DECLARED',
      measuredAt: new Date(),
      validUntil: new Date(Date.now() + 86_400_000),
      capacityStatus: 'ACTIVE',
      metadata: {},
      createdBy: ACTOR_ID,
      updatedBy: ACTOR_ID,
    });

    const reservation = await buildTxManager().runInTransaction(async (client) =>
      repo.reserveCapacityWithLock(
        {
          placementRequestId,
          placementDecisionId: null,
          platformId,
          environmentId,
          resourceQuantities: { TENANT_SLOT: 1 },
          idempotencyKey: `res-${seq}-happy`,
          expiresAt: new Date(Date.now() + 3_600_000),
          createdBy: ACTOR_ID,
        },
        client,
      ),
    );
    expect(reservation.reservationStatus).toBe(CapacityReservationStatus.HELD);
    const inv = await pool.query<{ reserved_capacity: string; available_capacity: string }>(
      `SELECT reserved_capacity::text, available_capacity::text
       FROM edge_p7_capacity_inventory
       WHERE environment_id = $1 AND resource_type = 'TENANT_SLOT'`,
      [environmentId],
    );
    expect(Number(inv.rows[0]?.reserved_capacity)).toBe(1);
    expect(Number(inv.rows[0]?.available_capacity)).toBe(0);
  }, 60_000);

  it('prevents concurrent overbook — exactly one of two last-slot reserves succeeds', async () => {
    const repo = buildRepo();
    await repo.createInventory({
      platformId,
      environmentId,
      resourceType: 'TENANT_SLOT',
      unit: 'slot',
      totalCapacity: 1,
      unavailableCapacity: 0,
      reservedCapacity: 0,
      allocatedCapacity: 0,
      measurementSource: 'DECLARED',
      measuredAt: new Date(),
      validUntil: new Date(Date.now() + 86_400_000),
      capacityStatus: 'ACTIVE',
      metadata: {},
      createdBy: ACTOR_ID,
      updatedBy: ACTOR_ID,
    });

    const attempt = async (key: string) => {
      try {
        const reservation = await buildTxManager().runInTransaction(async (client) =>
          repo.reserveCapacityWithLock(
            {
              placementRequestId,
              placementDecisionId: null,
              platformId,
              environmentId,
              resourceQuantities: { TENANT_SLOT: 1 },
              idempotencyKey: key,
              expiresAt: new Date(Date.now() + 3_600_000),
              createdBy: ACTOR_ID,
            },
            client,
          ),
        );
        return { ok: true as const, reservation };
      } catch (err) {
        return { ok: false as const, err };
      }
    };

    const [a, b] = await Promise.all([
      attempt(`race-a-${seq}`),
      attempt(`race-b-${seq}`),
    ]);
    const successes = [a, b].filter((r) => r.ok);
    const failures = [a, b].filter((r) => !r.ok);
    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);
    expect(failures[0]?.err).toBeInstanceOf(DomainError);
    expect((failures[0]?.err as DomainError).code).toBe(ErrorCode.CONFLICT);

    const reserved = await pool.query<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM edge_p7_capacity_reservations
       WHERE environment_id = $1 AND reservation_status = 'HELD'`,
      [environmentId],
    );
    expect(Number(reserved.rows[0]?.c)).toBe(1);
  }, 60_000);

  it('idempotent reservation returns existing HELD row', async () => {
    const repo = buildRepo();
    await repo.createInventory({
      platformId,
      environmentId,
      resourceType: 'TENANT_SLOT',
      unit: 'slot',
      totalCapacity: 3,
      unavailableCapacity: 0,
      reservedCapacity: 0,
      allocatedCapacity: 0,
      measurementSource: 'DECLARED',
      measuredAt: new Date(),
      validUntil: new Date(Date.now() + 86_400_000),
      capacityStatus: 'ACTIVE',
      metadata: {},
      createdBy: ACTOR_ID,
      updatedBy: ACTOR_ID,
    });
    const key = `idem-res-${seq}`;
    const first = await buildTxManager().runInTransaction(async (client) =>
      repo.reserveCapacityWithLock(
        {
          placementRequestId,
          placementDecisionId: null,
          platformId,
          environmentId,
          resourceQuantities: { TENANT_SLOT: 1 },
          idempotencyKey: key,
          expiresAt: new Date(Date.now() + 3_600_000),
          createdBy: ACTOR_ID,
        },
        client,
      ),
    );
    const second = await buildTxManager().runInTransaction(async (client) =>
      repo.reserveCapacityWithLock(
        {
          placementRequestId,
          placementDecisionId: null,
          platformId,
          environmentId,
          resourceQuantities: { TENANT_SLOT: 1 },
          idempotencyKey: key,
          expiresAt: new Date(Date.now() + 3_600_000),
          createdBy: ACTOR_ID,
        },
        client,
      ),
    );
    expect(second.id).toBe(first.id);
    const inv = await pool.query<{ reserved_capacity: string }>(
      `SELECT reserved_capacity::text FROM edge_p7_capacity_inventory
       WHERE environment_id = $1 AND resource_type = 'TENANT_SLOT'`,
      [environmentId],
    );
    expect(Number(inv.rows[0]?.reserved_capacity)).toBe(1);
  }, 60_000);

  it('expire + release free capacity', async () => {
    const repo = buildRepo();
    await repo.createInventory({
      platformId,
      environmentId,
      resourceType: 'TENANT_SLOT',
      unit: 'slot',
      totalCapacity: 2,
      unavailableCapacity: 0,
      reservedCapacity: 0,
      allocatedCapacity: 0,
      measurementSource: 'DECLARED',
      measuredAt: new Date(),
      validUntil: new Date(Date.now() + 86_400_000),
      capacityStatus: 'ACTIVE',
      metadata: {},
      createdBy: ACTOR_ID,
      updatedBy: ACTOR_ID,
    });
    const held = await buildTxManager().runInTransaction(async (client) =>
      repo.reserveCapacityWithLock(
        {
          placementRequestId,
          placementDecisionId: null,
          platformId,
          environmentId,
          resourceQuantities: { TENANT_SLOT: 1 },
          idempotencyKey: `expire-${seq}`,
          expiresAt: new Date(Date.now() + 3_600_000),
          createdBy: ACTOR_ID,
        },
        client,
      ),
    );
    const expireUc = new ExpireReservationUseCase(repo, buildOutbox(), buildAudit());
    const expired = await expireUc.execute({
      actorId: ACTOR_ID,
      reservationId: held.id,
      expectedVersion: held.version,
    });
    expect(expired.reservationStatus).toBe(CapacityReservationStatus.EXPIRED);

    const held2 = await buildTxManager().runInTransaction(async (client) =>
      repo.reserveCapacityWithLock(
        {
          placementRequestId,
          placementDecisionId: null,
          platformId,
          environmentId,
          resourceQuantities: { TENANT_SLOT: 1 },
          idempotencyKey: `release-${seq}`,
          expiresAt: new Date(Date.now() + 3_600_000),
          createdBy: ACTOR_ID,
        },
        client,
      ),
    );
    const releaseUc = new ReleaseReservationUseCase(repo, buildOutbox(), buildAudit());
    const released = await releaseUc.execute({
      actorId: ACTOR_ID,
      reservationId: held2.id,
      expectedVersion: held2.version,
      reason: 'test-release',
    });
    expect(released.reservationStatus).toBe(CapacityReservationStatus.RELEASED);

    const inv = await pool.query<{ reserved_capacity: string; available_capacity: string }>(
      `SELECT reserved_capacity::text, available_capacity::text
       FROM edge_p7_capacity_inventory
       WHERE environment_id = $1 AND resource_type = 'TENANT_SLOT'`,
      [environmentId],
    );
    expect(Number(inv.rows[0]?.reserved_capacity)).toBe(0);
    expect(Number(inv.rows[0]?.available_capacity)).toBe(2);
  }, 60_000);
});
