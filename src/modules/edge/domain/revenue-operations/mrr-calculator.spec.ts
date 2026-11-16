import { describe, expect, it } from 'vitest';
import {
  computeMrrMovements,
  isCollectedEligible,
  normalizeToMonthlyMrr,
  type NormalizedSubscriptionRevenueLine,
} from './mrr-calculator.js';

describe('normalizeToMonthlyMrr', () => {
  it('keeps monthly amounts as-is', () => {
    expect(normalizeToMonthlyMrr(100, 'MONTHLY')).toBe(100);
  });

  it('divides annual/yearly by 12', () => {
    expect(normalizeToMonthlyMrr(1200, 'ANNUAL')).toBe(100);
    expect(normalizeToMonthlyMrr(1200, 'YEARLY')).toBe(100);
  });

  it('divides quarterly by 3', () => {
    expect(normalizeToMonthlyMrr(300, 'QUARTERLY')).toBe(100);
  });

  it('returns NaN for unsupported periods (no silent assumption)', () => {
    expect(Number.isNaN(normalizeToMonthlyMrr(100, 'OTHER'))).toBe(true);
  });
});

describe('isCollectedEligible', () => {
  it('only PAID is collected-eligible', () => {
    expect(isCollectedEligible('PAID')).toBe(true);
    expect(isCollectedEligible('UNPAID')).toBe(false);
    expect(isCollectedEligible('PENDING')).toBe(false);
    expect(isCollectedEligible(undefined)).toBe(false);
  });
});

describe('computeMrrMovements', () => {
  const baseLines: NormalizedSubscriptionRevenueLine[] = [
    {
      subscriptionRefId: 'sub-new',
      amount: 100,
      currency: 'USD',
      billingPeriod: 'MONTHLY',
      movementType: 'NEW',
      activeAtPeriodEnd: true,
      paymentStatus: 'PAID',
    },
    {
      subscriptionRefId: 'sub-exp',
      amount: 50,
      currency: 'USD',
      billingPeriod: 'MONTHLY',
      movementType: 'EXPANSION',
      activeAtPeriodEnd: true,
      paymentStatus: 'PAID',
    },
    {
      subscriptionRefId: 'sub-con',
      amount: 20,
      currency: 'USD',
      billingPeriod: 'MONTHLY',
      movementType: 'CONTRACTION',
      activeAtPeriodEnd: true,
      paymentStatus: 'PAID',
    },
    {
      subscriptionRefId: 'sub-churn',
      amount: 30,
      currency: 'USD',
      billingPeriod: 'MONTHLY',
      movementType: 'CHURNED',
      activeAtPeriodEnd: false,
      paymentStatus: 'PAID',
    },
    {
      subscriptionRefId: 'sub-re',
      amount: 40,
      currency: 'USD',
      billingPeriod: 'MONTHLY',
      movementType: 'REACTIVATION',
      activeAtPeriodEnd: true,
      paymentStatus: 'PAID',
    },
  ];

  it('returns UNAVAILABLE (not zero) for empty input', () => {
    const result = computeMrrMovements([]);
    expect(result.mrrEnding.dataQuality).toBe('UNAVAILABLE');
    expect(result.mrrEnding.amount).toBeNull();
    expect(result.mrrNetNew.amount).toBeNull();
    expect(result.arrEnding.dataQuality).toBe('UNAVAILABLE');
  });

  it('normalizes annual lines via /12', () => {
    const result = computeMrrMovements([
      {
        subscriptionRefId: 'sub-annual',
        amount: 1200,
        currency: 'EUR',
        billingPeriod: 'ANNUAL',
        movementType: 'NEW',
        activeAtPeriodEnd: true,
      },
    ]);
    expect(result.mrrNew.amount).toBe(100);
    expect(result.mrrEnding.amount).toBe(100);
    expect(result.arrEnding.amount).toBe(1200);
  });

  it('excludes free trials by default', () => {
    const result = computeMrrMovements([
      {
        subscriptionRefId: 'trial',
        amount: 99,
        currency: 'USD',
        billingPeriod: 'MONTHLY',
        movementType: 'NEW',
        isFreeTrial: true,
        activeAtPeriodEnd: true,
      },
      {
        subscriptionRefId: 'paid',
        amount: 50,
        currency: 'USD',
        billingPeriod: 'MONTHLY',
        movementType: 'NEW',
        isFreeTrial: false,
        activeAtPeriodEnd: true,
      },
    ]);
    expect(result.skippedLineCount).toBe(1);
    expect(result.mrrNew.amount).toBe(50);
  });

  it('includes free trials when excludeFreeTrials=false', () => {
    const result = computeMrrMovements(
      [
        {
          subscriptionRefId: 'trial',
          amount: 99,
          currency: 'USD',
          billingPeriod: 'MONTHLY',
          movementType: 'NEW',
          isFreeTrial: true,
          activeAtPeriodEnd: true,
        },
      ],
      { excludeFreeTrials: false },
    );
    expect(result.mrrNew.amount).toBe(99);
  });

  it('computes net new from movement buckets', () => {
    const result = computeMrrMovements(baseLines);
    // 100 + 50 + 40 - 20 - 30 = 140
    expect(result.mrrNetNew.amount).toBe(140);
    expect(result.mrrNetNew.dataQuality).toBe('MEASURED');
  });

  it('never treats unpaid as collected-eligible', () => {
    expect(isCollectedEligible('UNPAID')).toBe(false);
    const result = computeMrrMovements([
      {
        subscriptionRefId: 'unpaid',
        amount: 200,
        currency: 'USD',
        billingPeriod: 'MONTHLY',
        movementType: 'NEW',
        paymentStatus: 'UNPAID',
        activeAtPeriodEnd: true,
      },
    ]);
    // Unpaid still contributes to MRR classification, but notes document collection rule
    expect(result.mrrNew.amount).toBe(200);
    expect(result.notes.some((n) => n.toLowerCase().includes('collected'))).toBe(true);
  });
});
