import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import pg from 'pg';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
import { runTestcontainers } from '../helpers/testcontainers-env.js';

describe.skipIf(!runTestcontainers)('PostgreSQL Integration (Testcontainers)', () => {
  let container: StartedPostgreSqlContainer;
  let pool: pg.Pool;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine')
      .withDatabase('platform_control')
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

    const migrationsDir = join(__dirname, '..', '..', 'migrations', 'control-plane');
    const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
    for (const file of files) {
      const sql = readFileSync(join(migrationsDir, file), 'utf-8');
      await pool.query(sql);
    }
  }, 120_000);

  afterAll(async () => {
    await pool?.end();
    await container?.stop();
  });

  it('should have tenants table after migration', async () => {
    const result = await pool.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'tenants' ORDER BY column_name`,
    );
    const columns = result.rows.map((r) => r.column_name);
    expect(columns).toContain('id');
    expect(columns).toContain('slug');
    expect(columns).toContain('status');
    expect(columns).toContain('database_host');
  });

  it('should insert and query a tenant', async () => {
    const insert = await pool.query(
      `INSERT INTO tenants (slug, status, database_host, database_port, database_name,
        database_credentials_ref, region, environment)
       VALUES ('test-tenant', 'ACTIVE', 'localhost', 5432, 'test_db', 'TEST_DB_PASSWORD', 'eu-west-1', 'test')
       RETURNING id, slug`,
    );
    expect(insert.rows[0].slug).toBe('test-tenant');

    const select = await pool.query(`SELECT slug FROM tenants WHERE slug = 'test-tenant'`);
    expect(select.rows).toHaveLength(1);
  });

  it('should enforce unique slug constraint', async () => {
    await expect(
      pool.query(
        `INSERT INTO tenants (slug, status, database_host, database_port, database_name,
          database_credentials_ref, region, environment)
         VALUES ('test-tenant', 'ACTIVE', 'localhost', 5432, 'test_db2', 'TEST_DB_PASSWORD', 'eu-west-1', 'test')`,
      ),
    ).rejects.toThrow();
  });

  it('should have user_tenant_memberships table after migration', async () => {
    const result = await pool.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'user_tenant_memberships' ORDER BY column_name`,
    );
    const columns = result.rows.map((r) => r.column_name);
    expect(columns).toContain('user_id');
    expect(columns).toContain('tenant_id');
    expect(columns).toContain('status');
  });
});
