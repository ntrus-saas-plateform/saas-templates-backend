import { LifecycleErrorCode, LifecycleStatus } from './lifecycle.types.js';

export type LifecycleTransitionDecision =
  | { allowed: true }
  | { allowed: false; code: LifecycleErrorCode; reason: string };

/**
 * Guard ACTIVE → SUSPENDING (technical suspend request).
 */
export function canRequestSuspend(
  status: LifecycleStatus | string,
): LifecycleTransitionDecision {
  if (status === LifecycleStatus.ACTIVE) {
    return { allowed: true };
  }
  return {
    allowed: false,
    code: LifecycleErrorCode.LIFECYCLE_FORBIDDEN,
    reason: `Suspend requires ACTIVE lifecycle; current=${status}`,
  };
}

/**
 * Guard SUSPENDED → RESUMING (technical resume request).
 */
export function canRequestResume(
  status: LifecycleStatus | string,
): LifecycleTransitionDecision {
  if (status === LifecycleStatus.SUSPENDED) {
    return { allowed: true };
  }
  return {
    allowed: false,
    code: LifecycleErrorCode.LIFECYCLE_FORBIDDEN,
    reason: `Resume requires SUSPENDED lifecycle; current=${status}`,
  };
}

export type DeprovisionGuardInput = {
  lifecycleStatus: LifecycleStatus | string;
  deletionProtection: boolean;
  authorized: boolean;
  confirmed: boolean;
  reason?: string | null;
  exportEvidenceRef?: string | null;
  requireExportEvidence?: boolean;
};

/**
 * Destructive deprovision guards:
 * - flags authorized+confirmed required
 * - reason required
 * - deletion_protection blocks until flags true
 * - optional export evidence requirement
 * - must not already be terminal DEPROVISIONED/DATA_PURGED
 */
export function canRequestDeprovision(input: DeprovisionGuardInput): LifecycleTransitionDecision {
  const terminal =
    input.lifecycleStatus === LifecycleStatus.DEPROVISIONED ||
    input.lifecycleStatus === LifecycleStatus.DATA_PURGED;
  if (terminal) {
    return {
      allowed: false,
      code: LifecycleErrorCode.LIFECYCLE_FORBIDDEN,
      reason: `Lifecycle already terminal (${input.lifecycleStatus})`,
    };
  }

  if (input.deletionProtection && !(input.authorized && input.confirmed)) {
    return {
      allowed: false,
      code: LifecycleErrorCode.DELETION_PROTECTED,
      reason: 'deletion_protection active — authorized+confirmed flags required',
    };
  }

  if (!(input.authorized === true && input.confirmed === true)) {
    return {
      allowed: false,
      code: LifecycleErrorCode.FLAGS_REQUIRED,
      reason: 'Deprovision requires authorized===true && confirmed===true',
    };
  }

  if (!input.reason?.trim()) {
    return {
      allowed: false,
      code: LifecycleErrorCode.VALIDATION,
      reason: 'Deprovision reason is required',
    };
  }

  if (input.requireExportEvidence !== false && !input.exportEvidenceRef?.trim()) {
    return {
      allowed: false,
      code: LifecycleErrorCode.EXPORT_EVIDENCE_REQUIRED,
      reason: 'exportEvidenceRef required before technical deprovision',
    };
  }

  const allowable = new Set<string>([
    LifecycleStatus.ACTIVE,
    LifecycleStatus.SUSPENDED,
    LifecycleStatus.FAILED,
    LifecycleStatus.ARCHIVED,
  ]);
  if (!allowable.has(String(input.lifecycleStatus))) {
    return {
      allowed: false,
      code: LifecycleErrorCode.LIFECYCLE_FORBIDDEN,
      reason: `Deprovision not allowed from status ${input.lifecycleStatus}`,
    };
  }

  return { allowed: true };
}

/** Status transition helpers used by mark_* handlers. */
export function assertTransition(
  from: LifecycleStatus | string,
  to: LifecycleStatus,
): LifecycleTransitionDecision {
  const allowed: Record<string, LifecycleStatus[]> = {
    [LifecycleStatus.ACTIVE]: [
      LifecycleStatus.SUSPENDING,
      LifecycleStatus.DEPROVISIONING,
      LifecycleStatus.MIGRATING,
      LifecycleStatus.ARCHIVING,
      LifecycleStatus.FAILED,
    ],
    [LifecycleStatus.SUSPENDING]: [
      LifecycleStatus.SUSPENDED,
      LifecycleStatus.FAILED,
      LifecycleStatus.ACTIVE,
    ],
    [LifecycleStatus.SUSPENDED]: [
      LifecycleStatus.RESUMING,
      LifecycleStatus.DEPROVISIONING,
      LifecycleStatus.ARCHIVING,
      LifecycleStatus.FAILED,
    ],
    [LifecycleStatus.RESUMING]: [
      LifecycleStatus.ACTIVE,
      LifecycleStatus.FAILED,
      LifecycleStatus.SUSPENDED,
    ],
    [LifecycleStatus.DEPROVISIONING]: [
      LifecycleStatus.DEPROVISIONED,
      LifecycleStatus.FAILED,
    ],
    [LifecycleStatus.ARCHIVING]: [LifecycleStatus.ARCHIVED, LifecycleStatus.FAILED],
    [LifecycleStatus.ARCHIVED]: [
      LifecycleStatus.RESTORING,
      LifecycleStatus.DEPROVISIONING,
      LifecycleStatus.FAILED,
    ],
    [LifecycleStatus.RESTORING]: [LifecycleStatus.ACTIVE, LifecycleStatus.FAILED],
    [LifecycleStatus.FAILED]: [
      LifecycleStatus.ACTIVE,
      LifecycleStatus.SUSPENDED,
      LifecycleStatus.DEPROVISIONING,
    ],
  };

  const targets = allowed[String(from)] ?? [];
  if (targets.includes(to)) {
    return { allowed: true };
  }
  return {
    allowed: false,
    code: LifecycleErrorCode.LIFECYCLE_FORBIDDEN,
    reason: `Forbidden transition ${from} → ${to}`,
  };
}
