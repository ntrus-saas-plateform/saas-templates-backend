import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import {
  assertAlertTransition,
  assertAutomationExecutionAllowed,
  assertChangeTransition,
  assertIncidentTransition,
  assertRestoreSuccessRequiresEvidence,
  assertRootCauseConfirmation,
  assertSeparationOfDuties,
  assertTrustedHealthSource,
  windowsOverlap,
} from './operations-policy.js';

describe('P9 operations-policy', () => {
  it('allows valid alert transitions and rejects illegal ones', () => {
    expect(() => assertAlertTransition('ACTIVE', 'ACKNOWLEDGED')).not.toThrow();
    expect(() => assertAlertTransition('RESOLVED', 'ACTIVE')).toThrow(
      expect.objectContaining({ code: ErrorCode.CONFLICT }),
    );
  });

  it('allows valid incident transitions', () => {
    expect(() => assertIncidentTransition('DETECTED', 'TRIAGED')).not.toThrow();
    expect(() => assertIncidentTransition('CLOSED', 'MITIGATING')).toThrow(DomainError);
  });

  it('enforces change transitions and SoD', () => {
    expect(() => assertChangeTransition('DRAFT', 'SUBMITTED')).not.toThrow();
    expect(() => assertChangeTransition('DRAFT', 'APPROVED')).toThrow(DomainError);
    expect(() => assertSeparationOfDuties('alice', 'bob')).not.toThrow();
    expect(() => assertSeparationOfDuties('alice', 'Alice')).toThrow(
      expect.objectContaining({ code: ErrorCode.FORBIDDEN }),
    );
  });

  it('rejects HEALTHY without trusted source', () => {
    expect(() => assertTrustedHealthSource('HEALTHY', 'manual')).toThrow(
      expect.objectContaining({ code: ErrorCode.VALIDATION_ERROR }),
    );
    expect(() => assertTrustedHealthSource('HEALTHY', 'prometheus.cluster')).not.toThrow();
    expect(() => assertTrustedHealthSource('DEGRADED', 'manual')).not.toThrow();
  });

  it('requires recovery evidence for VERIFIED', () => {
    expect(() => assertRestoreSuccessRequiresEvidence('VERIFIED', null)).toThrow(DomainError);
    expect(() => assertRestoreSuccessRequiresEvidence('VERIFIED', 'ev-1234')).not.toThrow();
  });

  it('requires root-cause reviewer when confirmed', () => {
    expect(() => assertRootCauseConfirmation(true, '')).toThrow(DomainError);
    expect(() => assertRootCauseConfirmation(true, 'reviewer-1')).not.toThrow();
  });

  it('blocks destructive automation without approval', () => {
    expect(() =>
      assertAutomationExecutionAllowed({
        destructive: true,
        requiresApproval: true,
        approvedBy: null,
        status: 'REQUESTED',
      }),
    ).toThrow(expect.objectContaining({ code: ErrorCode.FORBIDDEN }));
    expect(() =>
      assertAutomationExecutionAllowed({
        destructive: true,
        requiresApproval: true,
        approvedBy: 'approver',
        status: 'APPROVED',
      }),
    ).not.toThrow();
    expect(() =>
      assertAutomationExecutionAllowed({
        destructive: false,
        requiresApproval: false,
        approvedBy: null,
        status: 'REQUESTED',
      }),
    ).not.toThrow();
  });

  it('detects overlapping windows', () => {
    const a0 = new Date('2026-01-01T10:00:00Z');
    const a1 = new Date('2026-01-01T12:00:00Z');
    const b0 = new Date('2026-01-01T11:00:00Z');
    const b1 = new Date('2026-01-01T13:00:00Z');
    expect(windowsOverlap(a0, a1, b0, b1)).toBe(true);
    expect(windowsOverlap(a0, a1, new Date('2026-01-01T12:00:00Z'), b1)).toBe(false);
  });
});
