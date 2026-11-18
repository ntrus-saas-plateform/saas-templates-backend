import { describe, expect, it } from 'vitest';
import {
  buildSubscriptionInvoiceLines,
  extractSetupFeeAmount,
  nextBillAtForFrequency,
  normalizeBillingFrequency,
  toScheduleFrequency,
} from './billing-cadence.js';

describe('billing-cadence', () => {
  it('normalizes frequencies including ENTERPRISE_CONTRACT', () => {
    expect(normalizeBillingFrequency('annual')).toBe('ANNUAL');
    expect(normalizeBillingFrequency('ENTERPRISE_CONTRACT')).toBe('ENTERPRISE_CONTRACT');
    expect(toScheduleFrequency('ENTERPRISE_CONTRACT')).toBe('CUSTOM');
  });

  it('builds recurring + setup fee lines without collapsing kinds', () => {
    const lines = buildSubscriptionInvoiceLines({
      subscriptionNumber: 'SUB-1',
      planId: 'plan-pro',
      billingFrequency: 'MONTHLY',
      commercialSnapshot: { amount: '99.00', setupFee: '250' },
      includeSetupFee: true,
    });
    expect(lines).toHaveLength(2);
    expect(lines[0]?.metadata.lineKind).toBe('RECURRING');
    expect(lines[0]?.unitPrice).toBe('99.00');
    expect(lines[1]?.metadata.lineKind).toBe('SETUP_FEE');
    expect(lines[1]?.unitPrice).toBe('250.00');
  });

  it('omits setup fee when includeSetupFee=false', () => {
    const lines = buildSubscriptionInvoiceLines({
      subscriptionNumber: 'SUB-1',
      billingFrequency: 'ANNUAL',
      commercialSnapshot: { amount: '1200', setupFeeAmount: 100 },
      includeSetupFee: false,
    });
    expect(lines).toHaveLength(1);
    expect(lines[0]?.description).toMatch(/Annual/);
  });

  it('enterprise / one-time have no auto next bill', () => {
    const from = new Date('2026-11-01T00:00:00Z');
    expect(nextBillAtForFrequency(from, 'ENTERPRISE_CONTRACT')).toBeNull();
    expect(nextBillAtForFrequency(from, 'ONE_TIME')).toBeNull();
    expect(nextBillAtForFrequency(from, 'MONTHLY')?.getUTCMonth()).toBe(11);
  });

  it('extracts setup fee fail-closed', () => {
    expect(extractSetupFeeAmount({ setupFee: 0 })).toBeNull();
    expect(extractSetupFeeAmount({ setup_fee: '40.5' })).toBe('40.50');
  });
});
