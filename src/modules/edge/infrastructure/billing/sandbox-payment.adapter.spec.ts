import { describe, expect, it } from 'vitest';
import { SandboxPaymentProviderAdapter } from './sandbox-payment.adapter.js';

describe('SandboxPaymentProviderAdapter', () => {
  const adapter = new SandboxPaymentProviderAdapter();

  it('create → confirm → fetch returns paid', async () => {
    const created = await adapter.createPaymentIntent({
      billingAccountId: 'acc-1',
      amount: '42.00',
      currency: 'USD',
      correlationId: 'corr-1',
    });
    expect(created.outcome).toBe('REQUESTED');
    if (created.outcome !== 'REQUESTED') return;
    expect(created.provider).toBe('sandbox');
    expect(created.providerIntentRef).toMatch(/^sandbox_pi_/);

    const confirmed = await adapter.confirmPaymentIntent({
      provider: 'sandbox',
      providerIntentRef: created.providerIntentRef,
      correlationId: 'corr-2',
    });
    expect(confirmed.outcome).toBe('SUCCEEDED');
    if (confirmed.outcome === 'SUCCEEDED') {
      expect(confirmed.status).toBe('paid');
    }

    const status = await adapter.fetchPaymentStatus({
      provider: 'sandbox',
      providerIntentRef: created.providerIntentRef,
    });
    expect(status.outcome).toBe('SUCCEEDED');
    if (status.outcome === 'SUCCEEDED') {
      expect(status.status).toBe('paid');
    }
  });

  it('confirm unknown intent returns FAILED', async () => {
    const result = await adapter.confirmPaymentIntent({
      provider: 'sandbox',
      providerIntentRef: 'sandbox_pi_missing',
      correlationId: 'corr-x',
    });
    expect(result.outcome).toBe('FAILED');
    if (result.outcome === 'FAILED') {
      expect(result.failureCode).toBe('INTENT_NOT_FOUND');
    }
  });

  it('createCustomer and attachPaymentMethod succeed with sandbox refs', async () => {
    const customer = await adapter.createCustomer({
      billingAccountId: 'acc-1',
      correlationId: 'c1',
    });
    expect(customer.outcome).toBe('SUCCEEDED');
    if (customer.outcome === 'SUCCEEDED') {
      expect(customer.providerCustomerRef).toMatch(/^sandbox_cus_/);
    }

    const method = await adapter.attachPaymentMethod({
      billingAccountId: 'acc-1',
      providerCustomerRef: 'sandbox_cus_x',
      tokenRef: 'tok',
      correlationId: 'c2',
    });
    expect(method.outcome).toBe('SUCCEEDED');
    if (method.outcome === 'SUCCEEDED') {
      expect(method.last4).toBe('4242');
    }
  });
});
