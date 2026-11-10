import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import { WorkflowErrorClass, type RetryPolicyDefaults } from './workflow.types.js';

export const DEFAULT_RETRY_POLICY: RetryPolicyDefaults = {
  maxAttempts: 3,
  initialDelayMs: 1_000,
  maxDelayMs: 60_000,
  multiplier: 2,
  jitterRatio: 0.2,
};

export function classifyError(raw: unknown): WorkflowErrorClass {
  if (raw == null) return WorkflowErrorClass.UNKNOWN;
  if (typeof raw === 'string') {
    const upper = raw.toUpperCase();
    if ((Object.values(WorkflowErrorClass) as string[]).includes(upper)) {
      return upper as WorkflowErrorClass;
    }
    if (/revok|unauthorized|forbidden/i.test(raw)) {
      return WorkflowErrorClass.AUTHORIZATION_REVOKED;
    }
    if (/timeout|timed.?out/i.test(raw)) return WorkflowErrorClass.TIMEOUT;
    if (/unavailable|not.?configured|ECONN|ENOTFOUND/i.test(raw)) {
      return WorkflowErrorClass.DEPENDENCY_UNAVAILABLE;
    }
    if (/conflict|duplicate|version/i.test(raw)) return WorkflowErrorClass.CONFLICT;
    if (/validat|schema|invalid/i.test(raw)) return WorkflowErrorClass.VALIDATION;
    if (/permanent|fatal|not.?found/i.test(raw)) return WorkflowErrorClass.PERMANENT;
    if (/transient|retry|temporar/i.test(raw)) return WorkflowErrorClass.TRANSIENT;
    return WorkflowErrorClass.UNKNOWN;
  }
  if (typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    if (typeof obj.code === 'string') return classifyError(obj.code);
    if (typeof obj.errorClass === 'string') return classifyError(obj.errorClass);
    if (typeof obj.message === 'string') return classifyError(obj.message);
  }
  return WorkflowErrorClass.UNKNOWN;
}

export function classifyRetryability(errorClass: WorkflowErrorClass | string): boolean {
  switch (errorClass) {
    case WorkflowErrorClass.TRANSIENT:
    case WorkflowErrorClass.TIMEOUT:
    case WorkflowErrorClass.DEPENDENCY_UNAVAILABLE:
    case WorkflowErrorClass.UNKNOWN:
      return true;
    case WorkflowErrorClass.PERMANENT:
    case WorkflowErrorClass.CONFLICT:
    case WorkflowErrorClass.AUTHORIZATION_REVOKED:
    case WorkflowErrorClass.VALIDATION:
      return false;
    default:
      return false;
  }
}

export function isRetryable(
  errorClass: WorkflowErrorClass | string,
  policy: RetryPolicyDefaults,
  attemptCount: number,
): boolean {
  if (attemptCount >= policy.maxAttempts) return false;
  return classifyRetryability(errorClass);
}

export function assertRetryAllowed(
  errorClass: WorkflowErrorClass | string,
  policy: RetryPolicyDefaults,
  attemptCount: number,
): void {
  if (!isRetryable(errorClass, policy, attemptCount)) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      `Retry not allowed for ${errorClass} (attempt ${attemptCount}/${policy.maxAttempts})`,
      [{ errorClass, attemptCount, maxAttempts: policy.maxAttempts }],
    );
  }
}

/** Deterministic jitter from attempt number (no Math.random — durable scheduling). */
export function computeBackoffMs(
  attemptNumber: number,
  policy: Partial<RetryPolicyDefaults> = {},
  seed = 0,
): number {
  const merged: RetryPolicyDefaults = { ...DEFAULT_RETRY_POLICY, ...policy };
  const attempt = Math.max(1, attemptNumber);
  const exp = merged.initialDelayMs * Math.pow(merged.multiplier, attempt - 1);
  const capped = Math.min(merged.maxDelayMs, exp);
  const jitterSpan = capped * merged.jitterRatio;
  const unit = ((seed + attempt * 2654435761) >>> 0) / 0xffffffff;
  const jitter = (unit * 2 - 1) * jitterSpan;
  return Math.max(0, Math.round(capped + jitter));
}

export function scheduleRetryAt(
  now: Date,
  attemptNumber: number,
  policy?: Partial<RetryPolicyDefaults>,
  seed?: number,
): Date {
  return new Date(now.getTime() + computeBackoffMs(attemptNumber, policy, seed ?? 0));
}
