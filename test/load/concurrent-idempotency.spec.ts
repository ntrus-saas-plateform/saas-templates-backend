import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import pg from 'pg';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PgIdempotencyStore } from '../../src/shared/idempotency/pg-idempotency.store.js';
import { runTestcontainers } from '../helpers/testcontainers-env.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe.skipIf(!runTestcontainers)('Load: concurrent idempotency acquire', () => {
  let pool: pg.Pool;
  let container: Awaited<ReturnType<PostgreSqlContainer['start']>>;
  let store: PgIdempotencyStore;

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
    for (const file of readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()) {
      await pool.query(readFileSync(join(migrationsDir, file), 'utf-8'));
    }

    store = new PgIdempotencyStore(
      { getControlPlanePool: () => pool } as never,
      { IDEMPOTENCY_TTL_SECONDS: 3600 } as never,
    );
  }, 120_000);

  afterAll(async () => {
    await pool?.end();
    await container?.stop();
  });

  it('allows only one concurrent acquire for the same key', async () => {
    const tenantId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const results = await Promise.all(
      Array.from({ length: 10 }, () => store.acquire('concurrent-key', tenantId, 'hash-load')),
    );

    const acquired = results.filter((r) => r.type === 'acquired');
    const conflicts = results.filter((r) => r.type === 'conflict');

    expect(acquired.length + conflicts.length).toBe(10);
    expect(acquired.length).toBeLessThanOrEqual(1);
  });
});
