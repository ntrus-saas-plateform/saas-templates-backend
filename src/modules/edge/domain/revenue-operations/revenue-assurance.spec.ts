import { describe, expect, it } from 'vitest';
import {
  detectBillingWithoutSubscriptionRef,
  detectPriceMismatch,
  detectSubscriptionWithoutBillingSetup,
} from './revenue-assurance.js';

describe('detectSubscriptionWithoutBillingSetup', () => {
  it('returns draft when billing required but not confirmed', () => {
    const draft = detectSubscriptionWithoutBillingSetup({
      subscriptionId: 'sub-1',
      status: 'ACTIVE',
      billingRequired: true,
      billingConfirmed: false,
      hasBillingSchedule: false,
      hasBillingAccountLink: false,
    });
    expect(draft).not.toBeNull();
    expect(draft!.confidence).toBeGreaterThan(0.5);
    expect(draft!.dataQuality).toBe('MEASURED');
    expect(draft!.detectionSource).toContain('subscription_without_billing');
  });

  it('returns null when no concrete gap (does not invent)', () => {
    expect(
      detectSubscriptionWithoutBillingSetup({
        subscriptionId: 'sub-ok',
        status: 'ACTIVE',
        billingRequired: true,
        billingConfirmed: true,
        hasBillingSchedule: true,
        hasBillingAccountLink: true,
      }),
    ).toBeNull();
  });

  it('marks ESTIMATED / lower confidence when fields are PARTIAL', () => {
    const draft = detectSubscriptionWithoutBillingSetup({
      subscriptionId: 'sub-partial',
      status: 'ACTIVE',
      billingRequired: true,
      billingConfirmed: false,
      hasBillingSchedule: null,
      hasBillingAccountLink: null,
    });
    expect(draft).not.toBeNull();
    expect(draft!.dataQuality).toBe('ESTIMATED');
    expect(draft!.sourceProvenance.unknownFields).toEqual(
      expect.arrayContaining(['hasBillingSchedule', 'hasBillingAccountLink']),
    );
  });
});

describe('detectBillingWithoutSubscriptionRef', () => {
  it('flags invoice without subscription ref', () => {
    const draft = detectBillingWithoutSubscriptionRef({
      billingEntityType: 'INVOICE',
      billingEntityId: 'inv-1',
      subscriptionRefId: null,
      amount: 99,
      currency: 'USD',
    });
    expect(draft).not.toBeNull();
    expect(draft!.invoiceRefId).toBe('inv-1');
    expect(draft!.detectedAmount).toBe(99);
  });

  it('returns null when subscription ref present', () => {
    expect(
      detectBillingWithoutSubscriptionRef({
        billingEntityType: 'INVOICE',
        billingEntityId: 'inv-2',
        subscriptionRefId: 'sub-1',
      }),
    ).toBeNull();
  });
});

describe('detectPriceMismatch', () => {
  it('detects mismatch beyond tolerance', () => {
    const draft = detectPriceMismatch({
      subscriptionId: 'sub-1',
      invoiceId: 'inv-1',
      expectedAmount: 100,
      actualAmount: 120,
      currency: 'USD',
    });
    expect(draft).not.toBeNull();
    expect(draft!.detectedAmount).toBe(20);
    expect(draft!.dataQuality).toBe('MEASURED');
  });

  it('returns null when either amount missing (no invention)', () => {
    expect(
      detectPriceMismatch({
        expectedAmount: 100,
        actualAmount: null,
      }),
    ).toBeNull();
    expect(
      detectPriceMismatch({
        expectedAmount: undefined,
        actualAmount: 100,
      }),
    ).toBeNull();
  });

  it('returns null within tolerance', () => {
    expect(
      detectPriceMismatch({
        expectedAmount: 100,
        actualAmount: 100.005,
        tolerance: 0.01,
      }),
    ).toBeNull();
  });
});
