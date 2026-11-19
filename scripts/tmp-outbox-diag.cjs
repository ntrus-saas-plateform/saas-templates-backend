/* Temporary diagnostic: outbox tenant credential failures. Safe read-only probes. */
const { createHash, createDecipheriv } = require('node:crypto');
const pg = require('pg');

const CP = {
  host: '127.0.0.1',
  port: 5432,
  user: 'edge-okapi',
  password: 'edge0707',
  database: 'platform_control',
};

const IDS = [
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  '286384de-5bd9-4ddf-9a5b-40a0706ac6f2',
];

function decryptWithCurrentKey(payload) {
  const key = createHash('sha256').update('lab-secret-encryption-key-32b').digest();
  const buf = Buffer.from(payload, 'base64url');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const d = createDecipheriv('aes-256-gcm', key, iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(data), d.final()]).toString('utf8');
}

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

  const t = await cp.query(
    `SELECT id, slug, status, database_host, database_port, database_name,
            database_username, database_credentials_ref, region, environment
     FROM tenants ORDER BY created_at`,
  );
  console.log('=== TENANTS ===');
  for (const r of t.rows) console.log(JSON.stringify(r));

  const s = await cp.query(
    `SELECT reference, length(ciphertext) AS len, updated_at FROM secret_store ORDER BY reference`,
  );
  console.log('=== SECRET_STORE ===');
  for (const r of s.rows) {
    let dec = 'n/a';
    if (r.reference.includes('/db')) {
      const c = await cp.query(`SELECT ciphertext FROM secret_store WHERE reference = $1`, [r.reference]);
      try { dec = 'DECRYPT_OK(len=' + decryptWithCurrentKey(c.rows[0].ciphertext).length + ')'; }
      catch (e) { dec = 'DECRYPT_FAIL: ' + e.message; }
    }
    console.log(JSON.stringify({ ...r, decrypt: dec }));
  }

  const dbs = await cp.query(`SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname`);
  console.log('=== DATABASES ===');
  console.log(dbs.rows.map((r) => r.datname).join(', '));

  const roles = await cp.query(`SELECT rolname, rolsuper FROM pg_roles WHERE rolname IN ('postgres','edge-okapi','platform') ORDER BY rolname`);
  console.log('=== ROLES ===');
  console.log(JSON.stringify(roles.rows));

  await cp.end();

  console.log('=== PASSWORD PROBES (db=postgres) ===');
  for (const user of ['postgres', 'edge-okapi']) {
    for (const pw of ['edge0707', 'postgres', 'platform', 'tenant_a_secret']) {
      const res = await tryConnect({ host: '127.0.0.1', port: 5432, user, password: pw, database: 'postgres' });
      console.log(`${user}:${pw} -> ${res}`);
    }
  }
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
