/**
 * Seeds Control Plane Edge administrator for Playwright authenticated A–F.
 *
 * Pairs with Keycloak user in docker/keycloak/edge-admin-realm.json:
 *   id/sub: eeeeeeee-eeee-4eee-8eee-eeeeeeee0001
 *   username: edge-e2e / password: password
 *
 * Usage:
 *   pnpm seed:edge-e2e
 */
import pg from 'pg';

const EXTERNAL_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeee0001';
const EMAIL = 'edge-e2e@okapi.local';
const DISPLAY = 'Edge E2E';

async function main() {
  const pool = new pg.Pool({
    host: process.env.CONTROL_PLANE_DB_HOST ?? 'localhost',
    port: Number(process.env.CONTROL_PLANE_DB_PORT ?? 5432),
    user: process.env.CONTROL_PLANE_DB_USER ?? 'postgres',
    password: process.env.CONTROL_PLANE_DB_PASSWORD ?? 'postgres',
    database: process.env.CONTROL_PLANE_DB_NAME ?? 'control_plane',
  });

  try {
    const existing = await pool.query(
      `SELECT id FROM edge_administrators
       WHERE external_identity_id = $1 OR lower(email) = lower($2)
       LIMIT 1`,
      [EXTERNAL_ID, EMAIL],
    );

    let adminId: string;
    if (existing.rows[0]) {
      adminId = String(existing.rows[0].id);
      await pool.query(
        `UPDATE edge_administrators SET
           external_identity_id = $2,
           email = $3,
           display_name = $4,
           status = 'ACTIVE',
           email_verified = TRUE,
           updated_at = NOW()
         WHERE id = $1`,
        [adminId, EXTERNAL_ID, EMAIL, DISPLAY],
      );
      console.log(`Updated Edge administrator ${adminId}`);
    } else {
      const inserted = await pool.query(
        `INSERT INTO edge_administrators (
           external_identity_id, email, display_name, preferred_language, timezone,
           status, email_verified, mfa_enrolled
         ) VALUES ($1,$2,$3,'en','UTC','ACTIVE',TRUE,FALSE)
         RETURNING id`,
        [EXTERNAL_ID, EMAIL, DISPLAY],
      );
      adminId = String(inserted.rows[0].id);
      console.log(`Created Edge administrator ${adminId}`);
    }

    const role = await pool.query(
      `SELECT id FROM edge_roles WHERE code = 'EDGE_PLATFORM_SUPER_ADMIN' LIMIT 1`,
    );
    if (!role.rows[0]) {
      throw new Error('EDGE_PLATFORM_SUPER_ADMIN role missing — run control-plane migrations');
    }

    await pool.query(
      `INSERT INTO edge_role_assignments (administrator_id, role_id, assigned_by)
       SELECT $1, $2, $1
       WHERE NOT EXISTS (
         SELECT 1 FROM edge_role_assignments
         WHERE administrator_id = $1 AND role_id = $2 AND revoked_at IS NULL
           AND membership_id IS NULL
       )`,
      [adminId, role.rows[0].id],
    );

    console.log('Assigned EDGE_PLATFORM_SUPER_ADMIN (includes platform:marketing:*)');
    console.log('E2E login: EDGE_E2E_USERNAME=edge-e2e EDGE_E2E_PASSWORD=password EDGE_E2E_AUTH=1');
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
