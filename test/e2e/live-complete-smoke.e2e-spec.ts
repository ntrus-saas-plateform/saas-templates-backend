/**
 * Live-complete lab smoke — SKIPPED by default.
 *
 * Enable against a running lab:
 *   LIVE_COMPLETE_E2E=1 EDGE_API_URL=http://localhost:3000 pnpm test:e2e -- test/e2e/live-complete-smoke.e2e-spec.ts
 *
 * Does not claim full golden-path docker E2E; only probes liveness + live-complete status existence.
 */
import { describe, expect, it } from 'vitest';

// skipUnless(LIVE_COMPLETE_E2E=1) ≈ skipIf(env !== '1')
describe.skipIf(process.env.LIVE_COMPLETE_E2E !== '1')(
  'Live-complete smoke (lab opt-in; set LIVE_COMPLETE_E2E=1 to enable)',
  () => {
    const base = () => process.env.EDGE_API_URL?.replace(/\/+$/, '');

    it('GET EDGE_API_URL/liveness returns 200 when lab is up', async () => {
      const root = base();
      expect(root, 'Set EDGE_API_URL when LIVE_COMPLETE_E2E=1').toBeTruthy();

      const res = await fetch(`${root}/liveness`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(10_000),
      });

      expect(res.status).toBe(200);
    });

    it('GET /api/v1/edge/live-complete/status exists (200 or 401/403, never 404)', async () => {
      const root = base();
      expect(root, 'Set EDGE_API_URL when LIVE_COMPLETE_E2E=1').toBeTruthy();

      const res = await fetch(`${root}/api/v1/edge/live-complete/status`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(10_000),
      });

      // Endpoint is auth-gated; without token 401/403 still proves the route exists.
      expect([200, 401, 403]).toContain(res.status);
      expect(res.status).not.toBe(404);
    });

    it('POST /api/v1/edge/billing/collections/dunning-scan exists (never 404)', async () => {
      const root = base();
      expect(root, 'Set EDGE_API_URL when LIVE_COMPLETE_E2E=1').toBeTruthy();

      const res = await fetch(`${root}/api/v1/edge/billing/collections/dunning-scan`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ limit: 1 }),
        signal: AbortSignal.timeout(10_000),
      });

      expect([200, 401, 403]).toContain(res.status);
      expect(res.status).not.toBe(404);
    });
  },
);
