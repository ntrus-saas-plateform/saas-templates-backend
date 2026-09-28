import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import pg from 'pg';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ControlPlaneDatabaseService } from '../../src/shared/database/control-plane-database.service.js';
import { PgTenantRegistry } from '../../src/modules/identity/infrastructure/persistence/pg-tenant-registry.js';
import { runTestcontainers } from '../helpers/testcontainers-env.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TENANT_COUNT = 1000;

describe.skipIf(!runTestcontainers)('Load: tenant registry scale (live DB)', () => {
  let pool: pg.Pool;
  let container: Awaited<ReturnType<PostgreSqlContainer['start']>>;
  let registry: PgTenantRegistry;

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

    const values: string[] = [];
    const params: string[] = [];
    for (let i = 0; i < TENANT_COUNT; i++) {
      const slug = `tenant_scale_${i}`;
      const base = params.length;
      params.push(
        slug,
        'ACTIVE',
        'localhost',
        '5432',
        `tenant_${i}`,
        'TEST_DB_PASSWORD',
        'eu-west-1',
        'test',
      );
      values.push(
        `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8})`,
      );
    }

    await pool.query(
      `INSERT INTO tenants (slug, status, database_host, database_port, database_name, database_credentials_ref, region, environment)
       VALUES ${values.join(', ')}`,
      params,
    );

    const controlPlaneDb = new ControlPlaneDatabaseService({
      CONTROL_PLANE_DB_HOST: container.getHost(),
      CONTROL_PLANE_DB_PORT: container.getPort(),
      CONTROL_PLANE_DB_NAME: container.getDatabase(),
      CONTROL_PLANE_DB_USER: container.getUsername(),
      CONTROL_PLANE_DB_PASSWORD: container.getPassword(),
      CONTROL_PLANE_DB_SSL: false,
      CONTROL_PLANE_DB_SSL_REJECT_UNAUTHORIZED: false,
      DB_POOL_MAX: 20,
      DB_POOL_IDLE_TIMEOUT_MS: 30000,
      DB_POOL_CONNECTION_TIMEOUT_MS: 5000,
      DB_STATEMENT_TIMEOUT_MS: 30000,
      CIRCUIT_BREAKER_THRESHOLD: 5,
      CIRCUIT_BREAKER_RESET_MS: 30000,
    } as never);

    registry = new PgTenantRegistry(controlPlaneDb);
  }, 180_000);

  afterAll(async () => {
    await pool?.end();
    await container?.stop();
  });

  it('lists 1000 active tenant ids within latency budget', async () => {
    const start = performance.now();
    const ids = await registry.listActiveTenantIds();
    const elapsed = performance.now() - start;

    expect(ids.length).toBe(TENANT_COUNT);
    expect(elapsed).toBeLessThan(500);
  });

  it('findById for random tenants stays within latency budget', async () => {
    const ids = await registry.listActiveTenantIds();
    const samples = ids.filter((_, index) => index % 10 === 0);
    const latencies: number[] = [];

    for (const id of samples) {
      const start = performance.now();
      const tenant = await registry.findById(id);
      latencies.push(performance.now() - start);
      expect(tenant?.id).toBe(id);
    }

    latencies.sort((a, b) => a - b);
    const p95 = latencies[Math.floor(latencies.length * 0.95)] ?? 0;
    expect(p95).toBeLessThan(50);
  });
});
