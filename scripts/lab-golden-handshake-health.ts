/**
 * Lab golden: control/v1 discover → identity → health → ready (platform).
 *
 * Uses EDGE_BB_CONTROL_BASE_URL + EDGE_BB_CONTROL_TOKEN (lab opaque).
 *
 *   pnpm exec tsx scripts/lab-golden-handshake-health.ts
 */
import { loadEnvFile } from './load-env.js';

loadEnvFile();

const base = (process.env.EDGE_BB_CONTROL_BASE_URL ?? '').replace(/\/$/, '');
const token =
  process.env.EDGE_BB_CONTROL_TOKEN ??
  process.env.EDGE_CONTROL_LAB_TOKEN ??
  process.env.EDGE_CONTROL_BEARER ??
  '';

function headers(): Record<string, string> {
  const h: Record<string, string> = { Accept: 'application/json' };
  if (token) {
    h['X-Edge-Control-Token'] = token;
    h.Authorization = `Bearer ${token}`;
  }
  return h;
}

async function probe(path: string): Promise<{ path: string; status: number; ms: number; ok: boolean }> {
  const t0 = Date.now();
  const res = await fetch(`${base}${path}`, { headers: headers() });
  return {
    path,
    status: res.status,
    ms: Date.now() - t0,
    ok: res.ok,
  };
}

async function main(): Promise<void> {
  if (!base) {
    console.log(
      JSON.stringify({
        status: 'SKIPPED',
        reason: 'EDGE_BB_CONTROL_BASE_URL unset',
        steps: ['discover', 'identity', 'health', 'ready'],
      }),
    );
    process.exit(0);
  }

  const steps = [] as Array<Record<string, unknown>>;
  for (const p of [
    '/control/v1/discover',
    '/control/v1/identity',
    '/control/v1/health',
    '/control/v1/ready',
  ]) {
    steps.push(await probe(p));
  }

  const allOk = steps.every((s) => s.ok === true);
  const authBlocked = steps.some((s) => s.status === 401 || s.status === 403);

  console.log(
    JSON.stringify(
      {
        status: allOk ? 'PASS' : authBlocked ? 'BLOCKED_AUTH' : 'FAIL',
        base,
        tokenPresent: Boolean(token),
        steps,
        note: allOk
          ? 'Golden handshake→health PASS (lab token)'
          : 'Set EDGE_BB_CONTROL_TOKEN to match BB EDGE_CONTROL_LAB_TOKEN',
      },
      null,
      2,
    ),
  );
  process.exit(allOk ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
