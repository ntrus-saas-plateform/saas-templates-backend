import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import pg from 'pg';
import { runTestcontainers } from '../helpers/testcontainers-env.js';
import {
  applyControlPlaneMigrations,
  listControlPlaneMigrationFiles,
} from '../helpers/control-plane-migrate.js';

const SALES_MIGRATIONS = [
  '081_edge_sales_crm_foundation',
  '082_edge_sales_opportunity_pipeline',
  '083_edge_sales_activities_needs',
  '084_edge_sales_quotes_deal_desk',
  '085_edge_sales_contracts_orders_handoff',
  '086_edge_sales_platform_completion',
] as const;

const SALES_TABLES = [
  'edge_sales_commercial_accounts',
  'edge_sales_contacts',
  'edge_sales_leads',
  'edge_sales_opportunities',
  'edge_sales_pipeline_stages',
  'edge_sales_activities',
  'edge_sales_discovery_questionnaires',
  'edge_sales_quotes',
  'edge_sales_contracts',
  'edge_sales_orders',
  'edge_sales_order_lines',
  'edge_sales_handoffs',
  'edge_sales_forecast_snapshots',
  'edge_sales_saved_views',
  'edge_sales_export_jobs',
  'edge_sales_idempotency_keys',
  'edge_sales_visibility_grants',
  'edge_sales_calendar_sync_events',
] as const;

describe.skipIf(!runTestcontainers)('P4 Edge Sales DB (Testcontainers)', () => {
  let container: StartedPostgreSqlContainer;
  let pool: pg.Pool;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine')
      .withDatabase('platform_control_sales')
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

  it('lists 081–086 after marketing 080', () => {
    const files = listControlPlaneMigrationFiles();
    const i080 = files.indexOf('080_edge_marketing_resend_indexes.sql');
    expect(i080).toBeGreaterThanOrEqual(0);
    let prev = i080;
    for (const version of SALES_MIGRATIONS) {
      const idx = files.indexOf(`${version}.sql`);
      expect(idx).toBeGreaterThan(prev);
      prev = idx;
    }
  });

  it('applies 081–086 and creates sales platform tables', async () => {
    const result = await applyControlPlaneMigrations(pool);
    for (const version of SALES_MIGRATIONS) {
      expect(result.applied).toContain(version);
    }

    for (const table of SALES_TABLES) {
      const exists = await pool.query(
        `SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = $1`,
        [table],
      );
      expect(exists.rowCount, table).toBe(1);
    }

    const registry = await pool.query(
      `SELECT version FROM schema_migrations WHERE version LIKE '08%' ORDER BY version`,
    );
    const versions = registry.rows.map((r) => r.version as string);
    for (const version of SALES_MIGRATIONS) {
      expect(versions).toContain(version);
    }
  }, 300_000);

  it('is idempotent on second migrate run', async () => {
    const first = await applyControlPlaneMigrations(pool);
    const second = await applyControlPlaneMigrations(pool);
    for (const version of SALES_MIGRATIONS) {
      expect(first.skipped.concat(first.applied)).toContain(version);
      expect(second.skipped).toContain(version);
      expect(second.applied).not.toContain(version);
    }
  }, 120_000);
});
