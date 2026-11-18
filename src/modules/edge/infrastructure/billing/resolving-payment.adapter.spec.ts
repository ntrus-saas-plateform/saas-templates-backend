import { describe, expect, it, vi } from 'vitest';
import { ResolvingPaymentProviderAdapter } from './resolving-payment.adapter.js';
import type { EnvironmentConfig } from '../../../../shared/configuration/environment.schema.js';

function makeAdapter(config: Partial<EnvironmentConfig>) {
  const unavailable = {
    createPaymentIntent: vi.fn(async () => ({
      outcome: 'UNAVAILABLE',
      failureCode: 'UNAVAILABLE',
      failureMessage: 'unavailable',
    })),
  };
  const httpWebhook = {
    createPaymentIntent: vi.fn(async () => ({
      outcome: 'REQUESTED',
      provider: 'http_webhook',
      providerIntentRef: 'wh_1',
    })),
  };
  const sandbox = {
    createPaymentIntent: vi.fn(async () => ({
      outcome: 'REQUESTED',
      provider: 'sandbox',
      providerIntentRef: 'sandbox_1',
    })),
  };
  const hyperswitch = {
    createPaymentIntent: vi.fn(async () => ({
      outcome: 'REQUESTED',
      provider: 'hyperswitch',
      providerIntentRef: 'hs_1',
    })),
  };
  const adapter = new ResolvingPaymentProviderAdapter(
    config as EnvironmentConfig,
    unavailable as never,
    httpWebhook as never,
    sandbox as never,
    hyperswitch as never,
  );
  return { adapter, unavailable, httpWebhook, sandbox, hyperswitch };
}

describe('ResolvingPaymentProviderAdapter multi-PSP routing', () => {
  const input = {
    billingAccountId: 'ba-1',
    amount: '10.00',
    currency: 'USD',
    correlationId: 'corr-psp',
  };

  it('routes sandbox only when explicitly configured', async () => {
    const { adapter, sandbox, httpWebhook } = makeAdapter({
      BILLING_PAYMENT_ADAPTER: 'sandbox',
    });
    await adapter.createPaymentIntent(input);
    expect(sandbox.createPaymentIntent).toHaveBeenCalledOnce();
    expect(httpWebhook.createPaymentIntent).not.toHaveBeenCalled();
  });

  it('routes http_webhook when configured', async () => {
    const { adapter, httpWebhook, sandbox } = makeAdapter({
      BILLING_PAYMENT_ADAPTER: 'http_webhook',
      BILLING_PAYMENT_WEBHOOK_URL: 'https://psp.example/hook',
    });
    await adapter.createPaymentIntent(input);
    expect(httpWebhook.createPaymentIntent).toHaveBeenCalledOnce();
    expect(sandbox.createPaymentIntent).not.toHaveBeenCalled();
  });

  it('auto never selects sandbox; falls back unavailable without webhook URL', async () => {
    const { adapter, unavailable, sandbox } = makeAdapter({
      BILLING_PAYMENT_ADAPTER: 'auto',
    });
    await adapter.createPaymentIntent(input);
    expect(unavailable.createPaymentIntent).toHaveBeenCalledOnce();
    expect(sandbox.createPaymentIntent).not.toHaveBeenCalled();
  });

  it('auto selects http_webhook when URL present', async () => {
    const { adapter, httpWebhook, sandbox } = makeAdapter({
      BILLING_PAYMENT_ADAPTER: 'auto',
      BILLING_PAYMENT_WEBHOOK_URL: 'https://psp.example/hook',
    });
    await adapter.createPaymentIntent(input);
    expect(httpWebhook.createPaymentIntent).toHaveBeenCalledOnce();
    expect(sandbox.createPaymentIntent).not.toHaveBeenCalled();
  });

  it('routes hyperswitch orchestration adapter when configured', async () => {
    const { adapter, hyperswitch, sandbox } = makeAdapter({
      BILLING_PAYMENT_ADAPTER: 'hyperswitch',
    });
    await adapter.createPaymentIntent(input);
    expect(hyperswitch.createPaymentIntent).toHaveBeenCalledOnce();
    expect(sandbox.createPaymentIntent).not.toHaveBeenCalled();
  });
});
