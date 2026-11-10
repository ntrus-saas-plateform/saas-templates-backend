import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import pg from 'pg';
import { runTestcontainers } from '../helpers/testcontainers-env.js';
import {
  applyControlPlaneMigrations,
  listControlPlaneMigrationFiles,
} from '../helpers/control-plane-migrate.js';

const SUBSCRIPTION_MIGRATIONS = [
  '087_edge_subscription_foundation',
  '088_edge_subscription_entitlements_changes',
  '089_edge_subscription_coordination_governance',
] as const;

const SUBSCRIPTION_TABLES = [
  'edge_subscriptions',
  'edge_subscription_items',
  'edge_subscription_periods',
  'edge_subscription_status_history',
  'edge_subscription_lifecycle_events',
  'edge_entitlement_snapshots',
  'edge_entitlement_publications',
  'edge_subscription_change_requests',
  'edge_subscription_scheduled_changes',
  'edge_subscription_renewals',
  'edge_subscription_trials',
  'edge_subscription_suspensions',
  'edge_subscription_cancellations',
  'edge_subscription_billing_coordination',
  'edge_subscription_provisioning_requests',
  'edge_subscription_policies',
  'edge_subscription_approvals',
  'edge_subscription_idempotency_keys',
] as const;

const SUBSCRIPTION_PERMISSION_PREFIX = 'platform:subscriptions:%';

describe.skipIf(!runTestcontainers)('P5 Edge Subscription DB (Testcontainers)', () => {
  let container: StartedPostgreSqlContainer;
  let pool: pg.Pool;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine')
      .withDatabase('platform_control_subscription')
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

  it('lists 087–089 after sales 086', () => {
    const files = listControlPlaneMigrationFiles();
    const i086 = files.indexOf('086_edge_sales_platform_completion.sql');
    expect(i086).toBeGreaterThanOrEqual(0);
    let prev = i086;
    for (const version of SUBSCRIPTION_MIGRATIONS) {
      const idx = files.indexOf(`${version}.sql`);
      expect(idx).toBeGreaterThan(prev);
      prev = idx;
    }
  });

  it('applies 087–089 and creates subscription platform tables', async () => {
    const result = await applyControlPlaneMigrations(pool);
    for (const version of SUBSCRIPTION_MIGRATIONS) {
      expect(result.applied.concat(result.skipped)).toContain(version);
    }

    for (const table of SUBSCRIPTION_TABLES) {
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
    for (const version of SUBSCRIPTION_MIGRATIONS) {
      expect(versions).toContain(version);
    }

    const perms = await pool.query(
      `SELECT code FROM edge_permissions WHERE code LIKE $1 ORDER BY code`,
      [SUBSCRIPTION_PERMISSION_PREFIX],
    );
    expect(perms.rowCount).toBeGreaterThanOrEqual(10);
    expect(perms.rows.some((r) => r.code === 'platform:subscriptions:read')).toBe(true);
    expect(perms.rows.some((r) => r.code === 'platform:subscriptions:manage_approvals')).toBe(
      true,
    );
  }, 300_000);

  it('is idempotent on second migrate run', async () => {
    const first = await applyControlPlaneMigrations(pool);
    const second = await applyControlPlaneMigrations(pool);
    for (const version of SUBSCRIPTION_MIGRATIONS) {
      expect(first.skipped.concat(first.applied)).toContain(version);
      expect(second.skipped).toContain(version);
      expect(second.applied).not.toContain(version);
    }
  }, 120_000);
});
