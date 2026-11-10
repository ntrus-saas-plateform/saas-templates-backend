import { UnavailableSubscriptionProvisioningAdapter } from './unavailable-provisioning.adapter.js';

describe('UnavailableSubscriptionProvisioningAdapter', () => {
  const adapter = new UnavailableSubscriptionProvisioningAdapter();

  it('returns UNAVAILABLE for requestProvisioning', async () => {
    const result = await adapter.requestProvisioning({
      subscriptionId: 'sub-1',
      subscriptionNumber: 'SUB-1001',
      accountId: 'acc-1',
      productId: 'prod-1',
      correlationId: 'corr-1',
    });
    expect(result.outcome).toBe('UNAVAILABLE');
  });

  it('returns UNAVAILABLE for completeProvisioning', async () => {
    const result = await adapter.completeProvisioning({
      requestId: 'r-1',
      subscriptionId: 'sub-1',
    });
    expect(result.outcome).toBe('UNAVAILABLE');
  });
});
