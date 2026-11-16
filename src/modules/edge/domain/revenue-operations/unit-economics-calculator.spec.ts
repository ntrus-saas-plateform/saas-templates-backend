import { describe, expect, it } from 'vitest';
import {
  computeCac,
  computeLtv,
  computeLtvCac,
  computePaybackMonths,
} from './unit-economics-calculator.js';

describe('computeCac', () => {
  it('divides spend by new customers', () => {
    const r = computeCac({ acquisitionSpend: 10000, newCustomers: 50 });
    expect(r.value).toBe(200);
    expect(r.dataQuality).toBe('MEASURED');
  });

  it('returns UNAVAILABLE when spend null', () => {
    const r = computeCac({ acquisitionSpend: null, newCustomers: 10 });
    expect(r.value).toBeNull();
    expect(r.dataQuality).toBe('UNAVAILABLE');
  });

  it('returns UNAVAILABLE when customers null or 0', () => {
    expect(computeCac({ acquisitionSpend: 100, newCustomers: null }).value).toBeNull();
    expect(computeCac({ acquisitionSpend: 100, newCustomers: 0 }).dataQuality).toBe(
      'UNAVAILABLE',
    );
  });
});

describe('computeLtv', () => {
  it('computes AR * margin / churn', () => {
    const r = computeLtv({
      avgRecurringRevenue: 100,
      grossMarginPct: 0.8,
      churnRate: 0.05,
    });
    expect(r.value).toBe(1600);
    expect(r.dataQuality).toBe('MEASURED');
  });

  it('returns UNAVAILABLE when churnRate null/0', () => {
    expect(
      computeLtv({ avgRecurringRevenue: 100, grossMarginPct: 0.8, churnRate: null }).value,
    ).toBeNull();
    expect(
      computeLtv({ avgRecurringRevenue: 100, grossMarginPct: 0.8, churnRate: 0 }).dataQuality,
    ).toBe('UNAVAILABLE');
  });

  it('returns UNAVAILABLE when margin or AR missing', () => {
    expect(
      computeLtv({ avgRecurringRevenue: null, grossMarginPct: 0.8, churnRate: 0.1 }).value,
    ).toBeNull();
    expect(
      computeLtv({ avgRecurringRevenue: 100, grossMarginPct: null, churnRate: 0.1 }).value,
    ).toBeNull();
  });
});

describe('computeLtvCac', () => {
  it('computes ratio', () => {
    expect(computeLtvCac({ ltv: 1600, cac: 200 }).value).toBe(8);
  });

  it('UNAVAILABLE when either side missing or cac 0', () => {
    expect(computeLtvCac({ ltv: null, cac: 200 }).dataQuality).toBe('UNAVAILABLE');
    expect(computeLtvCac({ ltv: 100, cac: 0 }).value).toBeNull();
  });
});

describe('computePaybackMonths', () => {
  it('computes cac / monthlyContribution', () => {
    expect(computePaybackMonths({ cac: 200, monthlyContribution: 50 }).value).toBe(4);
  });

  it('UNAVAILABLE when contribution null/0', () => {
    expect(
      computePaybackMonths({ cac: 200, monthlyContribution: null }).dataQuality,
    ).toBe('UNAVAILABLE');
    expect(computePaybackMonths({ cac: 200, monthlyContribution: 0 }).value).toBeNull();
  });
});
