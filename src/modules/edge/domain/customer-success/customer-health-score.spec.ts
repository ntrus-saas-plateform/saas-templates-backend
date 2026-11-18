import { describe, expect, it } from 'vitest';
import { computeCustomerHealthScore } from './customer-health-score.js';
import { listAhaMomentsForSegment } from './aha-moments.js';

describe('customer-health-score v1', () => {
  it('returns UNAVAILABLE when no inputs (never silent 0)', () => {
    const r = computeCustomerHealthScore({});
    expect(r.dataQuality).toBe('UNAVAILABLE');
    expect(r.score).toBeNull();
    expect(r.band).toBe('UNKNOWN');
  });

  it('computes MEASURED band and touch model', () => {
    const r = computeCustomerHealthScore({
      adoptionScore: 80,
      ahaCompletionPct: 75,
      supportLoadInverseScore: 90,
      paymentHealthScore: 100,
    });
    expect(r.dataQuality).toBe('MEASURED');
    expect(r.score).toBeGreaterThan(70);
    expect(r.band).toBe('HIGH');
    expect(r.touchModel).toBe('LOW_TOUCH');
  });

  it('caps score when delinquent or suspended', () => {
    const r = computeCustomerHealthScore({
      adoptionScore: 100,
      ahaCompletionPct: 100,
      supportLoadInverseScore: 100,
      paymentHealthScore: 100,
      suspended: true,
    });
    expect(r.score).toBeLessThanOrEqual(25);
    expect(r.band).toBe('LOW');
    expect(r.touchModel).toBe('HIGH_TOUCH');
  });
});

describe('aha-moments beachhead', () => {
  it('lists retail pharmacy aha codes', () => {
    const moments = listAhaMomentsForSegment('RETAIL_PHARMACY');
    expect(moments.some((m) => m.code === 'pharmacy.first_sale')).toBe(true);
  });
});
