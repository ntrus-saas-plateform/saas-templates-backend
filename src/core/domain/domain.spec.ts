import { describe, it, expect } from 'vitest';
import {
  TenantStatus,
  isTenantAccessible,
  isTenantWritable,
} from '../../modules/identity/domain/tenant/tenant.entity.js';
import {
  OrganizationStatus,
  isOrganizationAccessible,
} from '../../modules/identity/domain/organization/organization.entity.js';
import { DomainError, ErrorCode } from './errors/domain-error.js';
import { sanitizeForAudit, hashRequestBody } from '../../shared/security/sanitize.js';

describe('Tenant Entity', () => {
  it('should allow access for ACTIVE tenant', () => {
    expect(isTenantAccessible(TenantStatus.ACTIVE)).toBe(true);
  });

  it('should allow read-only access for READ_ONLY tenant', () => {
    expect(isTenantAccessible(TenantStatus.READ_ONLY)).toBe(true);
  });

  it('should deny access for SUSPENDED tenant', () => {
    expect(isTenantAccessible(TenantStatus.SUSPENDED)).toBe(false);
  });

  it('should only allow writes for ACTIVE tenant', () => {
    expect(isTenantWritable(TenantStatus.ACTIVE)).toBe(true);
    expect(isTenantWritable(TenantStatus.READ_ONLY)).toBe(false);
  });
});

describe('Organization Entity', () => {
  it('should allow access for ACTIVE organization', () => {
    expect(isOrganizationAccessible(OrganizationStatus.ACTIVE)).toBe(true);
  });

  it('should deny access for SUSPENDED organization', () => {
    expect(isOrganizationAccessible(OrganizationStatus.SUSPENDED)).toBe(false);
  });
});

describe('DomainError', () => {
  it('should create error with code and details', () => {
    const error = new DomainError(ErrorCode.TENANT_NOT_FOUND, 'Tenant not found', [
      { tenantId: 'abc' },
    ]);
    expect(error.code).toBe(ErrorCode.TENANT_NOT_FOUND);
    expect(error.details).toHaveLength(1);
  });
});

describe('Sanitize', () => {
  it('should redact sensitive fields', () => {
    const result = sanitizeForAudit({
      username: 'john',
      password: 'secret123',
      access_token: 'token',
    });
    expect(result?.username).toBe('john');
    expect(result?.password).toBe('[REDACTED]');
    expect(result?.access_token).toBe('[REDACTED]');
  });

  it('should produce consistent request hashes', () => {
    const hash1 = hashRequestBody({ a: 1 });
    const hash2 = hashRequestBody({ a: 1 });
    const hash3 = hashRequestBody({ a: 2 });
    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(hash3);
  });
});
