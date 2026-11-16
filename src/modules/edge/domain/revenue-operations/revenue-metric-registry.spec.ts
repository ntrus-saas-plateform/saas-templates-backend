import { describe, expect, it } from 'vitest';
import {
  CANONICAL_METRIC_CODES,
  getMetricRegistryEntry,
  isCanonicalMetricCode,
  listCanonicalMetricDefinitions,
  REVENUE_METRIC_REGISTRY,
  unavailableUnlessPresent,
} from './revenue-metric-registry.js';

describe('revenue-metric-registry', () => {
  it('exposes all required canonical codes', () => {
    const required = [
      'MRR_ENDING',
      'MRR_NEW',
      'MRR_EXPANSION',
      'MRR_CONTRACTION',
      'MRR_CHURNED',
      'MRR_REACTIVATION',
      'MRR_NET_NEW',
      'ARR_ENDING',
      'GRR',
      'NRR',
      'LOGO_CHURN',
      'SUBSCRIPTION_CHURN',
      'INVOICED_REVENUE',
      'COLLECTED_REVENUE',
      'RECEIVABLES',
    ];
    expect([...CANONICAL_METRIC_CODES].sort()).toEqual([...required].sort());
  });

  it('provides human definitions that forbid silent zero', () => {
    for (const code of CANONICAL_METRIC_CODES) {
      const entry = REVENUE_METRIC_REGISTRY[code];
      expect(entry.definition.length).toBeGreaterThan(40);
      expect(entry.formula.length).toBeGreaterThan(5);
      expect(entry.definition.toLowerCase()).toMatch(/unavailable|never|missing|not/);
    }
  });

  it('COLLECTED_REVENUE definition rejects unpaid as collected', () => {
    const collected = getMetricRegistryEntry('COLLECTED_REVENUE');
    expect(collected).not.toBeNull();
    expect(collected!.definition.toLowerCase()).toMatch(/never.*unpaid|unpaid.*never|pending/);
  });

  it('isCanonicalMetricCode guards unknown codes', () => {
    expect(isCanonicalMetricCode('MRR_ENDING')).toBe(true);
    expect(isCanonicalMetricCode('FAKE_METRIC')).toBe(false);
    expect(getMetricRegistryEntry('FAKE_METRIC')).toBeNull();
  });

  it('listCanonicalMetricDefinitions returns one entry per code', () => {
    expect(listCanonicalMetricDefinitions()).toHaveLength(CANONICAL_METRIC_CODES.length);
  });

  it('unavailableUnlessPresent never invents zero', () => {
    expect(unavailableUnlessPresent(null)).toEqual({ value: null, dataQuality: 'UNAVAILABLE' });
    expect(unavailableUnlessPresent(undefined)).toEqual({
      value: null,
      dataQuality: 'UNAVAILABLE',
    });
    expect(unavailableUnlessPresent(0)).toEqual({ value: 0, dataQuality: 'MEASURED' });
    expect(unavailableUnlessPresent(12.5)).toEqual({ value: 12.5, dataQuality: 'MEASURED' });
  });
});
