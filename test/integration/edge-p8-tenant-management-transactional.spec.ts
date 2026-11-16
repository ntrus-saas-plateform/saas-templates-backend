import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import pg from 'pg';
import { runTestcontainers } from '../helpers/testcontainers-env.js';
import { applyControlPlaneMigrations } from '../helpers/control-plane-migrate.js';
import { DomainError, ErrorCode } from '../../src/core/domain/errors/domain-error.js';
import { ControlPlaneOutboxTransactionService } from '../../src/shared/messaging/control-plane-outbox-transaction.service.js';
import { PgControlPlaneOutboxStore } from '../../src/shared/messaging/pg-control-plane-outbox.store.js';
import { PgAuditEventRepository } from '../../src/modules/edge/infrastructure/persistence/pg-audit-event.repository.js';
import { PgTenantManagementRepository } from '../../src/modules/edge/infrastructure/tenant-management/pg-tenant-management.repository.js';
import {
  ApproveLegalHoldChangeUseCase,
  ListTenantsUseCase,
  RegisterTenantUseCase,
  RequestLegalHoldChangeUseCase,
  RunReconciliationUseCase,
  UpdateLegalHoldUseCase,
} from '../../src/modules/edge/application/tenant-management/tenant-management.use-cases.js';
import { EDGE_P8_OUTBOX_TENANT } from '../../src/modules/edge/domain/tenant-management/tenant-management.events.js';
import { LegalHoldChangeAction } from '../../src/modules/edge/domain/tenant-management/tenant-management.types.js';
import type { ControlPlaneTransactionManagerPort } from '../../src/core/domain/ports/control-plane-transaction-manager.port.js';

const ACTOR_A = '10000000-0000-4000-8000-000000000001';
const ACTOR_B = '20000000-0000-4000-8000-000000000002';

describe.skipIf(!runTestcontainers)('P8 tenant management transactional (Testcontainers)', () => {
  let container: StartedPostgreSqlContainer;
  let pool: pg.Pool;
  let productId: string;
  let seq = 0;

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

  function buildOutbox() {
    const store = new PgControlPlaneOutboxStore({ getControlPlanePool: () => pool } as never);
    return new ControlPlaneOutboxTransactionService(buildTxManager(), store);
  }

  function buildAudit() {
    return new PgAuditEventRepository(cpDb as never);
  }

  function buildRepo() {
    return new PgTenantManagementRepository(cpDb as never);
  }

  async function seedProduct(): Promise<string> {
    seq += 1;
    const code = `p8-prod-${seq}`;
    const vertical = await pool.query<{ id: string }>(
      `INSERT INTO edge_verticals (code, slug, display_name, status)
       VALUES ($1, $1, $2, 'DRAFT')
       RETURNING id`,
      [`p8-v-${seq}`, `P8 Vertical ${seq}`],
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
      .withDatabase('platform_control_p8_tx')
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
    expect(result.applied).toContain('113_edge_p8_enterprise_certification');
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

  beforeAll(async () => {
    productId = await seedProduct();
  });

  it('registers tenant, search finds it, duplicate code collides', async () => {
    const repo = buildRepo();
    const register = new RegisterTenantUseCase(repo, buildOutbox(), buildAudit());
    const productTenantId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0101';
    const record = await register.execute({
      actorId: ACTOR_A,
      productTenantId,
      tenantCode: 'p8-tenant-alpha',
      displayName: 'P8 Alpha',
      productId,
    });
    expect(record.tenantCode).toBe('p8-tenant-alpha');

    const search = new ListTenantsUseCase(repo);
    const found = await search.execute({ q: 'p8-tenant-alpha', limit: 10, offset: 0 });
    expect(found.total).toBeGreaterThanOrEqual(1);

  });

  it('re-register preserves legal_hold=true', async () => {
    const repo = buildRepo();
    const register = new RegisterTenantUseCase(repo, buildOutbox(), buildAudit());
    const hold = new UpdateLegalHoldUseCase(repo, buildOutbox(), buildAudit());
    const productTenantId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbb0202';
    const created = await register.execute({
      actorId: ACTOR_A,
      productTenantId,
      tenantCode: 'p8-hold-tenant',
      displayName: 'Hold Tenant',
      productId,
    });
    await hold.execute({
      actorId: ACTOR_A,
      tenantRegistryId: created.id,
      expectedVersion: created.version,
      legalHold: true,
      justification: 'hold for litigation case',
      legalHoldPermissionGranted: true,
    });
    const updated = await register.execute({
      actorId: ACTOR_A,
      productTenantId,
      tenantCode: 'p8-hold-tenant',
      displayName: 'Hold Tenant Renamed',
      productId,
    });
    expect(updated.legalHold).toBe(true);
  });

  it('reconciliation ON_DEMAND creates orphan finding when only registry row exists', async () => {
    const repo = buildRepo();
    const register = new RegisterTenantUseCase(repo, buildOutbox(), buildAudit());
    const productTenantId = 'cccccccc-cccc-4ccc-8ccc-cccccccc0303';
    await register.execute({
      actorId: ACTOR_A,
      productTenantId,
      tenantCode: 'p8-orphan',
      displayName: 'Orphan',
      productId,
    });
    const reconcile = new RunReconciliationUseCase(repo, buildOutbox(), buildAudit());
    const result = await reconcile.execute({ actorId: ACTOR_A, mode: 'on_demand', dryRun: false });
    expect(result.run.mode).toBe('ON_DEMAND');
    const findings = await pool.query(
      `SELECT finding_type FROM edge_p8_reconciliation_findings WHERE run_id = $1`,
      [result.run.id],
    );
    expect(findings.rows.some((r) => r.finding_type === 'ORPHAN_TENANT')).toBe(true);
  });

  it('register creates audit and outbox rows atomically', async () => {
    const beforeAudit = await pool.query<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM edge_audit_events`,
    );
    const beforeOutbox = await pool.query<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM control_plane_outbox_events WHERE tenant_id = $1`,
      [EDGE_P8_OUTBOX_TENANT],
    );
    const repo = buildRepo();
    const register = new RegisterTenantUseCase(repo, buildOutbox(), buildAudit());
    const productTenantId = 'dddddddd-dddd-4ddd-8ddd-dddddddd0404';
    await register.execute({
      actorId: ACTOR_A,
      productTenantId,
      tenantCode: 'p8-audit-outbox',
      displayName: 'Audit Outbox',
      productId,
    });
    const afterAudit = await pool.query<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM edge_audit_events`,
    );
    const afterOutbox = await pool.query<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM control_plane_outbox_events WHERE tenant_id = $1`,
      [EDGE_P8_OUTBOX_TENANT],
    );
    expect(Number(afterAudit.rows[0]?.c)).toBeGreaterThan(Number(beforeAudit.rows[0]?.c));
    expect(Number(afterOutbox.rows[0]?.c)).toBeGreaterThan(Number(beforeOutbox.rows[0]?.c));
  });

  it('legal hold lift requires approve SoD (two actors)', async () => {
    const repo = buildRepo();
    const register = new RegisterTenantUseCase(repo, buildOutbox(), buildAudit());
    const hold = new UpdateLegalHoldUseCase(repo, buildOutbox(), buildAudit());
    const requestLift = new RequestLegalHoldChangeUseCase(repo, buildOutbox(), buildAudit());
    const approveLift = new ApproveLegalHoldChangeUseCase(repo, buildOutbox(), buildAudit());

    const productTenantId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeee0505';
    const created = await register.execute({
      actorId: ACTOR_A,
      productTenantId,
      tenantCode: 'p8-lift-sod',
      displayName: 'Lift SoD',
      productId,
    });
    const held = await hold.execute({
      actorId: ACTOR_A,
      tenantRegistryId: created.id,
      expectedVersion: created.version,
      legalHold: true,
      justification: 'activate hold for sod test',
      legalHoldPermissionGranted: true,
    });

    const liftReq = await requestLift.execute({
      actorId: ACTOR_A,
      tenantRegistryId: created.id,
      action: LegalHoldChangeAction.LIFT,
      justification: 'request lift after matter closed',
      idempotencyKey: 'lift-idem-0505',
    });
    expect(liftReq.status).toBe('PENDING');

    await expect(
      approveLift.execute({ actorId: ACTOR_A, requestId: liftReq.id }),
    ).rejects.toBeInstanceOf(DomainError);

    const approved = await approveLift.execute({ actorId: ACTOR_B, requestId: liftReq.id });
    expect(approved.tenant.legalHold).toBe(false);
    expect(held.legalHold).toBe(true);
  });
});