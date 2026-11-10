import pg from 'pg';
import { loadEnvFile } from './load-env.js';

loadEnvFile();

const REQUIRED = ['095_edge_p7_provisioning_authorization_foundation'] as const;

const REQUIRED_TABLES = [
  'edge_provisioning_authorizations',
  'edge_p7_provisioning_requests',
  'edge_p7_provisioning_request_history',
  'edge_p7_authorization_revocation_inbox',
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
      console.error('FAIL: missing provisioning migrations:');
      for (const v of missing) console.error(`  - ${v}`);
      console.error('Apply with: npm run migrate:control');
      process.exitCode = 1;
      return;
    }

    const tables = await pool.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = ANY($1::text[])`,
      [REQUIRED_TABLES],
    );
    const present = new Set(tables.rows.map((r) => r.table_name as string));
    const missingTables = REQUIRED_TABLES.filter((t) => !present.has(t));
    if (missingTables.length) {
      console.error('FAIL: migration recorded but tables missing:');
      for (const t of missingTables) console.error(`  - ${t}`);
      process.exitCode = 1;
      return;
    }

    console.log('OK: P7.1 provisioning migration 095 applied');
    for (const v of REQUIRED) console.log(`  ✓ ${v}`);
    for (const t of REQUIRED_TABLES) console.log(`  ✓ table ${t}`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('check-provisioning-migrations failed:', err);
  process.exit(1);
});
