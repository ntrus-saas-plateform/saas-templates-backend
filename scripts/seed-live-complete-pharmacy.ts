/**
 * Lab seed: idempotent Pharmacy vertical + PHARMACY_LIVE product for live-complete.
 *
 * Usage:
 *   pnpm seed:live-complete
 *   pnpm exec tsx scripts/seed-live-complete-pharmacy.ts
 *
 * Connects via DATABASE_URL when set, otherwise CONTROL_PLANE_DB_* (same as seed-dev).
 */
import pg from 'pg';
import { loadEnvFile } from './load-env.js';

loadEnvFile();

const VERTICAL_CODE = 'PHARMACY';
const VERTICAL_SLUG = 'pharmacy';
const PRODUCT_CODE = 'PHARMACY_LIVE';
const PRODUCT_SLUG = 'pharmacy-live';

function controlPool(): pg.Pool {
  if (process.env.DATABASE_URL?.trim()) {
    return new pg.Pool({ connectionString: process.env.DATABASE_URL.trim() });
  }
  return new pg.Pool({
    host: process.env.CONTROL_PLANE_DB_HOST ?? '127.0.0.1',
    port: Number(process.env.CONTROL_PLANE_DB_PORT ?? 5432),
    database: process.env.CONTROL_PLANE_DB_NAME ?? 'platform_control',
    user: process.env.CONTROL_PLANE_DB_USER ?? 'postgres',
    password: process.env.CONTROL_PLANE_DB_PASSWORD ?? 'postgres',
  });
}

async function main(): Promise<void> {
  const pool = controlPool();
  try {
    const existingPharmacy = await pool.query<{ id: string; code: string }>(
      `SELECT id, code FROM edge_products
       WHERE upper(code) IN ('PHARMACY_LIVE', 'PHARMACY')
          OR lower(slug) IN ('pharmacy-live', 'pharmacy')
       ORDER BY CASE WHEN upper(code) = 'PHARMACY_LIVE' THEN 0 ELSE 1 END
       LIMIT 1`,
    );

    if (existingPharmacy.rows[0]) {
      const row = existingPharmacy.rows[0];
      console.log(`Pharmacy product already present: code=${row.code} id=${row.id}`);
      console.log(row.id);
      return;
    }

    const vertical = await pool.query<{ id: string }>(
      `INSERT INTO edge_verticals (code, slug, display_name, status)
       VALUES ($1, $2, 'Pharmacy', 'ACTIVE')
       ON CONFLICT (code) DO UPDATE SET
         status = 'ACTIVE',
         display_name = EXCLUDED.display_name,
         updated_at = NOW()
       RETURNING id`,
      [VERTICAL_CODE, VERTICAL_SLUG],
    );
    const verticalId = vertical.rows[0].id;
    console.log(`  vertical ${VERTICAL_CODE} id=${verticalId}`);

    const product = await pool.query<{ id: string }>(
      `INSERT INTO edge_products (
         code, slug, name, short_description, vertical_id,
         lifecycle_status, commercial_availability, product_type, metadata
       ) VALUES (
         $1, $2, 'Pharmacy Live Complete',
         'Lab product for Edge live-complete Pharmacy golden path',
         $3, 'PUBLISHED', 'AVAILABLE', 'SAAS',
         '{"liveComplete":true,"lab":"pharmacy"}'::jsonb
       )
       ON CONFLICT (code) DO UPDATE SET
         lifecycle_status = 'PUBLISHED',
         commercial_availability = 'AVAILABLE',
         name = EXCLUDED.name,
         short_description = EXCLUDED.short_description,
         updated_at = NOW()
       RETURNING id`,
      [PRODUCT_CODE, PRODUCT_SLUG, verticalId],
    );
    const productId = product.rows[0].id;
    console.log(`  product ${PRODUCT_CODE} id=${productId}`);
    console.log(productId);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
