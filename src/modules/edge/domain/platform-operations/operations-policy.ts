import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';

const ALERT_TRANSITIONS: Record<string, readonly string[]> = {
  RECEIVED: ['NORMALIZED', 'CANCELLED', 'EXPIRED'],
  NORMALIZED: ['CORRELATED', 'ACTIVE', 'SUPPRESSED', 'CANCELLED'],
  CORRELATED: ['ACTIVE', 'SUPPRESSED', 'CANCELLED'],
  ACTIVE: ['ACKNOWLEDGED', 'SUPPRESSED', 'RESOLVED', 'CANCELLED'],
  ACKNOWLEDGED: ['RESOLVED', 'SUPPRESSED', 'ACTIVE'],
  SUPPRESSED: ['ACTIVE', 'RESOLVED', 'CANCELLED', 'EXPIRED'],
  RESOLVED: [],
  EXPIRED: [],
  CANCELLED: [],
};

const INCIDENT_TRANSITIONS: Record<string, readonly string[]> = {
  DETECTED: ['TRIAGED', 'ACKNOWLEDGED', 'CLOSED'],
  TRIAGED: ['ACKNOWLEDGED', 'INVESTIGATING', 'CLOSED'],
  ACKNOWLEDGED: ['INVESTIGATING', 'MITIGATING', 'CLOSED'],
  INVESTIGATING: ['MITIGATING', 'MONITORING', 'RESOLVED'],
  MITIGATING: ['MONITORING', 'RESOLVED', 'INVESTIGATING'],
  MONITORING: ['RESOLVED', 'INVESTIGATING', 'MITIGATING'],
  RESOLVED: ['CLOSED', 'REOPENED'],
  CLOSED: ['REOPENED'],
  REOPENED: ['TRIAGED', 'ACKNOWLEDGED', 'INVESTIGATING'],
};

const CHANGE_TRANSITIONS: Record<string, readonly string[]> = {
  DRAFT: ['SUBMITTED', 'CANCELLED'],
  SUBMITTED: ['ASSESSED', 'REJECTED', 'CANCELLED'],
  ASSESSED: ['APPROVED', 'REJECTED', 'CANCELLED'],
  APPROVED: ['SCHEDULED', 'EXECUTING', 'CANCELLED'],
  SCHEDULED: ['EXECUTING', 'CANCELLED'],
  EXECUTING: ['VALIDATING', 'FAILED', 'ROLLED_BACK'],
  VALIDATING: ['COMPLETED', 'FAILED', 'ROLLED_BACK'],
  COMPLETED: [],
  FAILED: ['ROLLED_BACK', 'CANCELLED'],
  ROLLED_BACK: [],
  REJECTED: [],
  CANCELLED: [],
};

export function assertAlertTransition(from: string, to: string): void {
  const allowed = ALERT_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw new DomainError(
      ErrorCode.CONFLICT,
      `Alert transition ${from} → ${to} is not allowed`,
      [{ code: 'ALERT_TRANSITION_FORBIDDEN', from, to }],
    );
  }
}

export function assertIncidentTransition(from: string, to: string): void {
  const allowed = INCIDENT_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw new DomainError(
      ErrorCode.CONFLICT,
      `Incident transition ${from} → ${to} is not allowed`,
      [{ code: 'INCIDENT_TRANSITION_FORBIDDEN', from, to }],
    );
  }
}

export function assertChangeTransition(from: string, to: string): void {
  const allowed = CHANGE_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw new DomainError(
      ErrorCode.CONFLICT,
      `Change transition ${from} → ${to} is not allowed`,
      [{ code: 'CHANGE_TRANSITION_FORBIDDEN', from, to }],
    );
  }
}

export function assertSeparationOfDuties(requesterId: string, approverId: string): void {
  if (requesterId.trim().toLowerCase() === approverId.trim().toLowerCase()) {
    throw new DomainError(
      ErrorCode.FORBIDDEN,
      'Separation of duties: actor cannot approve their own request',
      [{ code: 'SELF_APPROVAL_FORBIDDEN' }],
    );
  }
}

/** HEALTHY requires trusted source prefix — never fabricate. */
export function assertTrustedHealthSource(overallStatus: string, sourceSystem: string): void {
  if (overallStatus !== 'HEALTHY') return;
  const source = sourceSystem.trim().toLowerCase();
  if (
    !source.startsWith('p7.') &&
    !source.startsWith('probe.') &&
    !source.startsWith('otel.') &&
    !source.startsWith('prometheus.') &&
    !source.startsWith('system.')
  ) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      'HEALTHY snapshots require trusted sourceSystem (p7.|probe.|otel.|prometheus.|system.)',
      [{ code: 'HEALTH_SOURCE_UNTRUSTED', sourceSystem }],
    );
  }
}

export function assertRootCauseConfirmation(confirmed: boolean, reviewerId: string | null | undefined): void {
  if (confirmed && (!reviewerId || reviewerId.trim().length < 2)) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      'Confirmed root cause requires accountable reviewer',
      [{ code: 'ROOT_CAUSE_REVIEWER_REQUIRED' }],
    );
  }
}

export function assertRestoreSuccessRequiresEvidence(
  status: string,
  externalEvidenceRef: string | null | undefined,
): void {
  if (status === 'VERIFIED' && (!externalEvidenceRef || externalEvidenceRef.trim().length < 4)) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      'Restore/recovery cannot be VERIFIED without external evidence',
      [{ code: 'RECOVERY_EVIDENCE_REQUIRED' }],
    );
  }
}

export function assertAutomationExecutionAllowed(input: {
  destructive: boolean;
  requiresApproval: boolean;
  approvedBy: string | null | undefined;
  status: string;
}): void {
  if (input.status !== 'APPROVED' && input.status !== 'REQUESTED') {
    throw new DomainError(ErrorCode.CONFLICT, 'Automation execution not in executable state');
  }
  if ((input.destructive || input.requiresApproval) && input.status === 'REQUESTED') {
    throw new DomainError(
      ErrorCode.FORBIDDEN,
      'Automation requires approval before execution',
      [{ code: 'AUTOMATION_APPROVAL_REQUIRED' }],
    );
  }
  if ((input.destructive || input.requiresApproval) && !input.approvedBy) {
    throw new DomainError(
      ErrorCode.FORBIDDEN,
      'Approved automation missing approver',
      [{ code: 'AUTOMATION_APPROVER_MISSING' }],
    );
  }
}

export function windowsOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean {
  return aStart < bEnd && bStart < aEnd;
}
