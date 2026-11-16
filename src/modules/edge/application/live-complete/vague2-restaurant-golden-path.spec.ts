/**
 * Vague 2 — Restaurant vertical contracts (same provision chain as Pharmacy).
 * Not live docker E2E. Proves product metadata + sandbox→lab_bb path is product-agnostic.
 */
import { describe, expect, it, vi } from 'vitest';
import { SandboxPaymentProviderAdapter } from '../../infrastructure/billing/sandbox-payment.adapter.js';
import { LabBbProvisioningAdapter } from '../../infrastructure/provisioning/lab-bb-provisioning.adapter.js';
import type { ControlV1BusinessBackendClient } from '../../infrastructure/product-control/control-v1-business-backend.client.js';

describe('Vague 2 Restaurant golden-path contracts', () => {
  it('Restaurant lab product codes are distinct from Pharmacy', () => {
    const restaurant = {
      verticalCode: 'RESTAURANT',
      productCode: 'RESTAURANT_LIVE',
      metadata: { liveComplete: true, lab: 'restaurant', vague: 2 },
    };
    const pharmacy = {
      verticalCode: 'PHARMACY',
      productCode: 'PHARMACY_LIVE',
      metadata: { liveComplete: true, lab: 'pharmacy' },
    };
    expect(restaurant.productCode).not.toBe(pharmacy.productCode);
    expect(restaurant.metadata.lab).toBe('restaurant');
    expect(restaurant.metadata.vague).toBe(2);
  });

  it('same sandbox → lab_bb chain works for Restaurant correlation ids', async () => {
    const payment = new SandboxPaymentProviderAdapter();
    const created = await payment.createPaymentIntent({
      billingAccountId: 'acc-restaurant-1',
      amount: '149.00',
      currency: 'USD',
      correlationId: 'corr-rest-pay',
    });
    expect(created.outcome).toBe('REQUESTED');
    if (created.outcome !== 'REQUESTED') return;

    const confirmed = await payment.confirmPaymentIntent({
      provider: 'sandbox',
      providerIntentRef: created.providerIntentRef,
      correlationId: 'corr-rest-confirm',
    });
    expect(confirmed.outcome).toBe('SUCCEEDED');

    const provision = vi.fn(async () => ({
      ok: true,
      status: 201,
      body: { status: 'provisioned' },
      text: '',
    }));
    const getTenantReady = vi.fn(async () => ({
      ok: true,
      status: 200,
      body: { ready: true },
      text: '',
    }));
    const bb = {
      isConfigured: () => true,
      provision,
      getTenantReady,
      getTenantState: vi.fn(),
    } as unknown as ControlV1BusinessBackendClient;

    const labBb = new LabBbProvisioningAdapter(bb);
    const requested = await labBb.requestProvisioning({
      accountId: 'acc-restaurant-1',
      subscriptionId: 'sub-rest-1',
      subscriptionNumber: 'SUB-REST-1',
      productId: 'RESTAURANT_LIVE',
      correlationId: 'corr-rest-prov',
      payload: { tenantId: 'bb-tenant-rest-1' },
    });
    expect(requested.outcome).toBe('ACCEPTED');

    const completed = await labBb.completeProvisioning({
      requestId: 'pr-rest-1',
      subscriptionId: 'sub-rest-1',
      tenantRef: 'bb-tenant-rest-1',
      externalRef: 'bb-tenant-rest-1',
    });
    expect(completed.outcome).toBe('COMPLETE');
    expect(provision).toHaveBeenCalledOnce();
    expect(getTenantReady).toHaveBeenCalledOnce();
  });
});
