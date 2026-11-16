import {
  FindingStatus,
  ObservationClass,
  ReconciliationErrorCode,
  RemediationStatus,
  type ReconciliationFindingRecord,
  type ReconciliationPolicyRecord,
  type ReconciliationRemediationRecord,
  type ReconciliationWaiverRecord,
} from './reconciliation.types.js';

export type ReconciliationDecision =
  | { allowed: true }
  | { allowed: false; code: ReconciliationErrorCode; reason: string };

export type DesiredResource = {
  resourceType: string;
  resourceRef: string;
  state?: Record<string, unknown>;
};

export type ObservedResource = {
  resourceType: string;
  resourceRef: string;
  state?: Record<string, unknown>;
};

export type ClassifiedFindingDraft = {
  findingCode: string;
  resourceType: string;
  resourceRef: string;
  observationClass: ObservationClass;
  severity: string;
  desiredState: Record<string, unknown>;
  observedState: Record<string, unknown>;
  lastKnownState: Record<string, unknown>;
  autoRemediateEligible: boolean;
  message: string;
  details: Record<string, unknown>;
};

/**
 * CRITICAL: timeout / unreachable ⇒ UNKNOWN — NEVER treat as deleted (MISSING).
 */
export function classifyObservations(input: {
  desired: DesiredResource[];
  observed: ObservedResource[];
  providerUnreachable?: boolean;
}): ClassifiedFindingDraft[] {
  if (input.providerUnreachable) {
    return input.desired.map((d) => ({
      findingCode: `UNKNOWN:${d.resourceType}:${d.resourceRef}`,
      resourceType: d.resourceType,
      resourceRef: d.resourceRef,
      observationClass: ObservationClass.UNKNOWN,
      severity: 'HIGH',
      desiredState: d.state ?? {},
      observedState: { providerUnreachable: true },
      lastKnownState: d.state ?? {},
      autoRemediateEligible: false,
      message:
        'Provider unreachable/timeout — observation class UNKNOWN (never treat as deleted)',
      details: {
        providerUnreachable: true,
        neverTreatAsDeleted: true,
        noBlindDelete: true,
      },
    }));
  }

  const desiredMap = new Map(
    input.desired.map((d) => [`${d.resourceType}::${d.resourceRef}`, d]),
  );
  const observedMap = new Map(
    input.observed.map((o) => [`${o.resourceType}::${o.resourceRef}`, o]),
  );
  const drafts: ClassifiedFindingDraft[] = [];

  for (const [key, desired] of desiredMap) {
    const observed = observedMap.get(key);
    if (!observed) {
      drafts.push({
        findingCode: `MISSING:${desired.resourceType}:${desired.resourceRef}`,
        resourceType: desired.resourceType,
        resourceRef: desired.resourceRef,
        observationClass: ObservationClass.MISSING,
        severity: 'HIGH',
        desiredState: desired.state ?? {},
        observedState: {},
        lastKnownState: desired.state ?? {},
        autoRemediateEligible: false,
        message: `Desired resource missing: ${desired.resourceRef}`,
        details: { noBlindDelete: true },
      });
      continue;
    }
    const desiredJson = JSON.stringify(desired.state ?? {});
    const observedJson = JSON.stringify(observed.state ?? {});
    if (desiredJson !== observedJson) {
      const conflict =
        Boolean((desired.state as { conflict?: boolean } | undefined)?.conflict) ||
        Boolean((observed.state as { conflict?: boolean } | undefined)?.conflict);
      drafts.push({
        findingCode: `${conflict ? 'CONFLICT' : 'DRIFT'}:${desired.resourceType}:${desired.resourceRef}`,
        resourceType: desired.resourceType,
        resourceRef: desired.resourceRef,
        observationClass: conflict ? ObservationClass.CONFLICT : ObservationClass.DRIFT,
        severity: conflict ? 'CRITICAL' : 'MEDIUM',
        desiredState: desired.state ?? {},
        observedState: observed.state ?? {},
        lastKnownState: observed.state ?? {},
        autoRemediateEligible: !conflict,
        message: conflict
          ? `Conflicting state for ${desired.resourceRef}`
          : `Drift detected for ${desired.resourceRef}`,
        details: { noBlindDelete: true },
      });
    }
  }

  for (const [key, observed] of observedMap) {
    if (desiredMap.has(key)) continue;
    drafts.push({
      findingCode: `UNEXPECTED:${observed.resourceType}:${observed.resourceRef}`,
      resourceType: observed.resourceType,
      resourceRef: observed.resourceRef,
      observationClass: ObservationClass.UNEXPECTED,
      severity: 'MEDIUM',
      desiredState: {},
      observedState: observed.state ?? {},
      lastKnownState: observed.state ?? {},
      autoRemediateEligible: false,
      message: `Unexpected resource observed: ${observed.resourceRef}`,
      details: {
        noBlindDelete: true,
        note: 'UNEXPECTED must not auto-delete — require approval',
      },
    });
  }

  return drafts;
}

/** Expired waivers are invalid — ACTIVE status alone is insufficient. */
export function isWaiverValid(
  waiver: Pick<ReconciliationWaiverRecord, 'waiverStatus' | 'expiresAt'>,
  now: Date = new Date(),
): boolean {
  if (String(waiver.waiverStatus) !== 'ACTIVE') return false;
  const expires =
    waiver.expiresAt instanceof Date ? waiver.expiresAt : new Date(String(waiver.expiresAt));
  return expires.getTime() > now.getTime();
}

export function assertWaiverUsable(
  waiver: Pick<ReconciliationWaiverRecord, 'waiverStatus' | 'expiresAt' | 'waiverCode'>,
  now: Date = new Date(),
): ReconciliationDecision {
  if (isWaiverValid(waiver, now)) return { allowed: true };
  return {
    allowed: false,
    code: ReconciliationErrorCode.WAIVER_EXPIRED,
    reason: `Waiver ${waiver.waiverCode} is expired or inactive (expiresAt=${String(waiver.expiresAt)})`,
  };
}

/**
 * Auto-remediate ONLY when:
 * finding.autoRemediateEligible AND policy.autoRemediate AND remediation.reversible.
 * Else deny → WAITING_APPROVAL / UNSAFE_AUTO_REMEDIATE.
 */
export function canAutoRemediate(input: {
  finding: Pick<
    ReconciliationFindingRecord,
    'autoRemediateEligible' | 'observationClass' | 'findingStatus'
  >;
  policy: Pick<ReconciliationPolicyRecord, 'autoRemediate' | 'requireApproval'>;
  remediation: Pick<ReconciliationRemediationRecord, 'reversible'>;
}): ReconciliationDecision {
  if (String(input.finding.observationClass) === ObservationClass.UNKNOWN) {
    return {
      allowed: false,
      code: ReconciliationErrorCode.UNKNOWN_STATE,
      reason: 'UNKNOWN observations must never auto-remediate (unreachable ≠ deleted)',
    };
  }
  if (String(input.finding.observationClass) === ObservationClass.UNEXPECTED) {
    return {
      allowed: false,
      code: ReconciliationErrorCode.UNSAFE_AUTO_REMEDIATE,
      reason: 'UNEXPECTED resources must not be auto-deleted (no blind deletes)',
    };
  }
  if (!input.finding.autoRemediateEligible) {
    return {
      allowed: false,
      code: ReconciliationErrorCode.UNSAFE_AUTO_REMEDIATE,
      reason: 'Finding is not autoRemediateEligible',
    };
  }
  if (!input.policy.autoRemediate) {
    return {
      allowed: false,
      code: ReconciliationErrorCode.APPROVAL_REQUIRED,
      reason: 'Policy autoRemediate is disabled',
    };
  }
  if (!input.remediation.reversible) {
    return {
      allowed: false,
      code: ReconciliationErrorCode.UNSAFE_AUTO_REMEDIATE,
      reason: 'Remediation is not reversible — approval required',
    };
  }
  if (input.policy.requireApproval) {
    return {
      allowed: false,
      code: ReconciliationErrorCode.APPROVAL_REQUIRED,
      reason: 'Policy requireApproval is true',
    };
  }
  return { allowed: true };
}

export function canRequestObserve(runStatus: string): ReconciliationDecision {
  const ok = ['PENDING', 'FAILED', 'PARTIAL', 'SUCCEEDED'].includes(String(runStatus));
  if (ok) return { allowed: true };
  if (String(runStatus) === 'RUNNING') {
    return {
      allowed: false,
      code: ReconciliationErrorCode.CONFLICT,
      reason: 'Run already RUNNING',
    };
  }
  return {
    allowed: false,
    code: ReconciliationErrorCode.VALIDATION,
    reason: `Observe not allowed for runStatus=${runStatus}`,
  };
}

export function canRequestRemediate(input: {
  findingStatus: string;
  observationClass: string;
}): ReconciliationDecision {
  if (String(input.observationClass) === ObservationClass.UNKNOWN) {
    return {
      allowed: false,
      code: ReconciliationErrorCode.UNKNOWN_STATE,
      reason: 'Cannot remediate UNKNOWN (unreachable) — quarantine or re-observe',
    };
  }
  const open =
    input.findingStatus === FindingStatus.OPEN ||
    input.findingStatus === FindingStatus.REMEDIATING;
  if (!open) {
    return {
      allowed: false,
      code: ReconciliationErrorCode.VALIDATION,
      reason: `Remediate requires OPEN/REMEDIATING finding; current=${input.findingStatus}`,
    };
  }
  return { allowed: true };
}

export function canApproveRemediation(input: {
  remediationStatus: string;
  authorizationRevalidated: boolean;
}): ReconciliationDecision {
  if (!input.authorizationRevalidated) {
    return {
      allowed: false,
      code: ReconciliationErrorCode.AUTHORIZATION_FAILED,
      reason: 'P7.1 authorization must be revalidated before approving remediation (fail-closed)',
    };
  }
  const ok =
    input.remediationStatus === RemediationStatus.WAITING_APPROVAL ||
    input.remediationStatus === RemediationStatus.PENDING;
  if (!ok) {
    return {
      allowed: false,
      code: ReconciliationErrorCode.CONFLICT,
      reason: `Approve requires WAITING_APPROVAL/PENDING; current=${input.remediationStatus}`,
    };
  }
  return { allowed: true };
}

export function canQuarantineFinding(findingStatus: string): ReconciliationDecision {
  if (
    findingStatus === FindingStatus.QUARANTINED ||
    findingStatus === FindingStatus.REMEDIATED ||
    findingStatus === FindingStatus.EXPIRED
  ) {
    return {
      allowed: false,
      code: ReconciliationErrorCode.CONFLICT,
      reason: `Cannot quarantine finding in status ${findingStatus}`,
    };
  }
  return { allowed: true };
}

/** Apply active non-expired waivers → mark matching drafts as WAIVED. */
export function applyActiveWaivers(
  drafts: ClassifiedFindingDraft[],
  waivers: ReconciliationWaiverRecord[],
  now: Date = new Date(),
): {
  remaining: ClassifiedFindingDraft[];
  waived: Array<ClassifiedFindingDraft & { waiverCode: string }>;
} {
  const active = waivers.filter((w) => isWaiverValid(w, now));
  const waived: Array<ClassifiedFindingDraft & { waiverCode: string }> = [];
  const remaining: ClassifiedFindingDraft[] = [];

  for (const draft of drafts) {
    const match = active.find((w) => {
      if (w.findingId) return false; // finding-id waivers applied after persist
      const meta = w.metadata ?? {};
      const code = typeof meta.findingCode === 'string' ? meta.findingCode : null;
      const ref = typeof meta.resourceRef === 'string' ? meta.resourceRef : null;
      if (code && code === draft.findingCode) return true;
      if (ref && ref === draft.resourceRef && String(meta.resourceType) === draft.resourceType) {
        return true;
      }
      return w.waiverCode === draft.findingCode || w.waiverCode === draft.resourceRef;
    });
    if (match) {
      waived.push({ ...draft, waiverCode: match.waiverCode });
    } else {
      remaining.push(draft);
    }
  }
  return { remaining, waived };
}
