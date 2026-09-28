import { describe, it, expect } from 'vitest';
import { DomainError, ErrorCode } from '../../src/core/domain/errors/domain-error.js';
import {
  ACCESS_DENIED_MESSAGE,
  accessDeniedError,
} from '../../src/core/domain/errors/access-denied.js';

describe('Security: Enumeration protection', () => {
  it('accessDeniedError uses generic FORBIDDEN message', () => {
    const error = accessDeniedError();
    expect(error.code).toBe(ErrorCode.FORBIDDEN);
    expect(error.message).toBe(ACCESS_DENIED_MESSAGE);
    expect(error.message).not.toContain('tenant');
    expect(error.message).not.toContain('organization');
  });

  it('TENANT_NOT_FOUND and ORGANIZATION_NOT_FOUND codes exist for internal use', () => {
    expect(ErrorCode.TENANT_NOT_FOUND).toBe('TENANT_NOT_FOUND');
    expect(ErrorCode.ORGANIZATION_NOT_FOUND).toBe('ORGANIZATION_NOT_FOUND');
  });

  it('accessDeniedError never includes details', () => {
    const denied = accessDeniedError();
    expect(denied.details).toHaveLength(0);
  });
});
