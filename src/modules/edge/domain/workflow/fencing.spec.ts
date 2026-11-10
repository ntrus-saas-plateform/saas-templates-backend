import { describe, expect, it } from 'vitest';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import {
  assertFencingToken,
  isStaleFencingToken,
  nextFencingToken,
} from './fencing.js';

describe('fencing tokens', () => {
  it('accepts exact token match', () => {
    expect(() => assertFencingToken(3, 3)).not.toThrow();
    expect(() => assertFencingToken(0, 0)).not.toThrow();
  });

  it('rejects stale (lower) tokens', () => {
    try {
      assertFencingToken(5, 4);
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(DomainError);
      expect((err as DomainError).code).toBe(ErrorCode.CONFLICT);
      expect((err as DomainError).message).toMatch(/Stale fencing token/);
    }
    expect(isStaleFencingToken(5, 4)).toBe(true);
  });

  it('rejects higher unknown tokens', () => {
    expect(() => assertFencingToken(2, 9)).toThrow(DomainError);
    expect(isStaleFencingToken(2, 9)).toBe(false);
  });

  it('rejects non-integer / negative tokens', () => {
    expect(() => assertFencingToken(1.5, 1.5)).toThrow(DomainError);
    expect(() => assertFencingToken(-1, -1)).toThrow(DomainError);
    expect(() => assertFencingToken(1, Number.NaN)).toThrow(DomainError);
  });

  it('monotonic nextFencingToken', () => {
    expect(nextFencingToken(0)).toBe(1);
    expect(nextFencingToken(41)).toBe(42);
    expect(() => nextFencingToken(-1)).toThrow(DomainError);
  });
});
