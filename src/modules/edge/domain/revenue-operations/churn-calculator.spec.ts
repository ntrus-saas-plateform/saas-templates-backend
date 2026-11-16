import { describe, expect, it } from 'vitest';
import { computeLogoChurn, computeSubscriptionChurn } from './churn-calculator.js';

describe('computeLogoChurn', () => {
  it('computes churned/starting rate', () => {
    const r = computeLogoChurn({ startingLogos: 100, churnedLogos: 5 });
    expect(r.rate).toBe(0.05);
    expect(r.dataQuality).toBe('MEASURED');
  });

  it('UNAVAILABLE when starting missing (never silent 0%)', () => {
    const r = computeLogoChurn({ startingLogos: null, churnedLogos: 0 });
    expect(r.rate).toBeNull();
    expect(r.dataQuality).toBe('UNAVAILABLE');
  });

  it('UNAVAILABLE when starting is 0', () => {
    const r = computeLogoChurn({ startingLogos: 0, churnedLogos: 0 });
    expect(r.dataQuality).toBe('UNAVAILABLE');
  });
});

describe('computeSubscriptionChurn', () => {
  it('mirrors logo formula for subscriptions', () => {
    const r = computeSubscriptionChurn({
      startingSubscriptions: 50,
      churnedSubscriptions: 10,
    });
    expect(r.rate).toBe(0.2);
    expect(r.dataQuality).toBe('MEASURED');
  });
});
