import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import pg from 'pg';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PgIdempotencyStore } from '../../src/shared/idempotency/pg-idempotency.store.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
import { runTestcontainers } from '../helpers/testcontainers-env.js';

describe.skipIf(!runTestcontainers)('Idempotency Integration (Testcontainers)', () => {
  let container: StartedPostgreSqlContainer;
  let pool: pg.Pool;
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
    const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
    for (const file of files) {
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

  it('acquires once and replays on second identical request', async () => {
    const first = await store.acquire('key-1', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'hash-a');
    expect(first.type).toBe('acquired');

    await store.complete('key-1', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 201, '{"ok":true}');

    const second = await store.acquire('key-1', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'hash-a');
    expect(second.type).toBe('replay');
  });

  it('conflicts on same key with different payload', async () => {
    const result = await store.acquire('key-2', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'hash-x');
    expect(result.type).toBe('acquired');

    await store.complete('key-2', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 201, '{}');

    const conflict = await store.acquire('key-2', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'hash-y');
    expect(conflict.type).toBe('conflict');
  });
});
