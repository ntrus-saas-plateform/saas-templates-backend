/* Temporary final check: outbox health after credential repair. Read-only. */
const pg = require('pg');

const BASE = { host: '127.0.0.1', port: 5432, user: 'edge-okapi', password: 'edge0707' };

async function statusOf(database, table) {
  const c = new pg.Client({ ...BASE, database });
  await c.connect();
  try {
    const r = await c.query(
      `SELECT status, count(*)::int AS n, max(updated_at) AS last_update FROM ${table} GROUP BY status ORDER BY status`,
    );
    const recentErr = await c.query(
      `SELECT count(*)::int AS n FROM ${table} WHERE last_error IS NOT NULL AND updated_at > NOW() - INTERVAL '10 minutes'`,
    );
    console.log(`${database}.${table}: ${JSON.stringify(r.rows)} recent_errors=${recentErr.rows[0].n}`);
  } finally {
    await c.end();
  }
}

(async () => {
  for (const db of ['tenant_a', 'tenant_b', 'tenant_smoke_org_1793624799808_edge4be0']) {
    await statusOf(db, 'outbox_events');
  }
  await statusOf('platform_control', 'control_plane_outbox_events');
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
