import { describe, expect, it, vi } from 'vitest';
import { LabBbProvisioningAdapter } from './lab-bb-provisioning.adapter.js';
import type { ControlV1BusinessBackendClient } from '../product-control/control-v1-business-backend.client.js';

describe('LabBbProvisioningAdapter', () => {
  const baseInput = {
    subscriptionId: 'sub-1',
    subscriptionNumber: 'SN-1',
    accountId: 'acc-1',
    productId: 'prod-pharmacy',
    correlationId: 'corr-lab-bb-01',
  };

  it('returns DEPENDENCY_UNAVAILABLE when client is unconfigured', async () => {
    const client = {
      isConfigured: () => false,
      provision: vi.fn(),
      getTenantReady: vi.fn(),
    } as unknown as ControlV1BusinessBackendClient;

    const adapter = new LabBbProvisioningAdapter(client);
    const result = await adapter.requestProvisioning(baseInput);

    expect(result.outcome).toBe('UNAVAILABLE');
    if (result.outcome === 'UNAVAILABLE') {
      expect(result.failureCode).toBe('DEPENDENCY_UNAVAILABLE');
    }
    expect(client.provision).not.toHaveBeenCalled();
  });

  it('ACCEPTED with externalRef=tenantId on HTTP 2xx', async () => {
    const provision = vi.fn(async () => ({
      ok: true,
      status: 201,
      body: { status: 'accepted' },
      text: '',
    }));
    const client = {
      isConfigured: () => true,
      provision,
      getTenantReady: vi.fn(),
    } as unknown as ControlV1BusinessBackendClient;

    const adapter = new LabBbProvisioningAdapter(client);
    const result = await adapter.requestProvisioning({
      ...baseInput,
      payload: { tenantId: 'tenant-fixed-1', productId: 'prod-pharmacy' },
    });

    expect(result.outcome).toBe('ACCEPTED');
    if (result.outcome === 'ACCEPTED') {
      expect(result.externalRef).toBe('tenant-fixed-1');
    }
    expect(provision).toHaveBeenCalledOnce();
    const [body, idem] = provision.mock.calls[0]!;
    expect(body.tenant_id).toBe('tenant-fixed-1');
    expect(body.product_id).toBe('prod-pharmacy');
    expect(body.account_id).toBe('acc-1');
    expect(body.note).toBe('lab_bb');
    expect(body.initial_admin_contact?.email).toMatch(/@example\.invalid$/);
    expect(idem).toBe('corr-lab-bb-01');
  });

  it('UNAVAILABLE on BB provision failure', async () => {
    const client = {
      isConfigured: () => true,
      provision: vi.fn(async () => ({
        ok: false,
        status: 503,
        body: {},
        text: 'backend down',
      })),
      getTenantReady: vi.fn(),
    } as unknown as ControlV1BusinessBackendClient;

    const adapter = new LabBbProvisioningAdapter(client);
    const result = await adapter.requestProvisioning(baseInput);

    expect(result.outcome).toBe('UNAVAILABLE');
    if (result.outcome === 'UNAVAILABLE') {
      expect(result.failureCode).toBe('HTTP_503');
      expect(result.failureMessage).toMatch(/503/);
    }
  });

  it('completeProvisioning COMPLETE when tenant ready', async () => {
    const client = {
      isConfigured: () => true,
      provision: vi.fn(),
      getTenantReady: vi.fn(async () => ({
        ok: true,
        status: 200,
        body: { ready: true },
        text: '',
      })),
    } as unknown as ControlV1BusinessBackendClient;

    const adapter = new LabBbProvisioningAdapter(client);
    const result = await adapter.completeProvisioning({
      requestId: 'req-1',
      subscriptionId: 'sub-1',
      tenantRef: 'tenant-ready-1',
    });

    expect(result.outcome).toBe('COMPLETE');
    if (result.outcome === 'COMPLETE') {
      expect(result.completedAt).toBeTruthy();
    }
  });

  it('completeProvisioning NOT_COMPLETE when ready=false', async () => {
    const client = {
      isConfigured: () => true,
      provision: vi.fn(),
      getTenantReady: vi.fn(async () => ({
        ok: true,
        status: 200,
        body: { ready: false },
        text: '',
      })),
    } as unknown as ControlV1BusinessBackendClient;

    const adapter = new LabBbProvisioningAdapter(client);
    const result = await adapter.completeProvisioning({
      requestId: 'req-1',
      subscriptionId: 'sub-1',
      externalRef: 'tenant-pending-1',
    });

    expect(result.outcome).toBe('NOT_COMPLETE');
  });
});
