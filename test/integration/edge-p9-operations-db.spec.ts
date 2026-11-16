import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import pg from 'pg';
import { runTestcontainers } from '../helpers/testcontainers-env.js';
import { applyControlPlaneMigrations } from '../helpers/control-plane-migrate.js';

describe.skipIf(!runTestcontainers)('P9 operations DB (Testcontainers)', () => {
  let container: StartedPostgreSqlContainer;
  let pool: pg.Pool;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine')
      .withDatabase('platform_control_p9_ops')
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
    const result = await applyControlPlaneMigrations(pool);
    expect(result.applied).toContain('115_edge_p9_service_catalog');
    expect(result.applied).toContain('116_edge_p9_operations_core');
    expect(result.applied).toContain('118_edge_p9_remediation_ops');
  }, 300_000);

  afterAll(async () => {
    await pool?.end();
    await container?.stop();
  });

  it('creates P9 core + remediation tables after migrate', async () => {
    const tables = await pool.query<{ table_name: string }>(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name = ANY($1::text[])
       ORDER BY table_name`,
      [
        [
          'edge_p9_services',
          'edge_p9_alerts',
          'edge_p9_releases',
          'edge_p9_notification_deliveries',
          'edge_p9_monitoring_probe_results',
        ],
      ],
    );
    const names = tables.rows.map((r) => r.table_name);
    expect(names).toEqual(
      expect.arrayContaining([
        'edge_p9_services',
        'edge_p9_alerts',
        'edge_p9_releases',
        'edge_p9_notification_deliveries',
      ]),
    );
  });

  it('supports service insert + alert fingerprint dedup smoke', async () => {
    const service = await pool.query<{ id: string }>(
      `INSERT INTO edge_p9_services (
         service_code, service_slug, display_name, created_by
       ) VALUES ('p9-svc-smoke', 'p9-svc-smoke', 'P9 Smoke Service', 'test')
       RETURNING id`,
    );
    const serviceId = service.rows[0]!.id;

    const first = await pool.query<{ id: string; occurrence_count: number }>(
      `INSERT INTO edge_p9_alerts (
         fingerprint, title, severity, status, service_id, source_system
       ) VALUES ('fp-p9-smoke', 'Smoke alert', 'SEV3', 'ACTIVE', $1, 'prometheus.smoke')
       RETURNING id, occurrence_count`,
      [serviceId],
    );
    expect(first.rows[0]!.occurrence_count).toBe(1);

    await expect(
      pool.query(
        `INSERT INTO edge_p9_alerts (
           fingerprint, title, severity, status, service_id, source_system
         ) VALUES ('fp-p9-smoke', 'Smoke alert again', 'SEV3', 'ACTIVE', $1, 'prometheus.smoke')`,
        [serviceId],
      ),
    ).rejects.toThrow();

    const bumped = await pool.query<{ occurrence_count: number }>(
      `UPDATE edge_p9_alerts
       SET occurrence_count = occurrence_count + 1, last_seen_at = NOW(), updated_at = NOW()
       WHERE fingerprint = 'fp-p9-smoke'
       RETURNING occurrence_count`,
    );
    expect(bumped.rows[0]!.occurrence_count).toBe(2);
  });

  it('rejects DELIVERED notification without provider_ref at DB layer', async () => {
    await expect(
      pool.query(
        `INSERT INTO edge_p9_notification_deliveries (
           event_type, channel, destination, status
         ) VALUES ('PAGE', 'EMAIL', 'ops@example.com', 'DELIVERED')`,
      ),
    ).rejects.toThrow();
  });

  it('rejects DEPLOYED release without artifact_digest or external_evidence_ref', async () => {
    await expect(
      pool.query(
        `INSERT INTO edge_p9_releases (
           release_number, version, status, created_by
         ) VALUES ('REL-SMOKE-1', '1.0.0', 'DEPLOYED', 'test')`,
      ),
    ).rejects.toThrow();

    const ok = await pool.query<{ id: string }>(
      `INSERT INTO edge_p9_releases (
         release_number, version, status, artifact_digest, created_by, deployed_at
       ) VALUES ('REL-SMOKE-2', '1.0.1', 'DEPLOYED', 'sha256:deadbeef', 'test', NOW())
       RETURNING id`,
    );
    expect(ok.rows[0]!.id).toBeTruthy();
  });
});
