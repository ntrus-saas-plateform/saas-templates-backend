import { describe, expect, it } from 'vitest';
import { DomainError } from '../../../../core/domain/errors/domain-error.js';
import {
  assertRetryAllowed,
  classifyError,
  classifyRetryability,
  computeBackoffMs,
  DEFAULT_RETRY_POLICY,
  isRetryable,
} from './retry-policy.js';
import { WorkflowErrorClass } from './workflow.types.js';

describe('retry-policy', () => {
  it('classifies retryability', () => {
    expect(classifyRetryability(WorkflowErrorClass.TRANSIENT)).toBe(true);
    expect(classifyRetryability(WorkflowErrorClass.TIMEOUT)).toBe(true);
    expect(classifyRetryability(WorkflowErrorClass.AUTHORIZATION_REVOKED)).toBe(false);
    expect(classifyRetryability(WorkflowErrorClass.PERMANENT)).toBe(false);
    expect(classifyRetryability(WorkflowErrorClass.VALIDATION)).toBe(false);
    expect(classifyRetryability(WorkflowErrorClass.CONFLICT)).toBe(false);
  });

  it('classifies error heuristics', () => {
    expect(classifyError('TRANSIENT')).toBe(WorkflowErrorClass.TRANSIENT);
    expect(classifyError('authorization revoked')).toBe(
      WorkflowErrorClass.AUTHORIZATION_REVOKED,
    );
    expect(classifyError('dependency unavailable')).toBe(
      WorkflowErrorClass.DEPENDENCY_UNAVAILABLE,
    );
    expect(classifyError({ code: 'VALIDATION_ERROR' })).toBe(WorkflowErrorClass.VALIDATION);
  });

  it('computes deterministic backoff with jitter', () => {
    const a = computeBackoffMs(1, DEFAULT_RETRY_POLICY, 7);
    const b = computeBackoffMs(1, DEFAULT_RETRY_POLICY, 7);
    const c = computeBackoffMs(2, DEFAULT_RETRY_POLICY, 7);
    expect(a).toBe(b);
    expect(c).toBeGreaterThan(a);
  });

  it('stops retrying after maxAttempts or non-retryable class', () => {
    expect(isRetryable(WorkflowErrorClass.TRANSIENT, DEFAULT_RETRY_POLICY, 1)).toBe(true);
    expect(isRetryable(WorkflowErrorClass.TRANSIENT, DEFAULT_RETRY_POLICY, 3)).toBe(false);
    expect(() =>
      assertRetryAllowed(WorkflowErrorClass.AUTHORIZATION_REVOKED, DEFAULT_RETRY_POLICY, 1),
    ).toThrow(DomainError);
  });
});
