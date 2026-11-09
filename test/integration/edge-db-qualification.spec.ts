import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import pg from 'pg';
import { runTestcontainers } from '../helpers/testcontainers-env.js';
import {
  applyControlPlaneMigrations,
  applyTenantMigrations,
  listControlPlaneMigrationFiles,
} from '../helpers/control-plane-migrate.js';

const EDGE_TABLES = [
  'edge_administrators',
  'edge_verticals',
  'edge_memberships',
  'edge_invitations',
  'edge_permissions',
  'edge_roles',
  'edge_role_permissions',
  'edge_role_assignments',
  'edge_workspace_sessions',
  'edge_delegations',
  'edge_emergency_access_grants',
  'edge_configuration_versions',
  'edge_external_identity_mappings',
  'edge_sync_records',
  'edge_audit_events',
] as const;

describe.skipIf(!runTestcontainers)('P0-H.1 Edge DB Qualification (Testcontainers)', () => {
  let cleanContainer: StartedPostgreSqlContainer;
  let cleanPool: pg.Pool;
  let upgradeContainer: StartedPostgreSqlContainer;
  let upgradePool: pg.Pool;
  let tenantContainer: StartedPostgreSqlContainer;
  let tenantPool: pg.Pool;
  let postgresVersion = 'unknown';

  beforeAll(async () => {
    cleanContainer = await new PostgreSqlContainer('postgres:16-alpine')
      .withDatabase('platform_control_clean')
      .withUsername('platform')
      .withPassword('platform')
      .start();
    cleanPool = new pg.Pool({
      host: cleanContainer.getHost(),
      port: cleanContainer.getPort(),
      database: cleanContainer.getDatabase(),
      user: cleanContainer.getUsername(),
      password: cleanContainer.getPassword(),
    });

    upgradeContainer = await new PostgreSqlContainer('postgres:16-alpine')
      .withDatabase('platform_control_upgrade')
      .withUsername('platform')
      .withPassword('platform')
      .start();
    upgradePool = new pg.Pool({
      host: upgradeContainer.getHost(),
      port: upgradeContainer.getPort(),
      database: upgradeContainer.getDatabase(),
      user: upgradeContainer.getUsername(),
      password: upgradeContainer.getPassword(),
    });

    tenantContainer = await new PostgreSqlContainer('postgres:16-alpine')
      .withDatabase('tenant_isolation')
      .withUsername('platform')
      .withPassword('platform')
      .start();
    tenantPool = new pg.Pool({
      host: tenantContainer.getHost(),
      port: tenantContainer.getPort(),
      database: tenantContainer.getDatabase(),
      user: tenantContainer.getUsername(),
      password: tenantContainer.getPassword(),
    });

    const v = await cleanPool.query<{ version: string }>('SELECT version()');
    postgresVersion = v.rows[0]?.version ?? 'unknown';
  }, 300_000);

  afterAll(async () => {
    await cleanPool?.end();
    await upgradePool?.end();
    await tenantPool?.end();
    await cleanContainer?.stop();
    await upgradeContainer?.stop();
    await tenantContainer?.stop();
  });

  describe('migration ordering', () => {
    it('lists 073 after 072 and includes edge foundation file', () => {
      const files = listControlPlaneMigrationFiles();
      const i072 = files.indexOf('072_drop_industry_permissions.sql');
      const i073 = files.indexOf('073_edge_foundation.sql');
      const i074 = files.indexOf('074_edge_product_catalog.sql');
      const i075 = files.indexOf('075_edge_commercial_foundation.sql');
      const i076 = files.indexOf('076_edge_commercial_governance_extensions.sql');
      const i077 = files.indexOf('077_edge_marketing_foundation.sql');
      const i078 = files.indexOf('078_edge_marketing_orchestration.sql');
      const i079 = files.indexOf('079_edge_marketing_ops_hardening.sql');
      const i080 = files.indexOf('080_edge_marketing_resend_indexes.sql');
      expect(i072).toBeGreaterThanOrEqual(0);
      expect(i073).toBeGreaterThan(i072);
      expect(i074).toBeGreaterThan(i073);
      expect(i075).toBeGreaterThan(i074);
      expect(i076).toBeGreaterThan(i075);
      expect(i077).toBeGreaterThan(i076);
      expect(i078).toBeGreaterThan(i077);
      expect(i079).toBeGreaterThan(i078);
      expect(i080).toBeGreaterThan(i079);
      expect(files[files.length - 1]).toBe(
        '080_edge_marketing_resend_indexes.sql',
      );
    });
  });

  describe('C — clean install', () => {
    let cleanResult: { applied: string[]; skipped: string[] };

    it('applies all control-plane migrations including 073', async () => {
      cleanResult = await applyControlPlaneMigrations(cleanPool);
      expect(cleanResult.applied).toContain('072_drop_industry_permissions');
      expect(cleanResult.applied).toContain('073_edge_foundation');
      expect(cleanResult.skipped).toEqual([]);
    }, 180_000);

    it('records 072 and 073 in schema_migrations', async () => {
      const rows = await cleanPool.query<{ version: string }>(
        `SELECT version FROM schema_migrations
         WHERE version IN ('072_drop_industry_permissions', '073_edge_foundation')
         ORDER BY version`,
      );
      expect(rows.rows.map((r) => r.version)).toEqual([
        '072_drop_industry_permissions',
        '073_edge_foundation',
      ]);
    });

    it('creates all Edge governance tables', async () => {
      const result = await cleanPool.query<{ tablename: string }>(
        `SELECT tablename FROM pg_tables
         WHERE schemaname = 'public' AND tablename LIKE 'edge_%'
         ORDER BY tablename`,
      );
      const names = result.rows.map((r) => r.tablename);
      for (const table of EDGE_TABLES) {
        expect(names).toContain(table);
      }
    });

    it('seeds Edge roles and permissions', async () => {
      const perms = await cleanPool.query(`SELECT COUNT(*)::int AS c FROM edge_permissions`);
      const roles = await cleanPool.query(`SELECT COUNT(*)::int AS c FROM edge_roles`);
      const links = await cleanPool.query(`SELECT COUNT(*)::int AS c FROM edge_role_permissions`);
      expect(perms.rows[0].c).toBeGreaterThanOrEqual(38);
      expect(roles.rows[0].c).toBe(10);
      expect(links.rows[0].c).toBeGreaterThan(0);

      const scopes = await cleanPool.query<{ scope: string; c: number }>(
        `SELECT scope, COUNT(*)::int AS c FROM edge_roles GROUP BY scope ORDER BY scope`,
      );
      const byScope = Object.fromEntries(scopes.rows.map((r) => [r.scope, r.c]));
      expect(byScope.GLOBAL).toBe(4);
      expect(byScope.VERTICAL).toBe(6);
    });

    it('is idempotent on second migrate run (skips applied versions)', async () => {
      const second = await applyControlPlaneMigrations(cleanPool);
      expect(second.applied).toEqual([]);
      expect(second.skipped).toContain('073_edge_foundation');
      expect(second.skipped).toContain('072_drop_industry_permissions');
    }, 120_000);

    it('exposes postgres version for evidence', () => {
      expect(postgresVersion.toLowerCase()).toContain('postgresql');
    });
  });

  describe('D — upgrade from 072', () => {
    let baselineTenantSlug: string;
    let baselineMigrationCount = 0;
    let baselineTableCount = 0;

    it('builds schema through 072 only and inserts representative fixtures', async () => {
      const to072 = await applyControlPlaneMigrations(upgradePool, {
        stopBeforeVersion: '073_edge_foundation',
      });
      expect(to072.applied).toContain('072_drop_industry_permissions');
      expect(to072.applied).not.toContain('073_edge_foundation');

      const edgeBefore = await upgradePool.query(
        `SELECT COUNT(*)::int AS c FROM pg_tables
         WHERE schemaname = 'public' AND tablename LIKE 'edge_%'`,
      );
      expect(edgeBefore.rows[0].c).toBe(0);

      const tenant = await upgradePool.query<{ id: string; slug: string }>(
        `INSERT INTO tenants (
           slug, status, database_host, database_port, database_name,
           database_credentials_ref, region, environment
         ) VALUES (
           'p0h1-upgrade-tenant', 'ACTIVE', 'localhost', 5432, 'tenant_p0h1',
           'SECRET_REF', 'eu-west-1', 'test'
         ) RETURNING id, slug`,
      );
      baselineTenantSlug = tenant.rows[0].slug;

      await upgradePool.query(
        `INSERT INTO organizations (
           tenant_id, keycloak_organization_id, name, slug, status
         ) VALUES ($1, 'kc-org-p0h1', 'Upgrade Org', 'upgrade-org', 'ACTIVE')`,
        [tenant.rows[0].id],
      );

      const mig = await upgradePool.query<{ c: number }>(
        `SELECT COUNT(*)::int AS c FROM schema_migrations`,
      );
      baselineMigrationCount = mig.rows[0].c;
      expect(baselineMigrationCount).toBeGreaterThan(50);

      const tables = await upgradePool.query<{ c: number }>(
        `SELECT COUNT(*)::int AS c FROM pg_tables WHERE schemaname = 'public'`,
      );
      baselineTableCount = tables.rows[0].c;
    }, 180_000);

    it('applies 073+ Edge migrations and preserves pre-existing data', async () => {
      const upgrade = await applyControlPlaneMigrations(upgradePool);
      // P0 foundation plus additive Edge migrations (P1 074, P2 075).
      expect(upgrade.applied[0]).toBe('073_edge_foundation');
      expect(upgrade.applied).toContain('073_edge_foundation');
      expect(upgrade.applied).toContain('075_edge_commercial_foundation');
      expect(upgrade.applied).toContain('076_edge_commercial_governance_extensions');
      expect(upgrade.applied).toContain('077_edge_marketing_foundation');
      expect(upgrade.applied).toContain('078_edge_marketing_orchestration');
      expect(upgrade.applied).toContain('079_edge_marketing_ops_hardening');
      expect(upgrade.applied).toContain('080_edge_marketing_resend_indexes');
      expect(upgrade.skipped).toContain('072_drop_industry_permissions');

      const tenant = await upgradePool.query(
        `SELECT slug, status FROM tenants WHERE slug = $1`,
        [baselineTenantSlug],
      );
      expect(tenant.rows).toHaveLength(1);
      expect(tenant.rows[0].status).toBe('ACTIVE');

      const org = await upgradePool.query(
        `SELECT slug FROM organizations WHERE slug = 'upgrade-org'`,
      );
      expect(org.rows).toHaveLength(1);

      const mig = await upgradePool.query<{ c: number }>(
        `SELECT COUNT(*)::int AS c FROM schema_migrations`,
      );
      expect(mig.rows[0].c).toBe(baselineMigrationCount + upgrade.applied.length);

      const tables = await upgradePool.query<{ c: number }>(
        `SELECT COUNT(*)::int AS c FROM pg_tables WHERE schemaname = 'public'`,
      );
      expect(tables.rows[0].c).toBeGreaterThan(baselineTableCount);

      for (const table of EDGE_TABLES) {
        const exists = await upgradePool.query(
          `SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = $1`,
          [table],
        );
        expect(exists.rowCount).toBe(1);
      }
    }, 120_000);
  });

  describe('E — integrity and negative tests', () => {
    it('rejects duplicate administrator external identity and email', async () => {
      await cleanPool.query(
        `INSERT INTO edge_administrators (external_identity_id, email, display_name, status)
         VALUES ('sub-1', 'a1@example.com', 'A1', 'ACTIVE')`,
      );
      await expect(
        cleanPool.query(
          `INSERT INTO edge_administrators (external_identity_id, email, display_name, status)
           VALUES ('sub-1', 'other@example.com', 'Dup', 'ACTIVE')`,
        ),
      ).rejects.toThrow(/unique|duplicate/i);
      await expect(
        cleanPool.query(
          `INSERT INTO edge_administrators (external_identity_id, email, display_name, status)
           VALUES ('sub-2', 'a1@example.com', 'DupEmail', 'ACTIVE')`,
        ),
      ).rejects.toThrow(/unique|duplicate/i);
    });

    it('rejects duplicate vertical membership pairs', async () => {
      const admin = await cleanPool.query<{ id: string }>(
        `INSERT INTO edge_administrators (external_identity_id, email, display_name, status)
         VALUES ('sub-mem', 'mem@example.com', 'Mem', 'ACTIVE') RETURNING id`,
      );
      const vertical = await cleanPool.query<{ id: string }>(
        `INSERT INTO edge_verticals (code, slug, display_name, status)
         VALUES ('REST', 'restaurant', 'Restaurant', 'ACTIVE') RETURNING id`,
      );
      await cleanPool.query(
        `INSERT INTO edge_memberships (administrator_id, vertical_id, status)
         VALUES ($1, $2, 'ACTIVE')`,
        [admin.rows[0].id, vertical.rows[0].id],
      );
      await expect(
        cleanPool.query(
          `INSERT INTO edge_memberships (administrator_id, vertical_id, status)
           VALUES ($1, $2, 'INVITED')`,
          [admin.rows[0].id, vertical.rows[0].id],
        ),
      ).rejects.toThrow(/unique|duplicate/i);
    });

    it('rejects FK to nonexistent vertical on membership', async () => {
      const admin = await cleanPool.query<{ id: string }>(
        `SELECT id FROM edge_administrators WHERE email = 'mem@example.com'`,
      );
      await expect(
        cleanPool.query(
          `INSERT INTO edge_memberships (administrator_id, vertical_id, status)
           VALUES ($1, '00000000-0000-4000-8000-000000000099', 'ACTIVE')`,
          [admin.rows[0].id],
        ),
      ).rejects.toThrow(/foreign key|violates/i);
    });

    it('rejects invalid lifecycle status values', async () => {
      await expect(
        cleanPool.query(
          `INSERT INTO edge_verticals (code, slug, display_name, status)
           VALUES ('BAD', 'bad', 'Bad', 'NOT_A_STATUS')`,
        ),
      ).rejects.toThrow(/check|violates/i);
    });

    it('rejects duplicate invitation token hashes', async () => {
      await cleanPool.query(
        `INSERT INTO edge_invitations (email, invited_by, token_hash, status, expires_at)
         VALUES (
           'invite@example.com',
           '00000000-0000-4000-8000-000000000001',
           'hash-abc',
           'PENDING',
           NOW() + INTERVAL '1 day'
         )`,
      );
      await expect(
        cleanPool.query(
          `INSERT INTO edge_invitations (email, invited_by, token_hash, status, expires_at)
           VALUES (
             'invite2@example.com',
             '00000000-0000-4000-8000-000000000001',
             'hash-abc',
             'PENDING',
             NOW() + INTERVAL '1 day'
           )`,
        ),
      ).rejects.toThrow(/unique|duplicate/i);
    });

    it('rejects duplicate active role assignments for same scope', async () => {
      const admin = await cleanPool.query<{ id: string }>(
        `SELECT id FROM edge_administrators WHERE email = 'mem@example.com'`,
      );
      const role = await cleanPool.query<{ id: string }>(
        `SELECT id FROM edge_roles WHERE code = 'EDGE_AUDIT_ADMIN'`,
      );
      await cleanPool.query(
        `INSERT INTO edge_role_assignments (administrator_id, role_id)
         VALUES ($1, $2)`,
        [admin.rows[0].id, role.rows[0].id],
      );
      await expect(
        cleanPool.query(
          `INSERT INTO edge_role_assignments (administrator_id, role_id)
           VALUES ($1, $2)`,
          [admin.rows[0].id, role.rows[0].id],
        ),
      ).rejects.toThrow(/unique|duplicate/i);
    });

    it('rolls back multi-step writes on failure (transaction integrity)', async () => {
      const before = await cleanPool.query<{ c: number }>(
        `SELECT COUNT(*)::int AS c FROM edge_verticals WHERE code = 'TXFAIL'`,
      );
      expect(before.rows[0].c).toBe(0);

      const client = await cleanPool.connect();
      try {
        await client.query('BEGIN');
        await client.query(
          `INSERT INTO edge_verticals (code, slug, display_name, status)
           VALUES ('TXFAIL', 'tx-fail', 'Tx Fail', 'DRAFT')`,
        );
        await expect(
          client.query(
            `INSERT INTO edge_verticals (code, slug, display_name, status)
             VALUES ('TXFAIL', 'tx-fail-2', 'Dup Code', 'DRAFT')`,
          ),
        ).rejects.toThrow(/unique|duplicate/i);
        await client.query('ROLLBACK');
      } finally {
        client.release();
      }

      const after = await cleanPool.query<{ c: number }>(
        `SELECT COUNT(*)::int AS c FROM edge_verticals WHERE code = 'TXFAIL'`,
      );
      expect(after.rows[0].c).toBe(0);
    });

    it('does not allow VERTICAL roles to receive platform:verticals:create via seed', async () => {
      const bad = await cleanPool.query(
        `SELECT r.code, p.code AS permission
         FROM edge_role_permissions rp
         INNER JOIN edge_roles r ON r.id = rp.role_id
         INNER JOIN edge_permissions p ON p.id = rp.permission_id
         WHERE r.scope = 'VERTICAL'
           AND p.code IN (
             'platform:verticals:create',
             'platform:administrators:deactivate',
             'platform:verticals:activate'
           )`,
      );
      expect(bad.rows).toEqual([]);
    });
  });

  describe('F — tenant database isolation', () => {
    it('tenant migrations do not create edge_* tables', async () => {
      await applyTenantMigrations(tenantPool);
      const edge = await tenantPool.query(
        `SELECT tablename FROM pg_tables
         WHERE schemaname = 'public' AND tablename LIKE 'edge_%'`,
      );
      expect(edge.rows).toEqual([]);

      const cpOnly = listControlPlaneMigrationFiles().some((f) => f.includes('edge_foundation'));
      expect(cpOnly).toBe(true);
    }, 180_000);
  });
});
