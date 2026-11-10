import { UnavailableSubscriptionBillingAdapter } from './unavailable-billing.adapter.js';

describe('UnavailableSubscriptionBillingAdapter', () => {
  const adapter = new UnavailableSubscriptionBillingAdapter();

  it('returns UNAVAILABLE for requestCoordination', async () => {
    const result = await adapter.requestCoordination({
      subscriptionId: 'sub-1',
      subscriptionNumber: 'SUB-1001',
      accountId: 'acc-1',
      productId: 'prod-1',
      correlationId: 'corr-1',
    });
    expect(result.outcome).toBe('UNAVAILABLE');
    if (result.outcome === 'UNAVAILABLE') {
      expect(result.failureCode).toBe('PROVIDER_NOT_CONFIGURED');
    }
  });

  it('returns UNAVAILABLE for confirmCoordination', async () => {
    const result = await adapter.confirmCoordination({
      coordinationId: 'c-1',
      subscriptionId: 'sub-1',
    });
    expect(result.outcome).toBe('UNAVAILABLE');
  });
});
