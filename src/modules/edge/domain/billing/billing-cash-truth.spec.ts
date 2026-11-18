import { describe, expect, it } from 'vitest';
import {
  assembleBillingCashTruth,
  computeContractedRevenue,
  extractContractedAmount,
} from './billing-cash-truth.js';

describe('billing-cash-truth', () => {
  it('extracts contracted amount from commercialSnapshot keys', () => {
    expect(extractContractedAmount({ mrr: '120' })).toBe(120);
    expect(extractContractedAmount({ amount: 240, total: 1 })).toBe(240);
    expect(extractContractedAmount({})).toBeNull();
  });

  it('computes MEASURED contracted MRR and never collapses with cash', () => {
    const contracted = computeContractedRevenue({
      subscriptions: [
        {
          id: 's1',
          status: 'ACTIVE',
          currency: 'USD',
          billingFrequency: 'MONTHLY',
          commercialSnapshot: { amount: '100' },
        },
        {
          id: 's2',
          status: 'ACTIVE',
          currency: 'USD',
          billingFrequency: 'ANNUAL',
          commercialSnapshot: { amount: '1200' },
        },
        {
          id: 's3',
          status: 'CANCELLED',
          currency: 'USD',
          commercialSnapshot: { amount: '999' },
        },
      ],
    });
    expect(contracted.contracted.dataQuality).toBe('MEASURED');
    expect(contracted.contracted.amount).toBe(200); // 100 + 1200/12
    expect(contracted.contractedSubscriptionIds).toEqual(['s1', 's2']);
  });

  it('keeps contracted / invoiced / collected distinct', () => {
    const truth = assembleBillingCashTruth({
      periodStart: new Date('2026-11-01T00:00:00Z'),
      periodEnd: new Date('2026-12-01T00:00:00Z'),
      currency: 'USD',
      subscriptions: [
        {
          id: 's1',
          status: 'ACTIVE',
          currency: 'USD',
          billingFrequency: 'MONTHLY',
          commercialSnapshot: { amount: '500' },
        },
      ],
      invoices: [
        {
          id: 'inv-1',
          status: 'ISSUED',
          currency: 'USD',
          total: '400',
          amountDue: '400',
          issueAt: '2026-11-05T00:00:00Z',
        },
      ],
      payments: [
        {
          id: 'pay-1',
          status: 'SUCCEEDED',
          currency: 'USD',
          amount: '150',
          updatedAt: '2026-11-10T00:00:00Z',
        },
      ],
    });

    expect(truth.contracted.amount).toBe(500);
    expect(truth.invoiced.amount).toBe(400);
    expect(truth.collected.amount).toBe(150);
    expect(truth.notes.some((n) => n.includes('contracted ≠ invoiced ≠ collected'))).toBe(
      true,
    );
  });

  it('empty feeds → UNAVAILABLE contracted/invoiced/collected (not silent zero)', () => {
    const truth = assembleBillingCashTruth({
      periodStart: new Date('2026-11-01T00:00:00Z'),
      periodEnd: new Date('2026-12-01T00:00:00Z'),
      subscriptions: [],
      invoices: [],
      payments: [],
    });
    expect(truth.contracted.dataQuality).toBe('UNAVAILABLE');
    expect(truth.invoiced.dataQuality).toBe('UNAVAILABLE');
    expect(truth.collected.dataQuality).toBe('UNAVAILABLE');
  });
});
