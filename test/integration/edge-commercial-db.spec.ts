import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import pg from 'pg';
import { runTestcontainers } from '../helpers/testcontainers-env.js';
import {
  applyControlPlaneMigrations,
  listControlPlaneMigrationFiles,
} from '../helpers/control-plane-migrate.js';

describe.skipIf(!runTestcontainers)('P2 Edge Commercial DB (Testcontainers)', () => {
  let container: StartedPostgreSqlContainer;
  let pool: pg.Pool;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine')
      .withDatabase('platform_control_commercial')
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

  it('lists 076 after 075', () => {
    const files = listControlPlaneMigrationFiles();
    const i074 = files.indexOf('074_edge_product_catalog.sql');
    const i075 = files.indexOf('075_edge_commercial_foundation.sql');
    const i076 = files.indexOf('076_edge_commercial_governance_extensions.sql');
    expect(i074).toBeGreaterThanOrEqual(0);
    expect(i075).toBeGreaterThan(i074);
    expect(i076).toBeGreaterThan(i075);
  });

  it('applies 075/076 and enforces commercial integrity', async () => {
    const result = await applyControlPlaneMigrations(pool);
    expect(result.applied).toContain('074_edge_product_catalog');
    expect(result.applied).toContain('075_edge_commercial_foundation');
    expect(result.applied).toContain('076_edge_commercial_governance_extensions');

    for (const table of [
      'edge_commercial_markets',
      'edge_commercial_plans',
      'edge_price_books',
      'edge_commercial_publication_snapshots',
      'edge_enterprise_offer_templates',
      'edge_usage_metric_definitions',
      'edge_eligibility_policies',
      'edge_buying_committee_models',
    ]) {
      const exists = await pool.query(
        `SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = $1`,
        [table],
      );
      expect(exists.rowCount).toBe(1);
    }

    const vertical = await pool.query<{ id: string }>(
      `INSERT INTO edge_verticals (code, slug, display_name, status)
       VALUES ('p2-retail', 'p2-retail', 'P2 Retail', 'DRAFT')
       RETURNING id`,
    );
    const product = await pool.query<{ id: string }>(
      `INSERT INTO edge_products (code, slug, name, vertical_id, lifecycle_status, commercial_availability)
       VALUES ('p2-prod', 'p2-prod', 'P2 Product', $1, 'PUBLISHED', 'AVAILABLE')
       RETURNING id`,
      [vertical.rows[0].id],
    );

    const plan = await pool.query<{ id: string }>(
      `INSERT INTO edge_commercial_plans (
         code, name, product_id, vertical_id, plan_tier, status
       ) VALUES ('p2-lite', 'P2 Lite', $1, $2, 'LITE', 'DRAFT')
       RETURNING id`,
      [product.rows[0].id, vertical.rows[0].id],
    );

    const book = await pool.query<{ id: string }>(
      `INSERT INTO edge_price_books (code, name, product_id, currency, status)
       VALUES ('p2-usd', 'P2 USD', $1, 'USD', 'DRAFT')
       RETURNING id`,
      [product.rows[0].id],
    );

    await pool.query(
      `INSERT INTO edge_price_book_entries (
         price_book_id, commercial_item_type, commercial_item_id, currency, amount
       ) VALUES ($1, 'PLAN', $2, 'USD', 49.990000)`,
      [book.rows[0].id, plan.rows[0].id],
    );

    await expect(
      pool.query(
        `INSERT INTO edge_price_book_entries (
           price_book_id, commercial_item_type, commercial_item_id, currency, amount
         ) VALUES ($1, 'PLAN', $2, 'USD', -1)`,
        [book.rows[0].id, plan.rows[0].id],
      ),
    ).rejects.toThrow();

    const perms = await pool.query<{ c: number }>(
      `SELECT COUNT(*)::int AS c FROM edge_permissions
       WHERE code LIKE 'platform:commercial:%' OR code LIKE 'platform:pricing:%'`,
    );
    expect(perms.rows[0].c).toBeGreaterThan(5);

    // No invented seed prices
    const seededPrices = await pool.query<{ c: number }>(
      `SELECT COUNT(*)::int AS c FROM edge_price_book_entries
       WHERE price_book_id <> $1`,
      [book.rows[0].id],
    );
    expect(seededPrices.rows[0].c).toBe(0);
  }, 180_000);
});
