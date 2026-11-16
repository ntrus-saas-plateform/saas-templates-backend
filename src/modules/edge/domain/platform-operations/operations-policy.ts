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

const RELEASE_TRANSITIONS: Record<string, readonly string[]> = {
  DRAFT: ['SCHEDULED', 'PROMOTING', 'CANCELLED'],
  SCHEDULED: ['PROMOTING', 'CANCELLED'],
  PROMOTING: ['DEPLOYED', 'FAILED', 'CANCELLED'],
  DEPLOYED: ['ROLLED_BACK'],
  FAILED: ['ROLLED_BACK', 'CANCELLED'],
  ROLLED_BACK: [],
  CANCELLED: [],
};

const NOTIFICATION_TRANSITIONS: Record<string, readonly string[]> = {
  QUEUED: ['SUBMITTED', 'FAILED', 'EXPIRED', 'CANCELLED'],
  SUBMITTED: ['ACCEPTED', 'FAILED', 'DELIVERED', 'EXPIRED'],
  ACCEPTED: ['DELIVERED', 'FAILED', 'ACKNOWLEDGED', 'EXPIRED'],
  DELIVERED: ['ACKNOWLEDGED', 'EXPIRED'],
  ACKNOWLEDGED: [],
  FAILED: ['QUEUED', 'EXPIRED'],
  EXPIRED: [],
};

const TRUSTED_SOURCE_PREFIXES = ['p7.', 'probe.', 'otel.', 'prometheus.', 'system.', 'slo.'] as const;

function isTrustedSource(sourceSystem: string): boolean {
  const source = sourceSystem.trim().toLowerCase();
  return TRUSTED_SOURCE_PREFIXES.some((p) => source.startsWith(p));
}

function isNonEmptyEvidenceRef(ref: string | null | undefined): boolean {
  if (ref == null) return false;
  const trimmed = ref.trim();
  return trimmed.length >= 8 && !/^\s+$/.test(ref);
}

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

export function assertReleaseTransition(from: string, to: string): void {
  const allowed = RELEASE_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw new DomainError(
      ErrorCode.CONFLICT,
      `Release transition ${from} → ${to} is not allowed`,
      [{ code: 'RELEASE_TRANSITION_FORBIDDEN', from, to }],
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
  if (!isTrustedSource(sourceSystem)) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      'HEALTHY snapshots require trusted sourceSystem (p7.|probe.|otel.|prometheus.|system.)',
      [{ code: 'HEALTH_SOURCE_UNTRUSTED', sourceSystem }],
    );
  }
}

/**
 * Production-grade SLO recording rejects empty/manual sources unless trusted prefix.
 */
export function assertSloMeasurementSourceTrusted(sourceSystem: string): void {
  const source = sourceSystem?.trim() ?? '';
  if (!source) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      'SLO measurement requires non-empty sourceSystem',
      [{ code: 'SLO_SOURCE_EMPTY' }],
    );
  }
  const lower = source.toLowerCase();
  if (lower === 'manual' || lower.startsWith('manual.') || lower === 'operator') {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      'SLO measurement rejects manual/operator sources for production-grade recording',
      [{ code: 'SLO_SOURCE_UNTRUSTED', sourceSystem }],
    );
  }
  if (!isTrustedSource(source)) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      'SLO measurement requires trusted sourceSystem (p7.|probe.|otel.|prometheus.|system.|slo.)',
      [{ code: 'SLO_SOURCE_UNTRUSTED', sourceSystem }],
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

export type RecoveryEvidenceKind =
  | 'PROVIDER_TICKET'
  | 'BACKUP_JOB_ID'
  | 'DR_EXERCISE_REF'
  | 'MANUAL_OVERRIDE';

/**
 * VERIFIED requires evidenceKind + non-trivial evidence ref.
 * MANUAL_OVERRIDE additionally requires justification length >= 20.
 */
export function assertRestoreSuccessRequiresEvidence(
  status: string,
  externalEvidenceRef: string | null | undefined,
  evidenceKind?: RecoveryEvidenceKind | string | null,
  justification?: string | null,
): void {
  if (status !== 'VERIFIED') return;

  if (!evidenceKind || String(evidenceKind).trim().length < 1) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      'Restore/recovery cannot be VERIFIED without evidenceKind',
      [{ code: 'RECOVERY_EVIDENCE_KIND_REQUIRED' }],
    );
  }

  const kind = String(evidenceKind).trim().toUpperCase();
  if (kind === 'MANUAL_OVERRIDE') {
    const just = justification?.trim() ?? '';
    if (just.length < 20) {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        'MANUAL_OVERRIDE recovery VERIFIED requires justification (>=20 chars)',
        [{ code: 'RECOVERY_MANUAL_JUSTIFICATION_REQUIRED' }],
      );
    }
    if (!externalEvidenceRef || externalEvidenceRef.trim().length < 4) {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        'Restore/recovery cannot be VERIFIED without external evidence',
        [{ code: 'RECOVERY_EVIDENCE_REQUIRED' }],
      );
    }
    return;
  }

  if (!isNonEmptyEvidenceRef(externalEvidenceRef)) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      'Provider recovery evidence ref must be at least 8 non-space characters',
      [{ code: 'RECOVERY_EVIDENCE_REF_WEAK', evidenceKind: kind }],
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

/**
 * Reject result payloads that claim external provider SUCCESS without real adapters.
 * RECORD_ONLY executions must not invent provider outcomes.
 */
export function assertAutomationNotClaimingExternalSuccess(
  result: Record<string, unknown>,
): void {
  const mode = String(result.executionMode ?? '').toUpperCase();
  if (mode && mode !== 'RECORD_ONLY') {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      'Automation executionMode must be RECORD_ONLY until a controlled executor is wired',
      [{ code: 'AUTOMATION_EXECUTION_MODE_FORBIDDEN', executionMode: mode }],
    );
  }

  const claimKeys = [
    'providerSuccess',
    'externalSuccess',
    'providerStatus',
    'externalProviderStatus',
    'claimedSuccess',
  ];
  for (const key of claimKeys) {
    const value = result[key];
    if (value === true) {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        'Automation cannot claim external provider success in RECORD_ONLY mode',
        [{ code: 'AUTOMATION_FAKE_PROVIDER_SUCCESS', key }],
      );
    }
    if (typeof value === 'string') {
      const upper = value.trim().toUpperCase();
      if (upper === 'SUCCESS' || upper === 'SUCCEEDED' || upper === 'OK' || upper === 'DELIVERED') {
        throw new DomainError(
          ErrorCode.VALIDATION_ERROR,
          'Automation cannot claim external provider SUCCESS in RECORD_ONLY mode',
          [{ code: 'AUTOMATION_FAKE_PROVIDER_SUCCESS', key, value }],
        );
      }
    }
  }
}

/** DEPLOYED requires artifactDigest or externalEvidenceRef — never silent success. */
export function assertReleaseDeployedEvidence(input: {
  status: string;
  artifactDigest?: string | null;
  externalEvidenceRef?: string | null;
}): void {
  if (input.status !== 'DEPLOYED') return;
  const digest = input.artifactDigest?.trim() ?? '';
  const evidence = input.externalEvidenceRef?.trim() ?? '';
  if (digest.length < 1 && evidence.length < 1) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      'DEPLOYED requires artifactDigest or externalEvidenceRef',
      [{ code: 'RELEASE_DEPLOYED_EVIDENCE_REQUIRED' }],
    );
  }
}

/**
 * Notification delivery transitions. Cannot skip QUEUED→DELIVERED without provider_ref.
 * DELIVERED/ACKNOWLEDGED always require provider_ref evidence.
 */
export function assertNotificationDeliveryTransition(
  from: string,
  to: string,
  providerRef?: string | null,
): void {
  const allowed = NOTIFICATION_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    // Explicit illegal skip: QUEUED → DELIVERED is never in allowed map
    throw new DomainError(
      ErrorCode.CONFLICT,
      `Notification delivery transition ${from} → ${to} is not allowed`,
      [{ code: 'NOTIFICATION_TRANSITION_FORBIDDEN', from, to }],
    );
  }

  if (
    (from === 'QUEUED' && (to === 'DELIVERED' || to === 'ACKNOWLEDGED')) ||
    (from === 'QUEUED' && to === 'DELIVERED')
  ) {
    throw new DomainError(
      ErrorCode.CONFLICT,
      'Cannot skip QUEUED→DELIVERED without SUBMITTED and provider_ref',
      [{ code: 'NOTIFICATION_SKIP_FORBIDDEN', from, to }],
    );
  }

  if (to === 'DELIVERED' || to === 'ACKNOWLEDGED') {
    const ref = providerRef?.trim() ?? '';
    if (ref.length < 1) {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        'DELIVERED/ACKNOWLEDGED require provider_ref evidence',
        [{ code: 'NOTIFICATION_PROVIDER_REF_REQUIRED', to }],
      );
    }
  }
}

/** CONNECTED monitoring sources require a successful UP probe — never set from connect alone. */
export function assertMonitoringConnectedRequiresProbe(
  targetStatus: string,
  lastProbeOutcome: string | null | undefined,
): void {
  if (targetStatus !== 'CONNECTED') return;
  if (String(lastProbeOutcome ?? '').toUpperCase() !== 'UP') {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      'Monitoring source CONNECTED requires a successful UP probe',
      [{ code: 'MONITORING_CONNECTED_REQUIRES_PROBE' }],
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
