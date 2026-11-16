import { describe, expect, it } from 'vitest';
import { scoreRenewalRisk } from './renewal-intelligence.js';

describe('scoreRenewalRisk', () => {
  it('scores high for imminent renewal + delinquency + contraction', () => {
    const r = scoreRenewalRisk({
      daysToRenewal: 5,
      mrrAtRisk: 12000,
      priorContraction: true,
      paymentDelinquencyFlag: true,
    });
    expect(r.score).toBe(100);
    expect(r.severity).toBe('CRITICAL');
    expect(r.reasons.length).toBeGreaterThan(0);
  });

  it('clamps to 0–100 and returns LOW when signals weak', () => {
    const r = scoreRenewalRisk({
      daysToRenewal: 120,
      mrrAtRisk: 0,
      priorContraction: false,
      paymentDelinquencyFlag: false,
    });
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
    expect(r.severity).toBe('LOW');
  });

  it('documents PARTIAL when fields missing without inventing them', () => {
    const r = scoreRenewalRisk({
      daysToRenewal: null,
      mrrAtRisk: null,
      priorContraction: null,
      paymentDelinquencyFlag: null,
    });
    expect(r.score).toBe(0);
    expect(r.reasons.some((x) => /PARTIAL/i.test(x))).toBe(true);
  });

  it('maps medium band for moderate proximity', () => {
    const r = scoreRenewalRisk({
      daysToRenewal: 20,
      mrrAtRisk: 3000,
      priorContraction: false,
      paymentDelinquencyFlag: false,
    });
    expect(r.score).toBe(40);
    expect(r.severity).toBe('MEDIUM');
  });
});
