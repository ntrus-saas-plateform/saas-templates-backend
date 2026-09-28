import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { loadEnvFile } from './load-env.js';

loadEnvFile();

const __dirname = dirname(fileURLToPath(import.meta.url));

async function migrateTenant(): Promise<void> {
  const tenantId = process.argv[2];
  if (!tenantId) {
    console.error('Usage: migrate:tenant <tenant-id>');
    process.exit(1);
  }

  const controlPool = new pg.Pool({
    host: process.env.CONTROL_PLANE_DB_HOST ?? 'localhost',
    port: Number(process.env.CONTROL_PLANE_DB_PORT ?? 5432),
    database: process.env.CONTROL_PLANE_DB_NAME ?? 'platform_control',
    user: process.env.CONTROL_PLANE_DB_USER ?? 'platform',
    password: process.env.CONTROL_PLANE_DB_PASSWORD ?? 'platform',
  });

  const tenantResult = await controlPool.query<{
    database_host: string;
    database_port: number;
    database_name: string;
    database_credentials_ref: string;
  }>(
    `SELECT database_host, database_port, database_name, database_credentials_ref
     FROM tenants WHERE id = $1`,
    [tenantId],
  );

  const tenant = tenantResult.rows[0];
  if (!tenant) {
    console.error(`Tenant not found: ${tenantId}`);
    process.exit(1);
  }

  const password =
    process.env.TENANT_DB_PASSWORD ??
    process.env.CONTROL_PLANE_DB_PASSWORD ??
    'platform';

  const pool = new pg.Pool({
    host: tenant.database_host,
    port: tenant.database_port,
    database: tenant.database_name,
    user: process.env.CONTROL_PLANE_DB_USER ?? 'platform',
    password,
  });

  const migrationsDir = join(__dirname, '..', 'migrations', 'tenant');
  const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    for (const file of files) {
      const version = file.replace('.sql', '');
      const applied = await client.query(
        'SELECT 1 FROM schema_migrations WHERE version = $1',
        [version],
      );
      if (applied.rowCount && applied.rowCount > 0) {
        console.log(`Skipping ${version} for tenant ${tenantId} (already applied)`);
        continue;
      }

      const sql = readFileSync(join(migrationsDir, file), 'utf-8');
      await client.query(sql);
      console.log(`Applied ${version} to tenant ${tenantId}`);
    }
    await client.query('COMMIT');
    console.log(`Tenant ${tenantId} migrations complete`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
    await controlPool.end();
  }
}

migrateTenant().catch((err) => {
  console.error('Tenant migration failed:', err);
  process.exit(1);
});
