import { describe, expect, it, vi } from 'vitest';
import { BbControlProvisioningAdapter } from './bb-control-provisioning.adapter.js';
import type { ControlV1BusinessBackendClient } from '../product-control/control-v1-business-backend.client.js';
import type { EnvironmentConfig } from '../../../../shared/configuration/environment.schema.js';

describe('BbControlProvisioningAdapter', () => {
  const config = { NODE_ENV: 'production' } as EnvironmentConfig;

  it('refuses empty entitlements', async () => {
    const client = {
      isConfigured: () => true,
      provision: vi.fn(),
    } as unknown as ControlV1BusinessBackendClient;
    const adapter = new BbControlProvisioningAdapter(client, config);
    const result = await adapter.requestProvisioning({
      subscriptionId: 's',
      subscriptionNumber: 'SN',
      accountId: 'a',
      productId: 'SYNTIX_PHARMA',
      correlationId: 'corr-12345678',
      payload: { entitlements: {}, grants: [] },
    });
    expect(result.outcome).toBe('UNAVAILABLE');
    expect(result).toMatchObject({
      outcome: 'UNAVAILABLE',
      failureCode: 'EMPTY_ENTITLEMENTS_FORBIDDEN',
    });
    expect(client.provision).not.toHaveBeenCalled();
  });

  it('provisions with non-empty entitlements and profile', async () => {
    const client = {
      isConfigured: () => true,
      provision: vi.fn(async () => ({ ok: true, status: 201, body: {}, text: '' })),
    } as unknown as ControlV1BusinessBackendClient;
    const adapter = new BbControlProvisioningAdapter(client, config);
    const result = await adapter.requestProvisioning({
      subscriptionId: 's',
      subscriptionNumber: 'SN',
      accountId: 'a',
      productId: 'SYNTIX_PHARMA',
      correlationId: 'corr-12345678',
      payload: {
        entitlements: { modules: { pharmacy: true }, capabilities: { PHARMACY: true } },
        grants: [{ code: 'pharmacy', enabled: true }],
        adminEmail: 'ops@example.com',
      },
    });
    expect(result.outcome).toBe('ACCEPTED');
    expect(client.provision).toHaveBeenCalled();
    const body = (client.provision as ReturnType<typeof vi.fn>).mock.calls[0]![0] as Record<
      string,
      unknown
    >;
    expect(body.profile_code).toBe('PHARMACY');
    expect(body.note).toBe('bb_control');
  });
});
