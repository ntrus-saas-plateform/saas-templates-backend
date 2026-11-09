import { describe, expect, it } from 'vitest';
import { DomainError } from '../../../../core/domain/errors/domain-error.js';
import {
  assertProductLifecycleTransition,
  canTransitionProductLifecycle,
  ProductLifecycleStatus,
} from './product.entity.js';
import {
  assertPublishedImmutable,
  assertProductVersionTransition,
  ProductVersionStatus,
} from './product-version.entity.js';

describe('Product lifecycle', () => {
  it('allows DRAFT → CONFIGURING → TECHNICAL_VALIDATION → READY_FOR_PUBLICATION → PUBLISHED', () => {
    expect(
      canTransitionProductLifecycle(
        ProductLifecycleStatus.DRAFT,
        ProductLifecycleStatus.CONFIGURING,
      ),
    ).toBe(true);
    expect(
      canTransitionProductLifecycle(
        ProductLifecycleStatus.CONFIGURING,
        ProductLifecycleStatus.TECHNICAL_VALIDATION,
      ),
    ).toBe(true);
    expect(
      canTransitionProductLifecycle(
        ProductLifecycleStatus.TECHNICAL_VALIDATION,
        ProductLifecycleStatus.READY_FOR_PUBLICATION,
      ),
    ).toBe(true);
    expect(
      canTransitionProductLifecycle(
        ProductLifecycleStatus.READY_FOR_PUBLICATION,
        ProductLifecycleStatus.PUBLISHED,
      ),
    ).toBe(true);
  });

  it('rejects PUBLISHED → DRAFT', () => {
    expect(() =>
      assertProductLifecycleTransition(
        ProductLifecycleStatus.PUBLISHED,
        ProductLifecycleStatus.DRAFT,
      ),
    ).toThrow(DomainError);
  });
});

describe('Published version immutability', () => {
  it('blocks edits after PUBLISHED', () => {
    expect(() => assertPublishedImmutable(ProductVersionStatus.PUBLISHED)).toThrow(DomainError);
    expect(() => assertPublishedImmutable(ProductVersionStatus.DEPRECATED)).toThrow(DomainError);
  });

  it('allows draft updates', () => {
    expect(() => assertPublishedImmutable(ProductVersionStatus.DRAFT)).not.toThrow();
  });

  it('allows VALIDATED → PUBLISHED', () => {
    expect(() =>
      assertProductVersionTransition(
        ProductVersionStatus.VALIDATED,
        ProductVersionStatus.PUBLISHED,
      ),
    ).not.toThrow();
  });
});
