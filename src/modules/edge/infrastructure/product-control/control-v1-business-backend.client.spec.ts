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
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe('https://bb.example/control/v1/provision');
    expect(init?.method).toBe('POST');
    const headers = init?.headers as Record<string, string>;
    expect(headers['Idempotency-Key']).toBe('idem-abc-12345');
    expect(headers.Authorization).toBe('Bearer lab-token');
    expect(headers['X-Edge-Control-Token']).toBe('lab-token');
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

    expect(String(fetchImpl.mock.calls[0]![0])).toContain(
      '/control/v1/tenants/tenant-1/ready',
    );
    expect(String(fetchImpl.mock.calls[1]![0])).toContain(
      '/control/v1/tenants/tenant-1/state',
    );
  });
});
