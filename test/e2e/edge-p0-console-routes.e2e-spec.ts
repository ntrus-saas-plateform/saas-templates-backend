/**
 * Edge console P0 route-existence smoke — SKIPPED by default.
 *
 * Enable against a running Edge API lab:
 *   EDGE_P0_E2E=1 EDGE_API_URL=http://localhost:3000 pnpm test:e2e -- test/e2e/edge-p0-console-routes.e2e-spec.ts
 *
 * Honest scope: proves critical P0 routes exist (not 404). Without a bearer token,
 * 401/403 still counts as route presence. Does NOT claim full handshake→health lab golden path.
 */
import { describe, expect, it } from 'vitest';

const enabled = process.env.EDGE_P0_E2E === '1';

describe.skipIf(!enabled)(
  'Edge P0 console routes smoke (lab opt-in; set EDGE_P0_E2E=1)',
  () => {
    const base = () => process.env.EDGE_API_URL?.replace(/\/+$/, '');

    async function probe(
      method: 'GET' | 'POST',
      path: string,
      body?: Record<string, unknown>,
    ) {
      const root = base();
      expect(root, 'Set EDGE_API_URL when EDGE_P0_E2E=1').toBeTruthy();
      const res = await fetch(`${root}${path}`, {
        method,
        headers: {
          Accept: 'application/json',
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(15_000),
      });
      expect(res.status, `${method} ${path} must not 404`).not.toBe(404);
      expect([200, 201, 400, 401, 403, 422]).toContain(res.status);
      return res;
    }

    it('liveness', async () => {
      const root = base();
      expect(root).toBeTruthy();
      const res = await fetch(`${root}/liveness`, {
        signal: AbortSignal.timeout(10_000),
      });
      expect(res.status).toBe(200);
    });

    it('P0 auth/admins list route exists', async () => {
      await probe('GET', '/api/v1/edge/administrators?limit=1');
    });

    it('P0 catalog products list route exists', async () => {
      await probe('GET', '/api/v1/edge/products?limit=1');
    });

    it('P0 verticals list route exists', async () => {
      await probe('GET', '/api/v1/edge/verticals?limit=1');
    });

    it('P0 tenants list route exists', async () => {
      await probe('GET', '/api/v1/edge/tenants?limit=1');
    });

    it('P0 product-control endpoints list route exists', async () => {
      await probe('GET', '/api/v1/edge/product-controls/endpoints?limit=1');
    });

    it('P0 product-control handshake route exists (fake UUID → not 404)', async () => {
      const id = '00000000-0000-4000-8000-000000000001';
      await probe('POST', `/api/v1/edge/product-controls/endpoints/${id}/handshake`, {});
    });

    it('P0 product-control health-check route exists (fake UUID → not 404)', async () => {
      const id = '00000000-0000-4000-8000-000000000001';
      await probe('POST', `/api/v1/edge/product-controls/endpoints/${id}/health-check`, {});
    });

    it('P0 provisioning-requests list route exists', async () => {
      await probe('GET', '/api/v1/edge/provisioning-requests?limit=1');
    });

    it('P0 sales opportunities list route exists', async () => {
      await probe('GET', '/api/v1/edge/sales/opportunities?limit=1');
    });

    it('P0 billing invoices list route exists', async () => {
      await probe('GET', '/api/v1/edge/billing/invoices?limit=1');
    });

    it('P0 commercial offers list route exists', async () => {
      await probe('GET', '/api/v1/edge/commercial/offers?limit=1');
    });

    it('P0 subscriptions list route exists', async () => {
      await probe('GET', '/api/v1/edge/subscriptions?limit=1');
    });

    it('P0 acquisition products list route exists', async () => {
      await probe('GET', '/api/v1/edge/acquisition/products?limit=1');
    });
  },
);
