import { describe, it, expect } from 'vitest';
import { TenantStatus } from './tenant.entity.js';
import {
  canTransitionTenantStatus,
  assertTenantTransition,
} from './tenant-lifecycle.js';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';

describe('Tenant Lifecycle', () => {
  it('allows PROVISIONING → ACTIVE', () => {
    expect(canTransitionTenantStatus(TenantStatus.PROVISIONING, TenantStatus.ACTIVE)).toBe(true);
  });

  it('allows ACTIVE → SUSPENDED → ACTIVE', () => {
    expect(canTransitionTenantStatus(TenantStatus.ACTIVE, TenantStatus.SUSPENDED)).toBe(true);
    expect(canTransitionTenantStatus(TenantStatus.SUSPENDED, TenantStatus.ACTIVE)).toBe(true);
  });

  it('allows DEACTIVATING → ARCHIVED → DELETED', () => {
    expect(canTransitionTenantStatus(TenantStatus.DEACTIVATING, TenantStatus.ARCHIVED)).toBe(true);
    expect(canTransitionTenantStatus(TenantStatus.ARCHIVED, TenantStatus.DELETED)).toBe(true);
  });

  it('denies PROVISIONING → DELETED', () => {
    expect(canTransitionTenantStatus(TenantStatus.PROVISIONING, TenantStatus.DELETED)).toBe(false);
  });

  it('denies DELETED → ACTIVE', () => {
    expect(canTransitionTenantStatus(TenantStatus.DELETED, TenantStatus.ACTIVE)).toBe(false);
  });

  it('assertTenantTransition throws on illegal transition', () => {
    expect(() =>
      assertTenantTransition(TenantStatus.PROVISIONING, TenantStatus.DELETED),
    ).toThrow(DomainError);
    try {
      assertTenantTransition(TenantStatus.PROVISIONING, TenantStatus.DELETED);
    } catch (e) {
      expect((e as DomainError).code).toBe(ErrorCode.VALIDATION_ERROR);
    }
  });
});
