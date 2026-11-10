import pg from 'pg';
import { loadEnvFile } from './load-env.js';

loadEnvFile();

const REQUIRED = [
  '087_edge_subscription_foundation',
  '088_edge_subscription_entitlements_changes',
  '089_edge_subscription_coordination_governance',
] as const;

async function main(): Promise<void> {
  const pool = new pg.Pool({
    host: process.env.CONTROL_PLANE_DB_HOST ?? 'localhost',
    port: Number(process.env.CONTROL_PLANE_DB_PORT ?? 5432),
    database: process.env.CONTROL_PLANE_DB_NAME ?? 'platform_control',
    user: process.env.CONTROL_PLANE_DB_USER ?? 'platform',
    password: process.env.CONTROL_PLANE_DB_PASSWORD ?? 'platform',
  });

  try {
    const exists = await pool.query(`
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'schema_migrations'
    `);
    if (!exists.rowCount) {
      console.error('FAIL: schema_migrations missing — run npm run migrate:control');
      process.exitCode = 1;
      return;
    }

    const result = await pool.query(
      `SELECT version FROM schema_migrations WHERE version = ANY($1::text[])`,
      [REQUIRED],
    );
    const applied = new Set(result.rows.map((r) => r.version as string));
    const missing = REQUIRED.filter((v) => !applied.has(v));

    if (missing.length) {
      console.error('FAIL: missing subscription migrations:');
      for (const v of missing) console.error(`  - ${v}`);
      console.error('Apply with: npm run migrate:control');
      process.exitCode = 1;
      return;
    }

    console.log('OK: subscription migrations 087–089 applied');
    for (const v of REQUIRED) console.log(`  ✓ ${v}`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('check-subscription-migrations failed:', err);
  process.exit(1);
});
