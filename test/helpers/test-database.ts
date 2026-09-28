import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import pg from 'pg';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  TENANT_A_ID,
  ORG_A1_ID,
  ORG_A2_ID,
  ORG_B1_ID,
  TENANT_B_ID,
  USER_A_ID,
} from './test-constants.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

export interface TestDatabaseEnvironment {
  readonly container: StartedPostgreSqlContainer;
  readonly host: string;
  readonly port: number;
  readonly user: string;
  readonly password: string;
  readonly controlPlaneDatabase: string;
  readonly tenantADatabase: string;
  stop(): Promise<void>;
}

async function runSqlFiles(pool: pg.Pool, directory: string): Promise<void> {
  const files = readdirSync(directory).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    await pool.query(readFileSync(join(directory, file), 'utf-8'));
  }
}

export async function setupTestDatabase(): Promise<TestDatabaseEnvironment> {
  const container = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabase('platform_control')
    .withUsername('platform')
    .withPassword('platform')
    .start();

  const host = container.getHost();
  const port = container.getPort();
  const user = container.getUsername();
  const password = container.getPassword();
  const controlPlaneDatabase = container.getDatabase();
  const tenantADatabase = 'tenant_a';

  const adminPool = new pg.Pool({ host, port, database: controlPlaneDatabase, user, password });
  await runSqlFiles(adminPool, join(ROOT, 'migrations', 'control-plane'));

  await adminPool.query(`CREATE DATABASE ${tenantADatabase}`);
  await adminPool.query(
    `INSERT INTO tenants (id, slug, status, database_host, database_port, database_name,
      database_credentials_ref, region, environment)
     VALUES
       ($1, 'tenant-a', 'ACTIVE', $2, $3, $4, 'TENANT_DB_PASSWORD', 'test', 'test'),
       ($5, 'tenant-b', 'ACTIVE', $2, $3, $4, 'TENANT_DB_PASSWORD', 'test', 'test')
     ON CONFLICT (slug) DO UPDATE SET
       database_host = EXCLUDED.database_host,
       database_port = EXCLUDED.database_port,
       database_name = EXCLUDED.database_name`,
    [TENANT_A_ID, host, port, tenantADatabase, TENANT_B_ID],
  );

  await adminPool.query(
    `INSERT INTO organizations (id, tenant_id, keycloak_organization_id, name, slug, status)
     VALUES
       ($1, $4, 'kc-org-a1', 'Organization A1', 'org-a1', 'ACTIVE'),
       ($2, $4, 'kc-org-a2', 'Organization A2', 'org-a2', 'ACTIVE'),
       ($3, $5, 'kc-org-b1', 'Organization B1', 'org-b1', 'ACTIVE')
     ON CONFLICT (tenant_id, slug) DO NOTHING`,
    [ORG_A1_ID, ORG_A2_ID, ORG_B1_ID, TENANT_A_ID, TENANT_B_ID],
  );

  await adminPool.query(
    `INSERT INTO user_tenant_memberships (user_id, tenant_id, status)
     VALUES ($1, $2, 'ACTIVE') ON CONFLICT (user_id, tenant_id) DO NOTHING`,
    [USER_A_ID, TENANT_A_ID],
  );

  await adminPool.query(
    `INSERT INTO user_organization_memberships
       (user_id, organization_id, tenant_id, status, roles, permissions)
     VALUES ($1, $2, $4, 'ACTIVE', '["tenant-owner"]'::jsonb, '[]'::jsonb),
            ($1, $3, $4, 'ACTIVE', '["tenant-owner"]'::jsonb, '[]'::jsonb)
     ON CONFLICT (user_id, organization_id) DO UPDATE SET
       status = 'ACTIVE',
       roles = '["tenant-owner"]'::jsonb`,
    [USER_A_ID, ORG_A1_ID, ORG_A2_ID, TENANT_A_ID],
  );

  await adminPool.end();

  const tenantPool = new pg.Pool({ host, port, database: tenantADatabase, user, password });
  await runSqlFiles(tenantPool, join(ROOT, 'migrations', 'tenant'));
  await tenantPool.end();

  return {
    container,
    host,
    port,
    user,
    password,
    controlPlaneDatabase,
    tenantADatabase,
    stop: async () => {
      await container.stop();
    },
  };
}
