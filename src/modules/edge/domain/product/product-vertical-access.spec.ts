import { describe, expect, it } from 'vitest';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import {
  assertProductVerticalAccess,
  resolveProductListVerticalFilter,
} from './product-vertical-access.js';

describe('assertProductVerticalAccess', () => {
  it('allows global scope to any product vertical', () => {
    expect(() =>
      assertProductVerticalAccess({
        scopeVerticalId: null,
        productVerticalId: 'pharmacy',
      }),
    ).not.toThrow();
  });

  it('allows workspace scope when product belongs to same vertical', () => {
    expect(() =>
      assertProductVerticalAccess({
        scopeVerticalId: 'pharmacy',
        productVerticalId: 'pharmacy',
        action: 'update',
      }),
    ).not.toThrow();
  });

  it('rejects restaurant admin mutating pharmacy product', () => {
    expect(() =>
      assertProductVerticalAccess({
        scopeVerticalId: 'restaurant',
        productVerticalId: 'pharmacy',
        action: 'update',
      }),
    ).toThrow(DomainError);

    try {
      assertProductVerticalAccess({
        scopeVerticalId: 'restaurant',
        productVerticalId: 'pharmacy',
        action: 'update',
      });
    } catch (err) {
      expect((err as DomainError).code).toBe(ErrorCode.FORBIDDEN);
    }
  });
});

describe('resolveProductListVerticalFilter', () => {
  it('forces workspace vertical and ignores broader requests', () => {
    expect(
      resolveProductListVerticalFilter({
        scopeVerticalId: 'pharmacy',
        requestedVerticalId: undefined,
      }),
    ).toBe('pharmacy');
  });

  it('rejects listing another vertical from workspace', () => {
    expect(() =>
      resolveProductListVerticalFilter({
        scopeVerticalId: 'pharmacy',
        requestedVerticalId: 'restaurant',
      }),
    ).toThrow(DomainError);
  });

  it('passes through requested vertical in global scope', () => {
    expect(
      resolveProductListVerticalFilter({
        scopeVerticalId: null,
        requestedVerticalId: 'retail',
      }),
    ).toBe('retail');
  });
});
