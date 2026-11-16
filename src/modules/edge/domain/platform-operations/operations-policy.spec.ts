import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import {
  assertAlertTransition,
  assertAutomationExecutionAllowed,
  assertAutomationNotClaimingExternalSuccess,
  assertChangeTransition,
  assertIncidentTransition,
  assertMonitoringConnectedRequiresProbe,
  assertNotificationDeliveryTransition,
  assertReleaseDeployedEvidence,
  assertReleaseTransition,
  assertRestoreSuccessRequiresEvidence,
  assertRootCauseConfirmation,
  assertSeparationOfDuties,
  assertSloMeasurementSourceTrusted,
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

  it('requires recovery evidenceKind and stronger refs for VERIFIED', () => {
    expect(() => assertRestoreSuccessRequiresEvidence('VERIFIED', 'ticket-abcdef', null)).toThrow(
      DomainError,
    );
    expect(() =>
      assertRestoreSuccessRequiresEvidence('VERIFIED', 'short', 'PROVIDER_TICKET'),
    ).toThrow(DomainError);
    expect(() =>
      assertRestoreSuccessRequiresEvidence('VERIFIED', 'ticket-abcdef12', 'PROVIDER_TICKET'),
    ).not.toThrow();
    expect(() =>
      assertRestoreSuccessRequiresEvidence('VERIFIED', 'override-1', 'MANUAL_OVERRIDE', 'too short'),
    ).toThrow(DomainError);
    expect(() =>
      assertRestoreSuccessRequiresEvidence(
        'VERIFIED',
        'override-1',
        'MANUAL_OVERRIDE',
        'Operator override with documented break-glass justification',
      ),
    ).not.toThrow();
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

  it('rejects automation results claiming external SUCCESS', () => {
    expect(() =>
      assertAutomationNotClaimingExternalSuccess({
        executionMode: 'RECORD_ONLY',
        providerSuccess: true,
      }),
    ).toThrow(expect.objectContaining({ code: ErrorCode.VALIDATION_ERROR }));
    expect(() =>
      assertAutomationNotClaimingExternalSuccess({
        executionMode: 'RECORD_ONLY',
        providerStatus: 'SUCCESS',
      }),
    ).toThrow(DomainError);
    expect(() =>
      assertAutomationNotClaimingExternalSuccess({
        executionMode: 'RECORD_ONLY',
        note: 'recorded only',
      }),
    ).not.toThrow();
  });

  it('rejects untrusted SLO measurement sources', () => {
    expect(() => assertSloMeasurementSourceTrusted('')).toThrow(DomainError);
    expect(() => assertSloMeasurementSourceTrusted('manual')).toThrow(DomainError);
    expect(() => assertSloMeasurementSourceTrusted('prometheus.sli')).not.toThrow();
  });

  it('enforces release DEPLOYED evidence and transitions', () => {
    expect(() => assertReleaseTransition('DRAFT', 'DEPLOYED')).toThrow(DomainError);
    expect(() => assertReleaseTransition('PROMOTING', 'DEPLOYED')).not.toThrow();
    expect(() =>
      assertReleaseDeployedEvidence({ status: 'DEPLOYED', artifactDigest: null }),
    ).toThrow(DomainError);
    expect(() =>
      assertReleaseDeployedEvidence({
        status: 'DEPLOYED',
        artifactDigest: 'sha256:abc',
      }),
    ).not.toThrow();
  });

  it('blocks QUEUED→DELIVERED skip without provider_ref', () => {
    expect(() => assertNotificationDeliveryTransition('QUEUED', 'DELIVERED', 'prov-1')).toThrow(
      expect.objectContaining({ code: ErrorCode.CONFLICT }),
    );
    expect(() => assertNotificationDeliveryTransition('QUEUED', 'SUBMITTED')).not.toThrow();
    expect(() => assertNotificationDeliveryTransition('SUBMITTED', 'DELIVERED', null)).toThrow(
      DomainError,
    );
    expect(() =>
      assertNotificationDeliveryTransition('SUBMITTED', 'DELIVERED', 'provider-msg-1'),
    ).not.toThrow();
  });

  it('requires UP probe before CONNECTED', () => {
    expect(() => assertMonitoringConnectedRequiresProbe('CONNECTED', null)).toThrow(DomainError);
    expect(() => assertMonitoringConnectedRequiresProbe('CONNECTED', 'DOWN')).toThrow(DomainError);
    expect(() => assertMonitoringConnectedRequiresProbe('CONNECTED', 'UP')).not.toThrow();
    expect(() => assertMonitoringConnectedRequiresProbe('CONFIGURED', null)).not.toThrow();
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
