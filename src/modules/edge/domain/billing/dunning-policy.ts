import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';

/**
 * RGOM-E7.6 / E8.4 — Billing dunning policy rules (edge_billing_policies.rules).
 * Fail-closed: unknown/invalid rules fall back to safe defaults; never invent cash truth.
 */

export type DunningRestrictionMode = 'NONE' | 'PAST_DUE' | 'SUSPEND';

export type DunningPolicyRules = {
  readonly graceDays: number;
  readonly maxRetries: number;
  /** During grace: mark subscription PAST_DUE (restriction without BB suspend). */
  readonly restrictDuringGrace: boolean;
  /** After grace ends: suspend subscription + BB tenant. */
  readonly suspendAfterGrace: boolean;
  /** Escalated collection case: suspend immediately regardless of remaining grace. */
  readonly suspendOnEscalate: boolean;
  /** Resolved collection: reactivate PAST_DUE/SUSPENDED subscriptions. */
  readonly reactivateOnResolve: boolean;
  readonly restrictionMode: DunningRestrictionMode;
};

export type DunningPhase = 'GRACE' | 'POST_GRACE' | 'ESCALATED' | 'RESOLVED' | 'INACTIVE';

export type DunningLifecycleAction =
  | 'NONE'
  | 'MARK_PAST_DUE'
  | 'SUSPEND'
  | 'REACTIVATE';

export type DunningEvaluation = {
  readonly phase: DunningPhase;
  readonly action: DunningLifecycleAction;
  readonly graceEndsAt: Date | null;
  readonly daysOverdue: number;
  readonly reason: string;
  readonly rules: DunningPolicyRules;
};

export const DEFAULT_DUNNING_POLICY_RULES: DunningPolicyRules = {
  graceDays: 7,
  maxRetries: 3,
  restrictDuringGrace: true,
  suspendAfterGrace: true,
  suspendOnEscalate: true,
  reactivateOnResolve: true,
  restrictionMode: 'PAST_DUE',
};

function asFiniteNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return fallback;
}

function asRestrictionMode(value: unknown): DunningRestrictionMode {
  if (value === 'NONE' || value === 'PAST_DUE' || value === 'SUSPEND') return value;
  return DEFAULT_DUNNING_POLICY_RULES.restrictionMode;
}

/** Parse JSONB rules from edge_billing_policies; never throws on partial input. */
export function parseDunningPolicyRules(
  rules: Record<string, unknown> | null | undefined,
): DunningPolicyRules {
  const src = rules ?? {};
  const graceDays = Math.max(0, Math.floor(asFiniteNumber(src.graceDays, DEFAULT_DUNNING_POLICY_RULES.graceDays)));
  const maxRetries = Math.max(
    0,
    Math.floor(asFiniteNumber(src.maxRetries, DEFAULT_DUNNING_POLICY_RULES.maxRetries)),
  );
  return {
    graceDays,
    maxRetries,
    restrictDuringGrace: asBoolean(
      src.restrictDuringGrace,
      DEFAULT_DUNNING_POLICY_RULES.restrictDuringGrace,
    ),
    suspendAfterGrace: asBoolean(
      src.suspendAfterGrace,
      DEFAULT_DUNNING_POLICY_RULES.suspendAfterGrace,
    ),
    suspendOnEscalate: asBoolean(
      src.suspendOnEscalate,
      DEFAULT_DUNNING_POLICY_RULES.suspendOnEscalate,
    ),
    reactivateOnResolve: asBoolean(
      src.reactivateOnResolve,
      DEFAULT_DUNNING_POLICY_RULES.reactivateOnResolve,
    ),
    restrictionMode: asRestrictionMode(src.restrictionMode),
  };
}

export function assertDunningPolicyActive(input: {
  status?: string | null;
  policyType?: string | null;
}): void {
  if (input.status && input.status !== 'ACTIVE') {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      `Billing policy status must be ACTIVE (got ${input.status})`,
      [{ code: 'BILLING_POLICY_INACTIVE' }],
    );
  }
  if (input.policyType && input.policyType !== 'DUNNING') {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      `Expected DUNNING policy type (got ${input.policyType})`,
      [{ code: 'BILLING_POLICY_TYPE_MISMATCH' }],
    );
  }
}

/**
 * Decide subscription lifecycle action from collection case + dunning policy.
 * Priority: RESOLVED → ESCALATED → grace window → post-grace.
 */
export function evaluateDunningLifecycle(input: {
  caseStatus: string;
  overdueSince: Date | null | undefined;
  asOf?: Date;
  rules: DunningPolicyRules;
  dunningAttemptCount?: number;
}): DunningEvaluation {
  const asOf = input.asOf ?? new Date();
  const rules = input.rules;
  const status = String(input.caseStatus ?? '').toUpperCase();

  if (status === 'RESOLVED' || status === 'WRITTEN_OFF') {
    return {
      phase: 'RESOLVED',
      action: rules.reactivateOnResolve ? 'REACTIVATE' : 'NONE',
      graceEndsAt: null,
      daysOverdue: 0,
      reason: rules.reactivateOnResolve
        ? 'Collection resolved — reactivate per billing policy'
        : 'Collection resolved — reactivation disabled by policy',
      rules,
    };
  }

  if (status === 'ESCALATED') {
    return {
      phase: 'ESCALATED',
      action: rules.suspendOnEscalate ? 'SUSPEND' : 'NONE',
      graceEndsAt: null,
      daysOverdue: 0,
      reason: rules.suspendOnEscalate
        ? 'Collection escalated — suspend per billing policy'
        : 'Collection escalated — suspendOnEscalate=false',
      rules,
    };
  }

  if (status !== 'OPEN' && status !== 'IN_PROGRESS') {
    return {
      phase: 'INACTIVE',
      action: 'NONE',
      graceEndsAt: null,
      daysOverdue: 0,
      reason: `Case status ${status} has no dunning lifecycle action`,
      rules,
    };
  }

  if (!input.overdueSince) {
    return {
      phase: 'GRACE',
      action: 'NONE',
      graceEndsAt: null,
      daysOverdue: 0,
      reason: 'overdueSince missing — cannot evaluate grace window (fail-closed)',
      rules,
    };
  }

  const overdueMs = asOf.getTime() - input.overdueSince.getTime();
  const daysOverdue = Math.max(0, Math.floor(overdueMs / (24 * 60 * 60 * 1000)));
  const graceEndsAt = new Date(
    input.overdueSince.getTime() + rules.graceDays * 24 * 60 * 60 * 1000,
  );
  const inGrace = asOf.getTime() < graceEndsAt.getTime();

  if (inGrace) {
    let action: DunningLifecycleAction = 'NONE';
    if (rules.restrictDuringGrace) {
      if (rules.restrictionMode === 'SUSPEND') action = 'SUSPEND';
      else if (rules.restrictionMode === 'PAST_DUE') action = 'MARK_PAST_DUE';
    }
    return {
      phase: 'GRACE',
      action,
      graceEndsAt,
      daysOverdue,
      reason: `Within grace (${daysOverdue}/${rules.graceDays} days) — ${action}`,
      rules,
    };
  }

  const retriesExceeded =
    typeof input.dunningAttemptCount === 'number' &&
    input.dunningAttemptCount >= rules.maxRetries;

  if (rules.suspendAfterGrace || retriesExceeded) {
    return {
      phase: 'POST_GRACE',
      action: 'SUSPEND',
      graceEndsAt,
      daysOverdue,
      reason: retriesExceeded
        ? `Max dunning retries (${rules.maxRetries}) exceeded — suspend`
        : `Grace ended (${rules.graceDays}d) — suspend per billing policy`,
      rules,
    };
  }

  return {
    phase: 'POST_GRACE',
    action: rules.restrictDuringGrace ? 'MARK_PAST_DUE' : 'NONE',
    graceEndsAt,
    daysOverdue,
    reason: 'Grace ended but suspendAfterGrace=false — keep restriction only',
    rules,
  };
}

export const PAYMENT_DELINQUENCY_REASON = 'PAYMENT_DELINQUENCY';
