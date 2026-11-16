import { describe, expect, it, vi } from 'vitest';
import type { ControlV1BusinessBackendClient } from '../product-control/control-v1-business-backend.client.js';
import { ControlV1TenantRuntimeStatusAdapter } from './control-v1-tenant-runtime-status.adapter.js';
import { UnavailableTenantRuntimeStatusAdapter } from './unavailable-tenant-runtime-status.adapter.js';

describe('UnavailableTenantRuntimeStatusAdapter', () => {
  it('always returns ready false UNAVAILABLE', async () => {
    const adapter = new UnavailableTenantRuntimeStatusAdapter();
    await expect(adapter.isTenantReady('t1')).resolves.toEqual({
      ready: false,
      source: 'UNAVAILABLE',
    });
  });
});

describe('ControlV1TenantRuntimeStatusAdapter', () => {
  it('ready true only on HTTP 200 with body.ready true', async () => {
    const client = {
      isConfigured: () => true,
      getTenantReady: vi.fn(async () => ({
        ok: true,
        status: 200,
        body: { ready: true, status: 'active' },
        text: '',
      })),
    } as unknown as ControlV1BusinessBackendClient;

    const adapter = new ControlV1TenantRuntimeStatusAdapter(client);
    await expect(adapter.isTenantReady('tenant-1')).resolves.toEqual({
      ready: true,
      source: 'CONTROL_V1',
      detail: undefined,
    });
  });

  it('never invents true on non-200', async () => {
    const client = {
      isConfigured: () => true,
      getTenantReady: vi.fn(async () => ({
        ok: false,
        status: 503,
        body: { ready: false },
        text: '',
      })),
    } as unknown as ControlV1BusinessBackendClient;

    const adapter = new ControlV1TenantRuntimeStatusAdapter(client);
    const result = await adapter.isTenantReady('tenant-1');
    expect(result.ready).toBe(false);
    expect(result.source).toBe('CONTROL_V1');
  });

  it('never invents true on transport errors', async () => {
    const client = {
      isConfigured: () => true,
      getTenantReady: vi.fn(async () => {
        throw new Error('network down');
      }),
    } as unknown as ControlV1BusinessBackendClient;

    const adapter = new ControlV1TenantRuntimeStatusAdapter(client);
    const result = await adapter.isTenantReady('tenant-1');
    expect(result).toEqual({
      ready: false,
      source: 'CONTROL_V1',
      detail: 'network down',
    });
  });
});
