import { describe, expect, it } from 'vitest';
import type { Request } from 'express';
import { getAuditBefore, setAuditBefore } from './audit-before.js';

describe('audit-before (§51)', () => {
  it('stores sanitized before snapshot on the request', () => {
    const req = {} as Request;
    setAuditBefore(req, {
      id: 'disp-1',
      status: 'VERIFIED',
      password: 'secret',
    });
    const before = getAuditBefore(req);
    expect(before?.id).toBe('disp-1');
    expect(before?.status).toBe('VERIFIED');
    expect(before?.password).toBe('[REDACTED]');
  });

  it('returns null when unset', () => {
    expect(getAuditBefore({} as Request)).toBeNull();
  });
});
