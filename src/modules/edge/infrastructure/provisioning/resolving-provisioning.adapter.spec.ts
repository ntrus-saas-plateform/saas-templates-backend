import { ResolvingSubscriptionProvisioningAdapter } from './resolving-provisioning.adapter.js';
import { UnavailableSubscriptionProvisioningAdapter } from '../subscription/unavailable-provisioning.adapter.js';
import type { DurableSubscriptionProvisioningAdapter } from './durable-provisioning.adapter.js';
import type { EnvironmentConfig } from '../../../../shared/configuration/environment.schema.js';

describe('ResolvingSubscriptionProvisioningAdapter (C-02)', () => {
  const unavailable = new UnavailableSubscriptionProvisioningAdapter();
  const durable = {
    requestProvisioning: vi.fn(async () => ({
      outcome: 'ACCEPTED' as const,
      externalRef: 'req-1',
    })),
    completeProvisioning: vi.fn(async () => ({
      outcome: 'UNAVAILABLE' as const,
      failureCode: 'X',
      failureMessage: 'no',
    })),
  } as unknown as DurableSubscriptionProvisioningAdapter;

  it('defaults to Unavailable when flag is unavailable', async () => {
    const adapter = new ResolvingSubscriptionProvisioningAdapter(
      { EDGE_P7_PROVISIONING_ADAPTER: 'unavailable' } as EnvironmentConfig,
      unavailable,
      durable,
    );
    const result = await adapter.requestProvisioning({
      subscriptionId: 's',
      subscriptionNumber: 'SN',
      accountId: 'a',
      productId: 'p',
      correlationId: 'c',
    });
    expect(result.outcome).toBe('UNAVAILABLE');
    expect(durable.requestProvisioning).not.toHaveBeenCalled();
  });

  it('routes to durable when flag enabled', async () => {
    const adapter = new ResolvingSubscriptionProvisioningAdapter(
      { EDGE_P7_PROVISIONING_ADAPTER: 'durable' } as EnvironmentConfig,
      unavailable,
      durable,
    );
    const result = await adapter.requestProvisioning({
      subscriptionId: 's',
      subscriptionNumber: 'SN',
      accountId: 'a',
      productId: 'p',
      correlationId: 'c',
      payload: { authorization: { authorization_id: 'x' } },
    });
    expect(result.outcome).toBe('ACCEPTED');
    expect(durable.requestProvisioning).toHaveBeenCalled();
  });
});
