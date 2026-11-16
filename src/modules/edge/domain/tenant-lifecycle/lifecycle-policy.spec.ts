import { describe, expect, it } from 'vitest';
import {
  assertTransition,
  canRequestDeprovision,
  canRequestResume,
  canRequestSuspend,
} from './lifecycle-policy.js';
import { LifecycleErrorCode, LifecycleStatus } from './lifecycle.types.js';

describe('canRequestSuspend', () => {
  it('allows ACTIVE → SUSPENDING', () => {
    expect(canRequestSuspend(LifecycleStatus.ACTIVE)).toEqual({ allowed: true });
  });

  it('rejects non-ACTIVE', () => {
    const d = canRequestSuspend(LifecycleStatus.SUSPENDED);
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.code).toBe(LifecycleErrorCode.LIFECYCLE_FORBIDDEN);
  });
});

describe('canRequestResume', () => {
  it('allows SUSPENDED → RESUMING', () => {
    expect(canRequestResume(LifecycleStatus.SUSPENDED)).toEqual({ allowed: true });
  });

  it('rejects ACTIVE', () => {
    const d = canRequestResume(LifecycleStatus.ACTIVE);
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.code).toBe(LifecycleErrorCode.LIFECYCLE_FORBIDDEN);
  });
});

describe('canRequestDeprovision', () => {
  const base = {
    lifecycleStatus: LifecycleStatus.ACTIVE,
    deletionProtection: true,
    authorized: true,
    confirmed: true,
    reason: 'customer offboard',
    exportEvidenceRef: 'export://job-1',
  };

  it('allows when flags, reason, and export evidence present', () => {
    expect(canRequestDeprovision(base)).toEqual({ allowed: true });
  });

  it('blocks when deletion_protection and flags missing', () => {
    const d = canRequestDeprovision({
      ...base,
      authorized: false,
      confirmed: false,
    });
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.code).toBe(LifecycleErrorCode.DELETION_PROTECTED);
  });

  it('requires authorized===true && confirmed===true', () => {
    const d = canRequestDeprovision({
      ...base,
      deletionProtection: false,
      authorized: true,
      confirmed: false,
    });
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.code).toBe(LifecycleErrorCode.FLAGS_REQUIRED);
  });

  it('requires reason', () => {
    const d = canRequestDeprovision({ ...base, reason: '  ' });
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.code).toBe(LifecycleErrorCode.VALIDATION);
  });

  it('requires export evidence by default', () => {
    const d = canRequestDeprovision({ ...base, exportEvidenceRef: null });
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.code).toBe(LifecycleErrorCode.EXPORT_EVIDENCE_REQUIRED);
  });
});

describe('assertTransition', () => {
  it('allows ACTIVE → SUSPENDING and SUSPENDED → RESUMING', () => {
    expect(assertTransition(LifecycleStatus.ACTIVE, LifecycleStatus.SUSPENDING).allowed).toBe(
      true,
    );
    expect(assertTransition(LifecycleStatus.SUSPENDED, LifecycleStatus.RESUMING).allowed).toBe(
      true,
    );
  });

  it('rejects ACTIVE → DEPROVISIONED (must pass DEPROVISIONING)', () => {
    const d = assertTransition(LifecycleStatus.ACTIVE, LifecycleStatus.DEPROVISIONED);
    expect(d.allowed).toBe(false);
  });
});
