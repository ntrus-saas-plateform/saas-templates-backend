/**
 * Live-complete lab smoke — SKIPPED by default.
 *
 * Enable against a running lab:
 *   LIVE_COMPLETE_E2E=1 EDGE_API_URL=http://localhost:3000 pnpm test:e2e -- test/e2e/live-complete-smoke.e2e-spec.ts
 *
 * Does not claim full golden-path docker E2E; only hits GET /liveness when enabled.
 */
import { describe, expect, it } from 'vitest';

// skipUnless(LIVE_COMPLETE_E2E=1) ≈ skipIf(env !== '1')
describe.skipIf(process.env.LIVE_COMPLETE_E2E !== '1')(
  'Live-complete smoke (lab opt-in; set LIVE_COMPLETE_E2E=1 to enable)',
  () => {
    it('GET EDGE_API_URL/liveness returns 200 when lab is up', async () => {
      const base = process.env.EDGE_API_URL?.replace(/\/+$/, '');
      expect(base, 'Set EDGE_API_URL when LIVE_COMPLETE_E2E=1').toBeTruthy();

      const res = await fetch(`${base}/liveness`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(10_000),
      });

      expect(res.status).toBe(200);
    });
  },
);
