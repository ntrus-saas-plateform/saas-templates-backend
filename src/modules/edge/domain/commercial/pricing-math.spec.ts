import { describe, expect, it } from 'vitest';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import {
  applyPercentageDiscount,
  assertCurrency,
  calculateCommercialPrice,
  formatMoneyAmount,
  parseMoneyAmount,
} from './pricing-math.js';

describe('pricing math', () => {
  it('rejects invalid currency', () => {
    expect(() => assertCurrency('us')).toThrow(DomainError);
  });

  it('parses decimal strings without float drift', () => {
    const money = parseMoneyAmount('19.99', 'USD');
    expect(formatMoneyAmount(money)).toBe('19.99');
  });

  it('computes PER_USER as base * quantity', () => {
    const result = calculateCommercialPrice({
      baseAmount: '10.50',
      currency: 'USD',
      quantity: 3,
      modelType: 'PER_USER',
    });
    expect(result.amount).toBe('31.50');
    expect(result.currency).toBe('USD');
  });

  it('keeps FLAT_FEE independent of quantity', () => {
    const result = calculateCommercialPrice({
      baseAmount: '99.00',
      currency: 'EUR',
      quantity: 5,
      modelType: 'FLAT_FEE',
    });
    expect(result.amount).toBe('99.00');
  });

  it('applies percentage discount with integer math', () => {
    const money = parseMoneyAmount('100.00', 'USD');
    const { discounted, discount } = applyPercentageDiscount(money, '12.5');
    expect(formatMoneyAmount(discount)).toBe('12.50');
    expect(formatMoneyAmount(discounted)).toBe('87.50');
  });

  it('rejects discount above 100%', () => {
    const money = parseMoneyAmount('10', 'USD');
    try {
      applyPercentageDiscount(money, '101');
      expect.fail('expected error');
    } catch (err) {
      expect((err as DomainError).code).toBe(ErrorCode.VALIDATION_ERROR);
    }
  });

  it('computes progressive TIERED pricing', () => {
    const result = calculateCommercialPrice({
      baseAmount: '0',
      currency: 'USD',
      quantity: 15,
      modelType: 'TIERED',
      tiers: [
        { upTo: 10, unitAmount: '10.00' },
        { upTo: null, unitAmount: '8.00' },
      ],
    });
    // 10*10 + 5*8 = 140
    expect(result.amount).toBe('140.00');
    expect(result.components).toHaveLength(2);
  });

  it('computes VOLUME pricing from matching band', () => {
    const result = calculateCommercialPrice({
      baseAmount: '0',
      currency: 'USD',
      quantity: 15,
      modelType: 'VOLUME',
      tiers: [
        { upTo: 10, unitAmount: '10.00' },
        { upTo: 20, unitAmount: '7.00' },
      ],
    });
    // all 15 at 7.00
    expect(result.amount).toBe('105.00');
  });
});
