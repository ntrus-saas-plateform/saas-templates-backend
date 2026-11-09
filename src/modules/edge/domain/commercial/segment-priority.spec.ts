import { describe, expect, it } from 'vitest';
import { scoreSegmentPriority } from './segment-priority.js';

const weights = {
  marketAttractiveness: 0.15,
  strategicFit: 0.15,
  productReadiness: 0.15,
  competitiveIntensity: 0.1,
  acquisitionComplexity: 0.1,
  revenuePotential: 0.1,
  deliveryComplexity: 0.05,
  supportComplexity: 0.05,
  regulatoryRisk: 0.1,
  geographicAccessibility: 0.05,
};

describe('segment priority scoring', () => {
  it('marks NEEDS_RESEARCH when dimensions missing', () => {
    const result = scoreSegmentPriority({
      scores: { marketAttractiveness: 0.8 },
      weights,
      weightsVersion: 1,
    });
    expect(result.status).toBe('NEEDS_RESEARCH');
    expect(result.overall).toBeNull();
    expect(result.missingDimensions.length).toBeGreaterThan(0);
  });

  it('scores when all dimensions provided', () => {
    const scores = Object.fromEntries(
      Object.keys(weights).map((k) => [k, 0.5]),
    ) as Record<string, number>;
    const result = scoreSegmentPriority({
      scores,
      weights,
      weightsVersion: 1,
    });
    expect(result.status).toBe('SCORED');
    expect(result.overall).toBe('0.500000');
  });
});
