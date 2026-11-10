import { describe, expect, it } from 'vitest';
import { UnavailablePaymentProviderAdapter } from './unavailable-payment.adapter.js';

describe('UnavailablePaymentProviderAdapter', () => {
  const adapter = new UnavailablePaymentProviderAdapter();

  it('never returns SUCCEEDED on createPaymentIntent', async () => {
    const result = await adapter.createPaymentIntent({
      billingAccountId: 'acc-1',
      amount: '10.00',
      currency: 'USD',
      correlationId: 'corr-1',
    });
    expect(result.outcome).toBe('UNAVAILABLE');
    if (result.outcome === 'UNAVAILABLE') {
      expect(result.failureCode).toBe('PROVIDER_NOT_CONFIGURED');
    }
  });

  it('never confirms without provider', async () => {
    const result = await adapter.confirmPaymentIntent({
      provider: 'none',
      providerIntentRef: 'pi_x',
      correlationId: 'corr-2',
    });
    expect(result.outcome).toBe('UNAVAILABLE');
  });

  it('fetchPaymentStatus is UNAVAILABLE', async () => {
    const result = await adapter.fetchPaymentStatus({
      provider: 'none',
      providerIntentRef: 'pi_x',
    });
    expect(result.outcome).toBe('UNAVAILABLE');
  });
});
