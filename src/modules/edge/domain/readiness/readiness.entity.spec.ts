import { describe, expect, it } from 'vitest';
import { evaluateProductReadiness, ReadinessResult } from './readiness.entity.js';

describe('Readiness evaluate blockers', () => {
  it('returns READY when all checks pass', () => {
    const result = evaluateProductReadiness({
      productId: 'p1',
      verticalId: 'v1',
      hasVersion: true,
      requiredCapabilityIds: ['c1'],
      validatedCapabilityIds: ['c1'],
      requirePrimaryBinding: false,
      hasPrimaryBinding: false,
    });
    expect(result.result).toBe(ReadinessResult.READY);
    expect(result.blockers).toEqual([]);
  });

  it('blocks when vertical or version missing', () => {
    const result = evaluateProductReadiness({
      productId: 'p1',
      verticalId: null,
      hasVersion: false,
      requiredCapabilityIds: [],
      validatedCapabilityIds: [],
      requirePrimaryBinding: false,
      hasPrimaryBinding: false,
    });
    expect(result.result).toBe(ReadinessResult.BLOCKED);
    expect(result.blockers).toEqual(
      expect.arrayContaining(['missing_vertical', 'missing_version']),
    );
  });

  it('blocks unvalidated required capabilities and missing primary binding', () => {
    const result = evaluateProductReadiness({
      productId: 'p1',
      verticalId: 'v1',
      hasVersion: true,
      requiredCapabilityIds: ['c1', 'c2'],
      validatedCapabilityIds: ['c1'],
      requirePrimaryBinding: true,
      hasPrimaryBinding: false,
    });
    expect(result.result).toBe(ReadinessResult.BLOCKED);
    expect(result.blockers).toEqual(
      expect.arrayContaining(['required_capabilities_unvalidated', 'missing_primary_binding']),
    );
  });
});
