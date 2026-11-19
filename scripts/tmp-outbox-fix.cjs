/* Temporary repair: outbox tenant credential failures (tenant-a/b stale username + smoke tenant undecryptable secret). */
const { createHash, createCipheriv, randomBytes, randomUUID } = require('node:crypto');
const pg = require('pg');

const CP = {
  host: '127.0.0.1',
  port: 5432,
  user: 'edge-okapi',
  password: 'edge0707',
  database: 'platform_control',
};
const ENC_KEY = 'lab-secret-encryption-key-32b';
const SMOKE_ID = '286384de-5bd9-4ddf-9a5b-40a0706ac6f2';

function encrypt(plaintext) {
  const key = createHash('sha256').update(ENC_KEY).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64url');
}

const qIdent = (v) => `"${v.replace(/"/g, '""')}"`;
const qLit = (v) => `'${v.replace(/'/g, "''")}'`;

async function tryConnect(cfg) {
  const c = new pg.Client(cfg);
  try {
    await c.connect();
    await c.query('SELECT 1');
    await c.end();
    return 'OK';
  } catch (e) {
    try { await c.end(); } catch {}
    return e.message.split('\n')[0];
  }
}

(async () => {
  const cp = new pg.Client(CP);
  await cp.connect();

  // --- Fix A: tenant-a / tenant-b → same role as local control plane (seed-dev intent) ---
  const upd = await cp.query(
    `UPDATE tenants SET database_username = $1, database_credentials_ref = 'TENANT_DB_PASSWORD', updated_at = NOW()
     WHERE id IN ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')
       AND database_username <> $1
     RETURNING id, database_username`,
    ['edge-okapi'],
  );
  console.log('FIX A rows updated:', JSON.stringify(upd.rows));

  // --- Fix B: smoke tenant → rotate per-tenant role password + re-encrypt under current key ---
  const row = (await cp.query(
    `SELECT id, slug, database_host, database_port, database_name, database_username, database_credentials_ref
     FROM tenants WHERE id = $1`,
    [SMOKE_ID],
  )).rows[0];
  if (!row) throw new Error('smoke tenant row missing');
  if (row.database_username !== 't_smoke_org_1793624799808_edge4be0') {
    console.log('smoke username changed unexpectedly:', row.database_username);
  }
  if (row.database_credentials_ref !== `secret:tenants/${SMOKE_ID}/db`) {
    console.log('smoke ref changed unexpectedly:', row.database_credentials_ref);
  }

  const roleExists = (await cp.query(
    `SELECT 1 FROM pg_roles WHERE rolname = $1`,
    [row.database_username],
  )).rowCount > 0;

  const newPassword = randomBytes(32).toString('base64url');

  if (roleExists) {
    await cp.query(`ALTER ROLE ${qIdent(row.database_username)} WITH LOGIN PASSWORD ${qLit(newPassword)}`);
    console.log('FIX B role altered:', row.database_username);
  } else {
    await cp.query(`CREATE ROLE ${qIdent(row.database_username)} WITH LOGIN PASSWORD ${qLit(newPassword)}`);
    await cp.query(`REVOKE ALL ON DATABASE ${qIdent(row.database_name)} FROM PUBLIC`);
    await cp.query(`GRANT CONNECT ON DATABASE ${qIdent(row.database_name)} TO ${qIdent(row.database_username)}`);
    await cp.query(`GRANT CONNECT ON DATABASE ${qIdent(CP.database)} TO ${qIdent(row.database_username)}`);
    console.log('FIX B role created:', row.database_username);
  }

  await cp.query(
    `INSERT INTO secret_store (reference, ciphertext, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (reference) DO UPDATE SET ciphertext = EXCLUDED.ciphertext, updated_at = NOW()`,
    [`secret:tenants/${SMOKE_ID}/db`, encrypt(newPassword)],
  );
  console.log('FIX B secret re-encrypted with current key');

  await cp.end();

  // --- Verification ---
  console.log('=== VERIFY ===');
  for (const [label, cfg] of [
    ['tenant-a as edge-okapi', { ...CP, database: 'tenant_a', user: 'edge-okapi' }],
    ['tenant-b as edge-okapi', { ...CP, database: 'tenant_b', user: 'edge-okapi' }],
    ['smoke as dedicated role', { host: row.database_host, port: row.database_port, database: row.database_name, user: row.database_username, password: newPassword }],
  ]) {
    console.log(`${label} -> ${await tryConnect(cfg)}`);
  }
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
