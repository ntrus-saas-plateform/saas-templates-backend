import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import {
  AdministrativeStatus,
  GovernanceRequestStatus,
  GovernanceStatus,
  HealthStatus,
  LifecycleRequestType,
  RiskLevel,
} from './tenant-management.types.js';

export const HEALTH_FRESHNESS_MS = 15 * 60 * 1000;

const ADMINISTRATIVE_TRANSITIONS: Record<string, readonly string[]> = {
  PENDING_REVIEW: ['ACTIVE', 'RESTRICTED', 'SUSPENDED', 'ARCHIVED'],
  ACTIVE: ['RESTRICTED', 'SUSPENDED', 'DEACTIVATION_REQUESTED', 'TERMINATION_REQUESTED'],
  RESTRICTED: ['ACTIVE', 'SUSPENDED', 'DEACTIVATION_REQUESTED', 'TERMINATION_REQUESTED'],
  SUSPENDED: ['ACTIVE', 'RESTRICTED', 'DEACTIVATION_REQUESTED', 'TERMINATION_REQUESTED'],
  DEACTIVATION_REQUESTED: ['DEACTIVATED', 'ACTIVE'],
  DEACTIVATED: ['TERMINATION_REQUESTED', 'ARCHIVED', 'ACTIVE'],
  TERMINATION_REQUESTED: ['TERMINATED', 'ACTIVE', 'DEACTIVATED'],
  TERMINATED: ['ARCHIVED'],
  ARCHIVED: [],
};

export function assertAdministrativeTransition(from: string, to: string): void {
  const allowed = ADMINISTRATIVE_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw new DomainError(
      ErrorCode.CONFLICT,
      `Administrative transition ${from} → ${to} is not allowed`,
      [{ code: 'ADMIN_STATUS_TRANSITION_FORBIDDEN', from, to }],
    );
  }
}

export function canRequestLifecycle(
  adminStatus: string,
  requestType: LifecycleRequestType | string,
): { ok: true } | { ok: false; reason: string } {
  if (
    adminStatus === AdministrativeStatus.ARCHIVED ||
    adminStatus === AdministrativeStatus.TERMINATED
  ) {
    if (
      requestType !== LifecycleRequestType.RECOVER &&
      requestType !== LifecycleRequestType.ARCHIVE
    ) {
      return { ok: false, reason: 'Terminal administrative status blocks this request' };
    }
  }
  if (
    requestType === LifecycleRequestType.RESUME ||
    requestType === LifecycleRequestType.UNRESTRICT
  ) {
    if (
      adminStatus !== AdministrativeStatus.SUSPENDED &&
      adminStatus !== AdministrativeStatus.RESTRICTED &&
      adminStatus !== AdministrativeStatus.DEACTIVATED
    ) {
      return {
        ok: false,
        reason: 'Resume/unrestrict requires restricted, suspended or deactivated status',
      };
    }
  }
  if (
    requestType === LifecycleRequestType.TERMINATE &&
    adminStatus === AdministrativeStatus.TERMINATED
  ) {
    return { ok: false, reason: 'Tenant already terminated' };
  }
  return { ok: true };
}

export function assertSeparationOfDuties(requesterId: string, approverId: string): void {
  if (requesterId.trim().toLowerCase() === approverId.trim().toLowerCase()) {
    throw new DomainError(
      ErrorCode.FORBIDDEN,
      'Separation of duties: requester cannot approve their own request',
      [{ code: 'SELF_APPROVAL_FORBIDDEN' }],
    );
  }
}

export function assertNotLegalHold(legalHold: boolean, action: string): void {
  if (legalHold) {
    throw new DomainError(
      ErrorCode.CONFLICT,
      `Action ${action} blocked by legal hold`,
      [{ code: 'LEGAL_HOLD_ACTIVE', action }],
    );
  }
}

/** Lifecycle requests blocked while legal hold is active (AUD-P8-003). */
export const LIFECYCLE_REQUEST_BLOCKED_UNDER_LEGAL_HOLD = new Set<string>([
  LifecycleRequestType.SUSPEND,
  LifecycleRequestType.DEACTIVATE,
  LifecycleRequestType.TERMINATE,
  LifecycleRequestType.ARCHIVE,
  LifecycleRequestType.MIGRATE,
]);

export function assertLifecycleRequestAllowedUnderLegalHold(
  legalHold: boolean,
  requestType: LifecycleRequestType | string,
): void {
  if (legalHold && LIFECYCLE_REQUEST_BLOCKED_UNDER_LEGAL_HOLD.has(String(requestType))) {
    assertNotLegalHold(legalHold, String(requestType));
  }
}

export function assertLifecycleApprovalAllowedUnderLegalHold(
  legalHold: boolean,
  requestType: LifecycleRequestType | string,
): void {
  if (legalHold) {
    assertNotLegalHold(legalHold, `APPROVE_${requestType}`);
  }
}

export function isImmediateAdminLifecycleApproval(requestType: LifecycleRequestType | string): boolean {
  return (
    requestType === LifecycleRequestType.RESTRICT || requestType === LifecycleRequestType.UNRESTRICT
  );
}

/** Optional interim admin flags while P7 executes (AUD-P8-004). */
export function p7ApprovalAdministrativeIntent(
  requestType: LifecycleRequestType | string,
  currentAdministrativeStatus: string,
): AdministrativeStatus | null {
  if (requestType === LifecycleRequestType.DEACTIVATE) {
    if (currentAdministrativeStatus === AdministrativeStatus.DEACTIVATION_REQUESTED) {
      return null;
    }
    return AdministrativeStatus.DEACTIVATION_REQUESTED;
  }
  if (requestType === LifecycleRequestType.TERMINATE) {
    if (currentAdministrativeStatus === AdministrativeStatus.TERMINATION_REQUESTED) {
      return null;
    }
    return AdministrativeStatus.TERMINATION_REQUESTED;
  }
  return null;
}

const RECONCILIATION_MODE_ALIASES: Record<string, string> = {
  on_demand: 'ON_DEMAND',
  scheduled: 'SCHEDULED',
  event_driven: 'EVENT_DRIVEN',
  dry_run: 'DRY_RUN',
};

export function normalizeReconciliationMode(mode: string | undefined, dryRun?: boolean): string {
  const raw = (mode?.trim() || (dryRun ? 'dry_run' : 'on_demand')).toLowerCase();
  const normalized = RECONCILIATION_MODE_ALIASES[raw] ?? raw.toUpperCase();
  const allowed = new Set(['ON_DEMAND', 'DRY_RUN', 'SCHEDULED', 'EVENT_DRIVEN']);
  if (!allowed.has(normalized)) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      `Unsupported reconciliation mode: ${mode ?? raw}`,
      [{ code: 'RECONCILIATION_MODE_INVALID', mode: raw }],
    );
  }
  return normalized;
}

export function assertHealthSnapshotSource(overallStatus: string, sourceSystem: string): void {
  if (overallStatus !== HealthStatus.HEALTHY) {
    return;
  }
  const source = sourceSystem.trim().toLowerCase();
  if (!source) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      'HEALTHY snapshots require a trusted sourceSystem (p7.*, probe.*, or system.*)',
      [{ code: 'HEALTH_SOURCE_UNTRUSTED', sourceSystem }],
    );
  }
  if (
    !source.startsWith('p7.') &&
    !source.startsWith('probe.') &&
    !source.startsWith('system.')
  ) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      'HEALTHY snapshots require sourceSystem prefixed with p7., probe., or system.',
      [{ code: 'HEALTH_SOURCE_UNTRUSTED', sourceSystem }],
    );
  }
}

export function assertJustification(justification: string | null | undefined): void {
  if (!justification || justification.trim().length < 8) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      'Justification is required (min 8 characters)',
      [{ code: 'JUSTIFICATION_REQUIRED' }],
    );
  }
}

export function nextStatusAfterApproval(
  requestType: LifecycleRequestType | string,
): AdministrativeStatus | null {
  switch (requestType) {
    case LifecycleRequestType.SUSPEND:
      return AdministrativeStatus.SUSPENDED;
    case LifecycleRequestType.RESUME:
    case LifecycleRequestType.UNRESTRICT:
    case LifecycleRequestType.REACTIVATE:
      return AdministrativeStatus.ACTIVE;
    case LifecycleRequestType.RESTRICT:
      return AdministrativeStatus.RESTRICTED;
    case LifecycleRequestType.DEACTIVATE:
      return AdministrativeStatus.DEACTIVATION_REQUESTED;
    case LifecycleRequestType.TERMINATE:
      return AdministrativeStatus.TERMINATION_REQUESTED;
    case LifecycleRequestType.ARCHIVE:
      return AdministrativeStatus.ARCHIVED;
    default:
      return null;
  }
}

export function isApprovableStatus(status: string): boolean {
  return (
    status === GovernanceRequestStatus.PENDING ||
    status === GovernanceRequestStatus.WAITING_APPROVAL
  );
}

/** Dedicated P8 migration / recovery / termination tables awaiting approval. */
export function isDedicatedGovernanceApprovable(status: string): boolean {
  return status === 'REQUESTED';
}

export function unavailableGovernanceCheck(integration: string): Record<string, unknown> {
  return {
    availability: 'UNAVAILABLE',
    integration,
    evaluatedAt: new Date().toISOString(),
  };
}

export function slugifyTenantCode(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

export function coerceHealthOverallStatus(
  overallStatus: string,
  observedAt: Date,
  now = new Date(),
): HealthStatus | string {
  const age = now.getTime() - observedAt.getTime();
  if (overallStatus === HealthStatus.HEALTHY && age > HEALTH_FRESHNESS_MS) {
    return HealthStatus.STALE;
  }
  return overallStatus;
}

export type TenantRiskInput = {
  legalHold: boolean;
  activeExceptionCount: number;
  governanceStatus: string;
  openCriticalFindings: number;
};

export function evaluateTenantRiskLevel(
  input: TenantRiskInput,
): { riskLevel: RiskLevel; reasons: string[] } {
  const reasons: string[] = [];
  if (input.openCriticalFindings > 0) {
    reasons.push('OPEN_CRITICAL_RECONCILIATION_FINDINGS');
    return { riskLevel: RiskLevel.CRITICAL, reasons };
  }
  if (input.legalHold) {
    reasons.push('LEGAL_HOLD_ACTIVE');
    return { riskLevel: RiskLevel.HIGH, reasons };
  }
  if (
    input.governanceStatus === GovernanceStatus.NON_COMPLIANT ||
    input.governanceStatus === GovernanceStatus.UNDER_INVESTIGATION
  ) {
    reasons.push('NON_COMPLIANT_GOVERNANCE');
    return { riskLevel: RiskLevel.HIGH, reasons };
  }
  if (input.activeExceptionCount > 0) {
    reasons.push('ACTIVE_ADMINISTRATIVE_EXCEPTIONS');
    return { riskLevel: RiskLevel.MEDIUM, reasons };
  }
  if (input.governanceStatus === GovernanceStatus.REVIEW_REQUIRED) {
    reasons.push('GOVERNANCE_REVIEW_REQUIRED');
    return { riskLevel: RiskLevel.MEDIUM, reasons };
  }
  return { riskLevel: RiskLevel.LOW, reasons: ['BASELINE_LOW_RISK'] };
}

export function governanceStatusAfterExceptionApproval(): GovernanceStatus {
  return GovernanceStatus.EXCEPTION_PENDING;
}

export function governanceStatusAfterExceptionRevoke(
  activeExceptionCount: number,
  administrativePendingReview: boolean,
): GovernanceStatus {
  if (activeExceptionCount > 0) {
    return GovernanceStatus.EXCEPTION_PENDING;
  }
  if (administrativePendingReview) {
    return GovernanceStatus.REVIEW_REQUIRED;
  }
  return GovernanceStatus.COMPLIANT;
}

export const BULK_SENSITIVE_TYPES = new Set(['ASSIGN', 'CLASSIFY', 'RECONCILE']);

export const P7_DELEGATED_LIFECYCLE_TYPES = new Set<string>([
  LifecycleRequestType.SUSPEND,
  LifecycleRequestType.RESUME,
  LifecycleRequestType.DEACTIVATE,
  LifecycleRequestType.TERMINATE,
]);

export function assertLegalHoldLiftRequiresWorkflow(
  currentLegalHold: boolean,
  requestedLegalHold: boolean,
): void {
  if (currentLegalHold && !requestedLegalHold) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      'Legal hold lift requires approval workflow (request LIFT then approve)',
      [{ code: 'LEGAL_HOLD_LIFT_REQUIRES_APPROVAL' }],
    );
  }
}

export function p8TenantDeprovisionAllowed(tenant: {
  deletionProtection: boolean;
  metadata: Record<string, unknown>;
}): boolean {
  const meta = tenant.metadata ?? {};
  return (
    meta.p7DeprovisionAuthorized === true &&
    meta.p7DeprovisionConfirmed === true &&
    !tenant.deletionProtection
  );
}
