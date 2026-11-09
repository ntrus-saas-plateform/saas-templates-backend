import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import pg from 'pg';
import { runTestcontainers } from '../helpers/testcontainers-env.js';
import {
  applyControlPlaneMigrations,
  listControlPlaneMigrationFiles,
} from '../helpers/control-plane-migrate.js';

describe.skipIf(!runTestcontainers)('P1 Edge Product Catalog DB (Testcontainers)', () => {
  let container: StartedPostgreSqlContainer;
  let pool: pg.Pool;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine')
      .withDatabase('platform_control_catalog')
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
  }, 300_000);

  afterAll(async () => {
    await pool?.end();
    await container?.stop();
  });

  it('lists 074 after 073', () => {
    const files = listControlPlaneMigrationFiles();
    const i073 = files.indexOf('073_edge_foundation.sql');
    const i074 = files.indexOf('074_edge_product_catalog.sql');
    expect(i073).toBeGreaterThanOrEqual(0);
    expect(i074).toBeGreaterThan(i073);
  });

  it('applies 074 after 073 and creates edge_products', async () => {
    const result = await applyControlPlaneMigrations(pool);
    expect(result.applied).toContain('073_edge_foundation');
    expect(result.applied).toContain('074_edge_product_catalog');

    const tables = await pool.query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables
       WHERE schemaname = 'public' AND tablename = 'edge_products'`,
    );
    expect(tables.rows).toHaveLength(1);

    const vertical = await pool.query<{ id: string }>(
      `INSERT INTO edge_verticals (code, slug, display_name, status)
       VALUES ('cat-retail', 'cat-retail', 'Catalog Retail', 'DRAFT')
       RETURNING id`,
    );

    await pool.query(
      `INSERT INTO edge_products (code, slug, name, vertical_id, lifecycle_status, commercial_availability)
       VALUES ('prod-a', 'prod-a', 'Product A', $1, 'DRAFT', 'UNAVAILABLE')`,
      [vertical.rows[0].id],
    );

    await expect(
      pool.query(
        `INSERT INTO edge_products (code, slug, name, vertical_id, lifecycle_status, commercial_availability)
         VALUES ('prod-a', 'prod-a-dup', 'Dup', $1, 'DRAFT', 'UNAVAILABLE')`,
        [vertical.rows[0].id],
      ),
    ).rejects.toThrow();

    const check = await pool.query<{ conname: string }>(
      `SELECT conname FROM pg_constraint
       WHERE conrelid = 'edge_verticals'::regclass AND conname = 'edge_verticals_status_check'`,
    );
    expect(check.rows).toHaveLength(1);

    await pool.query(
      `UPDATE edge_verticals SET status = 'DEPRECATED' WHERE id = $1`,
      [vertical.rows[0].id],
    );
  }, 180_000);
});
