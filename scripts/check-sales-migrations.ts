import pg from 'pg';
import { loadEnvFile } from './load-env.js';

loadEnvFile();

const REQUIRED = [
  '081_edge_sales_crm_foundation',
  '082_edge_sales_opportunity_pipeline',
  '083_edge_sales_activities_needs',
  '084_edge_sales_quotes_deal_desk',
  '085_edge_sales_contracts_orders_handoff',
  '086_edge_sales_platform_completion',
] as const;

/**
 * Operational readiness check for P4 sales migrations.
 * Exit 0 when all 081–086 are registered; exit 1 with missing list otherwise.
 */
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
      console.error('FAIL: missing sales migrations:');
      for (const v of missing) console.error(`  - ${v}`);
      console.error('Apply with: npm run migrate:control');
      process.exitCode = 1;
      return;
    }

    console.log('OK: sales migrations 081–086 applied');
    for (const v of REQUIRED) console.log(`  ✓ ${v}`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('check-sales-migrations failed:', err);
  process.exit(1);
});
