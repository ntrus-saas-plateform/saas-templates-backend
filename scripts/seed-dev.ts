/**
 * Dev seed: tenants, orgs, memberships, app users + ensure tenant databases exist.
 * Pair with: pnpm migrate:control → pnpm seed:dev → pnpm migrate:tenant <id> → pnpm keycloak:import
 *
 * Login (Keycloak): user-a / password  or  admin-a / password
 */
import pg from 'pg';
import { loadEnvFile } from './load-env.js';
import { TENANT_DATABASE_CREDENTIALS_REF } from '../src/shared/database/database.constants.js';

loadEnvFile();

const TENANT_A_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const TENANT_B_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ORG_A1_ID = '11111111-1111-4111-8111-111111111111';
const ORG_A2_ID = '22222222-2222-4222-8222-222222222222';
const ORG_B1_ID = '33333333-3333-4333-8333-333333333333';
/** Must match Keycloak user ids in docker/keycloak/platform-realm.json */
const USER_A_SUB = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0001';
const ADMIN_A_SUB = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0002';

function controlConfig(database: string) {
  return {
    host: process.env.CONTROL_PLANE_DB_HOST ?? '127.0.0.1',
    port: Number(process.env.CONTROL_PLANE_DB_PORT ?? 5432),
    database,
    user: process.env.CONTROL_PLANE_DB_USER ?? 'postgres',
    password: process.env.CONTROL_PLANE_DB_PASSWORD ?? 'postgres',
  };
}

async function ensureDatabase(name: string): Promise<void> {
  if (!/^[a-z][a-z0-9_]*$/i.test(name)) {
    throw new Error(`Unsafe database name: ${name}`);
  }
  const admin = new pg.Client(controlConfig('postgres'));
  await admin.connect();
  try {
    const exists = await admin.query<{ exists: boolean }>(
      `SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname = $1) AS exists`,
      [name],
    );
    if (!exists.rows[0]?.exists) {
      await admin.query(`CREATE DATABASE ${name}`);
      console.log(`  created database ${name}`);
    } else {
      console.log(`  database ${name} already exists`);
    }
  } finally {
    await admin.end();
  }
}

async function seed(): Promise<void> {
  const dbHost = process.env.CONTROL_PLANE_DB_HOST ?? '127.0.0.1';
  const dbPort = Number(process.env.CONTROL_PLANE_DB_PORT ?? 5432);
  // Use the same role as local Postgres — dedicated t_tenant_*_app roles are not created in dev.
  const dbUser = process.env.CONTROL_PLANE_DB_USER ?? 'postgres';

  console.log('Ensuring databases…');
  await ensureDatabase(process.env.CONTROL_PLANE_DB_NAME ?? 'platform_control');
  await ensureDatabase('tenant_a');
  await ensureDatabase('tenant_b');

  const pool = new pg.Pool(controlConfig(process.env.CONTROL_PLANE_DB_NAME ?? 'platform_control'));

  await pool.query(
    `INSERT INTO tenants (id, slug, status, database_host, database_port, database_name,
      database_username, database_credentials_ref, region, environment)
     VALUES
       ($1, 'tenant-a', 'ACTIVE', $3, $4, 'tenant_a', $6, $5, 'eu-west-1', 'development'),
       ($2, 'tenant-b', 'ACTIVE', $3, $4, 'tenant_b', $6, $5, 'eu-west-1', 'development')
     ON CONFLICT (slug) DO UPDATE SET
       status = 'ACTIVE',
       database_host = EXCLUDED.database_host,
       database_port = EXCLUDED.database_port,
       database_name = EXCLUDED.database_name,
       database_username = EXCLUDED.database_username,
       database_credentials_ref = EXCLUDED.database_credentials_ref`,
    [
      TENANT_A_ID,
      TENANT_B_ID,
      dbHost,
      dbPort,
      TENANT_DATABASE_CREDENTIALS_REF,
      dbUser,
    ],
  );
  console.log('  tenants tenant-a, tenant-b');

  await pool.query(
    `INSERT INTO organizations (id, tenant_id, keycloak_organization_id, name, slug, status)
     VALUES
       ($1, $4, 'kc-org-a1', 'Organization A1', 'org-a1', 'ACTIVE'),
       ($2, $4, 'kc-org-a2', 'Organization A2', 'org-a2', 'ACTIVE'),
       ($3, $5, 'kc-org-b1', 'Organization B1', 'org-b1', 'ACTIVE')
     ON CONFLICT (tenant_id, slug) DO UPDATE SET
       status = 'ACTIVE',
       name = EXCLUDED.name,
       keycloak_organization_id = CASE
         WHEN organizations.keycloak_organization_id IS NULL
           OR organizations.keycloak_organization_id LIKE 'kc-%'
         THEN EXCLUDED.keycloak_organization_id
         ELSE organizations.keycloak_organization_id
       END`,
    [ORG_A1_ID, ORG_A2_ID, ORG_B1_ID, TENANT_A_ID, TENANT_B_ID],
  );
  console.log('  organizations org-a1, org-a2, org-b1 (placeholders until keycloak:import)');

  for (const [userId, label] of [
    [USER_A_SUB, 'user-a'],
    [ADMIN_A_SUB, 'admin-a'],
  ] as const) {
    await pool.query(
      `INSERT INTO user_tenant_memberships (user_id, tenant_id, status)
       VALUES ($1, $2, 'ACTIVE')
       ON CONFLICT (user_id, tenant_id) DO UPDATE SET status = 'ACTIVE'`,
      [userId, TENANT_A_ID],
    );

    await pool.query(
      `INSERT INTO user_organization_memberships (user_id, organization_id, tenant_id, roles)
       VALUES
         ($1, $2, $4, $5::jsonb),
         ($1, $3, $4, $6::jsonb)
       ON CONFLICT (user_id, organization_id) DO UPDATE SET
         roles = EXCLUDED.roles,
         tenant_id = EXCLUDED.tenant_id`,
      [
        userId,
        ORG_A1_ID,
        ORG_A2_ID,
        TENANT_A_ID,
        JSON.stringify(['tenant-owner']),
        JSON.stringify(['viewer']),
      ],
    );

    await pool.query(
      `INSERT INTO application_users (identity_id, tenant_id, status, profile)
       VALUES ($1, $2, 'ACTIVE', $3::jsonb)
       ON CONFLICT (tenant_id, identity_id) DO UPDATE SET
         status = 'ACTIVE',
         profile = EXCLUDED.profile,
         updated_at = NOW()`,
      [
        userId,
        TENANT_A_ID,
        JSON.stringify({
          displayName: label === 'user-a' ? 'User TenantA' : 'Admin TenantA',
          email:
            label === 'user-a'
              ? 'user-a@tenant-a.example.com'
              : 'admin-a@tenant-a.example.com',
          username: label,
        }),
      ],
    );
    console.log(`  memberships + application_users for ${label}`);
  }

  await pool.query(
    `INSERT INTO tenant_owners (tenant_id, identity_id) VALUES ($1, $2)
     ON CONFLICT (tenant_id) DO UPDATE SET identity_id = EXCLUDED.identity_id`,
    [TENANT_A_ID, ADMIN_A_SUB],
  );
  console.log('  tenant_owners → admin-a');

  await pool.end();

  console.log(`
Seed OK.

Next:
  pnpm migrate:tenant ${TENANT_A_ID}
  pnpm migrate:tenant ${TENANT_B_ID}
  pnpm keycloak:import

Login (edge http://localhost:3001 → Login → Keycloak):
  user-a  / password   (tenant-owner on org-a1)
  admin-a / password   (tenant-owner on org-a1)
`);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
