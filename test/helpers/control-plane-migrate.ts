import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Pool, PoolClient } from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function controlPlaneMigrationsDir(): string {
  return join(__dirname, '..', '..', 'migrations', 'control-plane');
}

export function tenantMigrationsDir(): string {
  return join(__dirname, '..', '..', 'migrations', 'tenant');
}

export function listControlPlaneMigrationFiles(): string[] {
  return readdirSync(controlPlaneMigrationsDir())
    .filter((f) => f.endsWith('.sql'))
    .sort();
}

export function listTenantMigrationFiles(): string[] {
  return readdirSync(tenantMigrationsDir())
    .filter((f) => f.endsWith('.sql'))
    .sort();
}

/**
 * Mirrors scripts/migrate-control-plane.ts semantics:
 * - single outer transaction
 * - skip versions already in schema_migrations
 * - SQL files are responsible for inserting their own registry rows
 */
export async function applyControlPlaneMigrations(
  pool: Pool,
  options?: { stopBeforeVersion?: string; onlyVersion?: string },
): Promise<{ applied: string[]; skipped: string[] }> {
  const files = listControlPlaneMigrationFiles();
  const applied: string[] = [];
  const skipped: string[] = [];
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
      if (options?.stopBeforeVersion && version >= options.stopBeforeVersion) {
        break;
      }
      if (options?.onlyVersion && version !== options.onlyVersion) {
        continue;
      }

      const existing = await client.query('SELECT 1 FROM schema_migrations WHERE version = $1', [
        version,
      ]);
      if (existing.rowCount && existing.rowCount > 0) {
        skipped.push(version);
        continue;
      }

      const sql = readFileSync(join(controlPlaneMigrationsDir(), file), 'utf-8');
      await client.query(sql);
      applied.push(version);
    }

    await client.query('COMMIT');
    return { applied, skipped };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function applyTenantMigrations(pool: Pool): Promise<string[]> {
  const files = listTenantMigrationFiles();
  const applied: string[] = [];
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
      const existing = await client.query('SELECT 1 FROM schema_migrations WHERE version = $1', [
        version,
      ]);
      if (existing.rowCount && existing.rowCount > 0) continue;
      const sql = readFileSync(join(tenantMigrationsDir(), file), 'utf-8');
      await client.query(sql);
      applied.push(version);
    }
    await client.query('COMMIT');
    return applied;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function withClient<T>(
  pool: Pool,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}
