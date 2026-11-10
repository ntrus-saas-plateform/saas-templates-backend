import pg from 'pg';
import { loadEnvFile } from './load-env.js';

loadEnvFile();

const REQUIRED = [
  '090_edge_billing_foundation',
  '091_edge_billing_invoicing_tax',
  '092_edge_billing_payments_ledger_collections',
  '093_edge_billing_ops_settlement_fx',
  '094_edge_billing_revenue_export_portal',
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
      console.error('FAIL: missing billing migrations:');
      for (const v of missing) console.error(`  - ${v}`);
      console.error('Apply with: npm run migrate:control');
      process.exitCode = 1;
      return;
    }

    console.log('OK: billing migrations 090–094 applied');
    for (const v of REQUIRED) console.log(`  ✓ ${v}`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('check-billing-migrations failed:', err);
  process.exit(1);
});
