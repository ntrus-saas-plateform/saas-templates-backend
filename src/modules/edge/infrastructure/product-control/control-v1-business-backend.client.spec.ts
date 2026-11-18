import { describe, expect, it, vi } from 'vitest';
import { ControlV1BusinessBackendClient } from './control-v1-business-backend.client.js';

describe('ControlV1BusinessBackendClient', () => {
  it('isConfigured is false without baseUrl', () => {
    const client = new ControlV1BusinessBackendClient({});
    expect(client.isConfigured()).toBe(false);
  });

  it('POST provision with Idempotency-Key and auth headers', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ status: 'provisioned' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const client = new ControlV1BusinessBackendClient({
      baseUrl: 'https://bb.example',
      token: 'lab-token',
      allowInsecureHttp: false,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const res = await client.provision(
      { tenant_id: 't1', product_id: 'pharmacy' },
      'idem-abc-12345',
    );

    expect(res.ok).toBe(true);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('provisioned');

    expect(fetchImpl).toHaveBeenCalledOnce();
    const call = fetchImpl.mock.calls[0] as unknown as [string, RequestInit] | undefined;
    expect(call).toBeDefined();
    const [url, init] = call!;
    expect(url).toBe('https://bb.example/control/v1/provision');
    expect(init?.method).toBe('POST');
    const headers = init?.headers as Record<string, string>;
    expect(headers['Idempotency-Key']).toBe('idem-abc-12345');
    expect(headers.Authorization).toBe('Bearer lab-token');
    expect(headers['X-Edge-Control-Token']).toBe('lab-token');
  });

  it('PUT entitlements with idempotency key', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ status: 'applied' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const client = new ControlV1BusinessBackendClient({
      baseUrl: 'https://bb.example',
      token: 'tok',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const res = await client.putEntitlements(
      'tenant-9',
      {
        entitlement_version: 2,
        entitlements: { modules: { pos: true } },
        grants: [{ code: 'pos', enabled: true }],
      },
      'idem-ent-1',
    );
    expect(res.ok).toBe(true);
    const call = fetchImpl.mock.calls[0] as unknown as [string, RequestInit] | undefined;
    expect(String(call?.[0])).toBe('https://bb.example/control/v1/tenants/tenant-9/entitlements');
    expect(call?.[1]?.method).toBe('PUT');
    const headers = call?.[1]?.headers as Record<string, string>;
    expect(headers['Idempotency-Key']).toBe('idem-ent-1');
  });

  it('GET tenant ready and state', async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (String(url).endsWith('/ready')) {
        return new Response(JSON.stringify({ ready: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ status: 'active' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    const client = new ControlV1BusinessBackendClient({
      baseUrl: 'http://localhost:3100',
      token: 'tok',
      allowInsecureHttp: true,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const ready = await client.getTenantReady('tenant-1');
    expect(ready.ok).toBe(true);
    expect(ready.body.ready).toBe(true);

    const state = await client.getTenantState('tenant-1');
    expect(state.body.status).toBe('active');

    const readyCall = fetchImpl.mock.calls[0] as unknown as [string] | undefined;
    const stateCall = fetchImpl.mock.calls[1] as unknown as [string] | undefined;
    expect(String(readyCall?.[0])).toContain('/control/v1/tenants/tenant-1/ready');
    expect(String(stateCall?.[0])).toContain('/control/v1/tenants/tenant-1/state');
  });
});
