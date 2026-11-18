/**
 * RGOM G10 / doc 33 — load smoke provision → ready (beachhead).
 *
 * Env:
 *   EDGE_BB_CONTROL_BASE_URL  — required for live smoke
 *   EDGE_CONTROL_BEARER       — M2M bearer (optional if BB accepts lab token)
 *   LOAD_SMOKE_N              — iterations (default 20)
 *   LOAD_SMOKE_TENANT_PREFIX  — synthetic tenant id prefix (default smoke-)
 *
 * Fail-closed rules checked:
 *   - empty entitlements → ready must be false / rejected
 *   - NODE_ENV=production + lab_bb adapter → refuse to run
 */
import { loadEnvFile } from './load-env.js';

loadEnvFile();

const base = (process.env.EDGE_BB_CONTROL_BASE_URL ?? '').replace(/\/$/, '');
const bearer =
  process.env.EDGE_BB_CONTROL_TOKEN ??
  process.env.EDGE_CONTROL_LAB_TOKEN ??
  process.env.EDGE_CONTROL_BEARER ??
  process.env.EDGE_M2M_BEARER ??
  '';
const n = Math.max(1, Number(process.env.LOAD_SMOKE_N ?? 20));
const prefix = process.env.LOAD_SMOKE_TENANT_PREFIX ?? 'smoke-';

if (process.env.NODE_ENV === 'production' && process.env.EDGE_P7_PROVISIONING_ADAPTER === 'lab_bb') {
  console.error('REFUSE: lab_bb forbidden in production (RGOM-E7.1).');
  process.exit(2);
}

if (!base) {
  console.log(
    JSON.stringify({
      status: 'SKIPPED',
      reason: 'EDGE_BB_CONTROL_BASE_URL unset — dry checklist only',
      criteria: {
        emptyEntitlementsReadyFalse: 'required 100%',
        p95ReadyMs: 2000,
        iterations: n,
      },
    }),
  );
  process.exit(0);
}

type Sample = { ok: boolean; ms: number; note: string };

function controlHeaders(extra?: Record<string, string>): Record<string, string> {
  const h: Record<string, string> = { ...(extra ?? {}) };
  if (bearer) {
    h.Authorization = `Bearer ${bearer}`;
    h['X-Edge-Control-Token'] = bearer;
  }
  return h;
}

async function ready(tenantId: string): Promise<Sample> {
  const t0 = Date.now();
  const res = await fetch(`${base}/control/v1/tenants/${encodeURIComponent(tenantId)}/ready`, {
    headers: controlHeaders(),
  });
  const ms = Date.now() - t0;
  const body = (await res.json().catch(() => ({}))) as { ready?: boolean; reason?: string };
  return {
    ok: res.ok,
    ms,
    note: `status=${res.status} ready=${String(body.ready)} reason=${body.reason ?? ''}`,
  };
}

async function putEmptyEntitlements(tenantId: string): Promise<Sample> {
  const t0 = Date.now();
  const res = await fetch(
    `${base}/control/v1/tenants/${encodeURIComponent(tenantId)}/entitlements`,
    {
      method: 'PUT',
      headers: controlHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ entitlements: {}, contentHash: 'smoke-empty' }),
    },
  );
  const ms = Date.now() - t0;
  return {
    ok: res.status >= 400, // reject empty = PASS
    ms,
    note: `empty-put status=${res.status}`,
  };
}

function p95(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1);
  return sorted[idx] ?? 0;
}

async function main(): Promise<void> {
  const readyLatencies: number[] = [];
  let emptyRejectPass = 0;
  let readyFalseOnEmpty = 0;
  const failures: string[] = [];

  for (let i = 0; i < n; i++) {
    const tenantId = `${prefix}${i}`;
    const empty = await putEmptyEntitlements(tenantId);
    if (empty.ok) emptyRejectPass += 1;
    else failures.push(`${tenantId}: empty entitlements accepted`);

    const r = await ready(tenantId);
    readyLatencies.push(r.ms);
    if (!r.ok || r.note.includes('ready=false') || r.note.includes('ready=undefined')) {
      readyFalseOnEmpty += 1;
    } else if (r.note.includes('ready=true')) {
      failures.push(`${tenantId}: ready=true with empty/missing projection`);
    }
  }

  const report = {
    status: failures.length === 0 ? 'PASS' : 'FAIL',
    iterations: n,
    emptyEntitlementsRejected: `${emptyRejectPass}/${n}`,
    readyNotTrueOnEmpty: `${readyFalseOnEmpty}/${n}`,
    p95ReadyMs: p95(readyLatencies),
    thresholdP95Ms: 2000,
    failures,
  };

  console.log(JSON.stringify(report, null, 2));
  if (report.status !== 'PASS' || report.p95ReadyMs > 2000) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
