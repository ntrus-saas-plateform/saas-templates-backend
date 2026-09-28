import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { loadEnvFile } from './load-env.js';

loadEnvFile();

const __dirname = dirname(fileURLToPath(import.meta.url));

async function migrate(): Promise<void> {
  const pool = new pg.Pool({
    host: process.env.CONTROL_PLANE_DB_HOST ?? 'localhost',
    port: Number(process.env.CONTROL_PLANE_DB_PORT ?? 5432),
    database: process.env.CONTROL_PLANE_DB_NAME ?? 'platform_control',
    user: process.env.CONTROL_PLANE_DB_USER ?? 'platform',
    password: process.env.CONTROL_PLANE_DB_PASSWORD ?? 'platform',
  });

  const migrationsDir = join(__dirname, '..', 'migrations', 'control-plane');
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
        console.log(`Skipping ${version} (already applied)`);
        continue;
      }
      const sql = readFileSync(join(migrationsDir, file), 'utf-8');
      await client.query(sql);
      console.log(`Applied ${version}`);
    }
    await client.query('COMMIT');
    console.log('Control plane migrations complete');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
