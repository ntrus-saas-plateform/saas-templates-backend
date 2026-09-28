import pg from 'pg';
import { setupTestDatabase, type TestDatabaseEnvironment } from './test-database.js';
import { TENANT_A_ID } from './test-constants.js';

/**
 * JWT `sub` / membership user for smoke — must be UUID because
 * `business_config_audit.actor_id` is UUID (unlike control-plane VARCHAR user_id).
 */
export const SMOKE_OWNER_USER_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

/** Five vertical orgs under tenant A (OPS-P5 smoke). */
export const VERTICAL_ORGS = [
  {
    id: 'a1111111-1111-4111-8111-111111111101',
    slug: 'org-pharmacy',
    name: 'Pharmacy Org',
    profile: 'PHARMACY',
    kc: 'kc-org-pharmacy',
  },
  {
    id: 'a1111111-1111-4111-8111-111111111102',
    slug: 'org-supermarket',
    name: 'Supermarket Org',
    profile: 'SUPERMARKET',
    kc: 'kc-org-supermarket',
  },
  {
    id: 'a1111111-1111-4111-8111-111111111103',
    slug: 'org-restaurant',
    name: 'Restaurant Org',
    profile: 'RESTAURANT',
    kc: 'kc-org-restaurant',
  },
  {
    id: 'a1111111-1111-4111-8111-111111111104',
    slug: 'org-boutique',
    name: 'Boutique Org',
    profile: 'BOUTIQUE',
    kc: 'kc-org-boutique',
  },
  {
    id: 'a1111111-1111-4111-8111-111111111105',
    slug: 'org-wholesale',
    name: 'Wholesale Org',
    profile: 'WHOLESALE',
    kc: 'kc-org-wholesale',
  },
] as const;

export type MultiVerticalDatabaseEnvironment = TestDatabaseEnvironment & {
  readonly verticalOrgs: typeof VERTICAL_ORGS;
};

/**
 * Postgres testcontainers DB + 5 vertical orgs, tenant-owner memberships, ENTERPRISE plan.
 * Business configs are assigned via HTTP in the e2e (assign-profile).
 */
export async function setupMultiVerticalTestDatabase(): Promise<MultiVerticalDatabaseEnvironment> {
  const base = await setupTestDatabase();
  const admin = new pg.Pool({
    host: base.host,
    port: base.port,
    database: base.controlPlaneDatabase,
    user: base.user,
    password: base.password,
  });

  try {
    await admin.query(
      `UPDATE tenants SET plan_id = (SELECT id FROM plans WHERE code = 'ENTERPRISE') WHERE id = $1`,
      [TENANT_A_ID],
    );

    await admin.query(
      `INSERT INTO user_tenant_memberships (user_id, tenant_id, status)
       VALUES ($1, $2, 'ACTIVE') ON CONFLICT (user_id, tenant_id) DO NOTHING`,
      [SMOKE_OWNER_USER_ID, TENANT_A_ID],
    );

    for (const org of VERTICAL_ORGS) {
      await admin.query(
        `INSERT INTO organizations (id, tenant_id, keycloak_organization_id, name, slug, status)
         VALUES ($1, $2, $3, $4, $5, 'ACTIVE')
         ON CONFLICT (tenant_id, slug) DO UPDATE SET
           id = EXCLUDED.id,
           keycloak_organization_id = EXCLUDED.keycloak_organization_id,
           name = EXCLUDED.name,
           status = 'ACTIVE'`,
        [org.id, TENANT_A_ID, org.kc, org.name, org.slug],
      );

      await admin.query(
        `INSERT INTO user_organization_memberships
           (user_id, organization_id, tenant_id, status, roles, permissions)
         VALUES ($1, $2, $3, 'ACTIVE', '["tenant-owner"]'::jsonb, '[]'::jsonb)
         ON CONFLICT (user_id, organization_id) DO UPDATE SET
           status = 'ACTIVE',
           roles = '["tenant-owner"]'::jsonb`,
        [SMOKE_OWNER_USER_ID, org.id, TENANT_A_ID],
      );
    }
  } finally {
    await admin.end();
  }

  return { ...base, verticalOrgs: VERTICAL_ORGS };
}
