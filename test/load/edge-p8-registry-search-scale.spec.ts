import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { runTestcontainers } from '../helpers/testcontainers-env.js';
import { applyControlPlaneMigrations } from '../helpers/control-plane-migrate.js';
import { PgTenantManagementRepository } from '../../src/modules/edge/infrastructure/tenant-management/pg-tenant-management.repository.js';
import { ListTenantsUseCase } from '../../src/modules/edge/application/tenant-management/tenant-management.use-cases.js';

describe.skipIf(!runTestcontainers)('P8 registry search scale smoke (Testcontainers)', () => {
  let container: StartedPostgreSqlContainer;
  let pool: pg.Pool;
  let productId: string;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine')
      .withDatabase('platform_control_p8_scale')
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
    await applyControlPlaneMigrations(pool);

    const vertical = await pool.query<{ id: string }>(
      `INSERT INTO edge_verticals (code, slug, display_name, status)
       VALUES ('p8-scale-v', 'p8-scale-v', 'Scale Vertical', 'DRAFT')
       RETURNING id`,
    );
    const product = await pool.query<{ id: string }>(
      `INSERT INTO edge_products (code, slug, name, vertical_id, lifecycle_status, commercial_availability)
       VALUES ('p8-scale-prod', 'p8-scale-prod', 'Scale Product', $1, 'PUBLISHED', 'AVAILABLE')
       RETURNING id`,
      [vertical.rows[0].id],
    );
    productId = product.rows[0].id;

    const batchSize = 250;
    for (let batch = 0; batch < 40; batch += 1) {
      const values: string[] = [];
      const params: unknown[] = [];
      for (let i = 0; i < batchSize; i += 1) {
        const n = batch * batchSize + i;
        const code = `p8-scale-${n}`;
        const productTenantId = randomUUID();
        const base = params.length;
        params.push(
          productTenantId,
          code,
          code,
          `Scale Tenant ${n}`,
          productId,
          'scale-seed',
        );
        values.push(
          `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, 'STANDARD', 'ACTIVE', 'UNKNOWN', 'COMPLIANT', 'UNKNOWN', 'UNKNOWN', false, true, $${base + 6}, NOW())`,
        );
      }
      await pool.query(
        `INSERT INTO edge_p8_tenants (
           product_tenant_id, tenant_code, tenant_slug, display_name, product_id,
           classification, administrative_status, technical_status, governance_status,
           health_status, risk_level, legal_hold, deletion_protection, created_by, last_admin_activity_at
         ) VALUES ${values.join(',')}`,
        params,
      );
    }

    const count = await pool.query<{ c: number }>(
      `SELECT COUNT(*)::int AS c FROM edge_p8_tenants WHERE tenant_code LIKE 'p8-scale-%'`,
    );
    expect(count.rows[0]?.c).toBe(10_000);
  }, 600_000);

  afterAll(async () => {
    await pool?.end();
    await container?.stop();
  });

  it('search with q filter + limit 50 completes under 3000ms at 10k rows', async () => {
    const repo = new PgTenantManagementRepository({ getPool: () => pool } as never);
    const uc = new ListTenantsUseCase(repo);
    const started = performance.now();
    const result = await uc.execute({ q: 'p8-scale-999', limit: 50, offset: 0 });
    const elapsedMs = performance.now() - started;
    expect(result.items.length).toBeLessThanOrEqual(50);
    expect(elapsedMs, `measured search duration ${elapsedMs.toFixed(1)}ms`).toBeLessThan(3000);
  }, 60_000);
});