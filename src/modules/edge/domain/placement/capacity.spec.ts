import { describe, expect, it } from 'vitest';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import {
  assertNonNegative,
  computeAvailable,
  hasSufficientCapacity,
  isFresh,
  validateQuantities,
} from './capacity.js';
import { CapacityResourceType } from './placement.types.js';

describe('capacity helpers', () => {
  it('computeAvailable subtracts unavailable/reserved/allocated', () => {
    expect(
      computeAvailable({
        totalCapacity: 100,
        unavailableCapacity: 10,
        reservedCapacity: 20,
        allocatedCapacity: 5,
      }),
    ).toBe(65);
  });

  it('computeAvailable can be zero', () => {
    expect(
      computeAvailable({
        totalCapacity: 10,
        unavailableCapacity: 2,
        reservedCapacity: 5,
        allocatedCapacity: 3,
      }),
    ).toBe(0);
  });

  it('assertNonNegative accepts zero and positives', () => {
    expect(() => assertNonNegative(0, 'x')).not.toThrow();
    expect(() => assertNonNegative(1.5, 'x')).not.toThrow();
  });

  it('assertNonNegative rejects negatives and non-finite', () => {
    expect(() => assertNonNegative(-1, 'total')).toThrow(DomainError);
    try {
      assertNonNegative(Number.NaN, 'total');
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(DomainError);
      expect((err as DomainError).code).toBe(ErrorCode.VALIDATION_ERROR);
    }
  });

  it('isFresh is strict after now', () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    expect(isFresh(new Date('2026-01-01T00:00:00.001Z'), now)).toBe(true);
    expect(isFresh(new Date('2026-01-01T00:00:00.000Z'), now)).toBe(false);
    expect(isFresh(new Date('2025-12-31T23:59:59.999Z'), now)).toBe(false);
  });

  it('validateQuantities accepts known positive map', () => {
    expect(
      validateQuantities({
        [CapacityResourceType.CPU]: 2,
        [CapacityResourceType.TENANT_SLOT]: 1,
      }),
    ).toEqual({ CPU: 2, TENANT_SLOT: 1 });
  });

  it('validateQuantities rejects unknown type', () => {
    expect(() => validateQuantities({ GPU: 1 } as never)).toThrow(DomainError);
  });

  it('validateQuantities rejects zero/negative/non-finite', () => {
    expect(() => validateQuantities({ CPU: 0 })).toThrow(DomainError);
    expect(() => validateQuantities({ CPU: -1 })).toThrow(DomainError);
    expect(() => validateQuantities({ CPU: Number.NaN })).toThrow(DomainError);
  });

  it('validateQuantities rejects non-object', () => {
    expect(() => validateQuantities(null as never)).toThrow(DomainError);
    expect(() => validateQuantities([] as never)).toThrow(DomainError);
  });

  it('hasSufficientCapacity is inclusive', () => {
    expect(hasSufficientCapacity(5, 5)).toBe(true);
    expect(hasSufficientCapacity(4.9, 5)).toBe(false);
    expect(hasSufficientCapacity(Number.NaN, 1)).toBe(false);
  });
});
