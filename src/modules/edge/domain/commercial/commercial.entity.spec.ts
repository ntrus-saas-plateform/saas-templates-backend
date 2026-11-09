import { describe, expect, it } from 'vitest';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import {
  assertCapabilityCommerciallyIncludable,
  assertSameProductOwnership,
  CommercialInclusionType,
  CommercialReadinessResult,
  evaluateCommercialReadiness,
} from './commercial.entity.js';
import {
  applyPercentageDiscount,
  calculateCommercialPrice,
  formatMoneyAmount,
  parseMoneyAmount,
} from './pricing-math.js';

describe('commercial ownership', () => {
  it('rejects cross-product association', () => {
    expect(() =>
      assertSameProductOwnership({
        productId: 'prod-a',
        otherProductId: 'prod-b',
        context: 'addon-plan',
      }),
    ).toThrow(DomainError);
  });
});

describe('capability commercial inclusion', () => {
  it('blocks PLANNED capability from INCLUDED', () => {
    expect(() =>
      assertCapabilityCommerciallyIncludable(
        {
          capabilityId: 'cap-1',
          technicalStatus: 'PLANNED',
          commercialAvailability: 'INTERNAL_ONLY',
        },
        CommercialInclusionType.INCLUDED,
      ),
    ).toThrow(DomainError);
  });

  it('blocks UNAVAILABLE commercial availability', () => {
    try {
      assertCapabilityCommerciallyIncludable(
        {
          capabilityId: 'cap-1',
          technicalStatus: 'VALIDATED',
          commercialAvailability: 'UNAVAILABLE',
        },
        CommercialInclusionType.INCLUDED,
      );
      expect.fail('expected error');
    } catch (err) {
      expect((err as DomainError).code).toBe(ErrorCode.CONFLICT);
    }
  });

  it('allows VALIDATED + AVAILABLE', () => {
    expect(() =>
      assertCapabilityCommerciallyIncludable(
        {
          capabilityId: 'cap-1',
          technicalStatus: 'VALIDATED',
          commercialAvailability: 'AVAILABLE',
        },
        CommercialInclusionType.INCLUDED,
      ),
    ).not.toThrow();
  });
});

describe('commercial readiness', () => {
  it('skips plan tier when requirePlanTier is false', () => {
    const result = evaluateCommercialReadiness({
      productLifecycleStatus: 'PUBLISHED',
      hasPlanTier: false,
      requirePlanTier: false,
      capabilityRefs: [],
      inclusions: [],
    });
    expect(result.result).toBe(CommercialReadinessResult.READY);
  });

  it('blocks enterprise without deployment profile', () => {
    const result = evaluateCommercialReadiness({
      productLifecycleStatus: 'PUBLISHED',
      hasPlanTier: false,
      requirePlanTier: false,
      capabilityRefs: [],
      inclusions: [],
      requireDeploymentProfile: true,
      hasDeploymentProfile: false,
    });
    expect(result.result).toBe(CommercialReadinessResult.BLOCKED);
    expect(result.blockers).toContain('deployment_profile_missing');
  });

  it('blocks unpublished product and bad capability', () => {
    const result = evaluateCommercialReadiness({
      productLifecycleStatus: 'DRAFT',
      hasPlanTier: true,
      capabilityRefs: [
        {
          capabilityId: 'c1',
          technicalStatus: 'PLANNED',
          commercialAvailability: 'BETA',
        },
      ],
      inclusions: [{ capabilityId: 'c1', inclusionType: CommercialInclusionType.INCLUDED }],
      requireProductPublished: true,
      forbidUnvalidatedCapabilities: true,
    });
    expect(result.result).toBe(CommercialReadinessResult.BLOCKED);
    expect(result.blockers.length).toBeGreaterThan(0);
  });
});

describe('pricing math', () => {
  it('parses and formats without float drift', () => {
    const m = parseMoneyAmount('19.99', 'usd');
    expect(formatMoneyAmount(m)).toBe('19.99');
  });

  it('calculates per-user price deterministically', () => {
    const quote = calculateCommercialPrice({
      baseAmount: '10.00',
      currency: 'USD',
      quantity: 3,
      modelType: 'PER_USER',
    });
    expect(quote.amount).toBe('30.00');
    expect(quote.currency).toBe('USD');
  });

  it('applies percentage discount with decimal precision', () => {
    const base = parseMoneyAmount('100.00', 'USD');
    const { discounted, discount } = applyPercentageDiscount(base, '12.5');
    expect(formatMoneyAmount(discount)).toBe('12.50');
    expect(formatMoneyAmount(discounted)).toBe('87.50');
  });

  it('rejects invalid currency', () => {
    expect(() => parseMoneyAmount('1', 'US')).toThrow(DomainError);
  });
});
