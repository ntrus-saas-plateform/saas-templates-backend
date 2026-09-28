import pg from 'pg';
import { loadEnvFile } from './load-env.js';

loadEnvFile();

const cfg = {
  host: process.env.CONTROL_PLANE_DB_HOST ?? '127.0.0.1',
  port: Number(process.env.CONTROL_PLANE_DB_PORT ?? 5432),
  user: process.env.CONTROL_PLANE_DB_USER ?? 'postgres',
  password: process.env.CONTROL_PLANE_DB_PASSWORD ?? 'postgres',
  database: 'postgres',
};

const names = [
  process.env.CONTROL_PLANE_DB_NAME ?? 'platform_control',
  'tenant_a',
  'tenant_b',
];

const c = new pg.Client(cfg);
await c.connect();
for (const name of names) {
  if (!/^[a-z][a-z0-9_]*$/i.test(name)) throw new Error(name);
  const r = await c.query('SELECT 1 FROM pg_database WHERE datname = $1', [name]);
  if (!r.rowCount) {
    await c.query(`CREATE DATABASE ${name}`);
    console.log('created', name);
  } else {
    console.log('exists', name);
  }
}
await c.end();
