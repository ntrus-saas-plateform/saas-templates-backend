import {
  OnboardingErrorCode,
  OnboardingJourneyStatus,
  OnboardingStepStatus,
  OnboardingTaskStatus,
  type OnboardingStepRecord,
} from './onboarding.types.js';

export type OnboardingTransitionDecision =
  | { allowed: true }
  | { allowed: false; code: OnboardingErrorCode; reason: string };

/**
 * Guard PENDING → STARTING (launch start workflow).
 */
export function canRequestStart(
  status: OnboardingJourneyStatus | string,
): OnboardingTransitionDecision {
  if (status === OnboardingJourneyStatus.PENDING) {
    return { allowed: true };
  }
  return {
    allowed: false,
    code: OnboardingErrorCode.JOURNEY_FORBIDDEN,
    reason: `Start requires PENDING journey; current=${status}`,
  };
}

/**
 * Guard IN_PROGRESS / FAILED (retry) → ADVANCE.
 * WAITING_APPROVAL cannot advance until human task is decided.
 */
export function canRequestAdvance(
  status: OnboardingJourneyStatus | string,
): OnboardingTransitionDecision {
  if (
    status === OnboardingJourneyStatus.IN_PROGRESS ||
    status === OnboardingJourneyStatus.FAILED ||
    status === OnboardingJourneyStatus.STARTING
  ) {
    return { allowed: true };
  }
  return {
    allowed: false,
    code: OnboardingErrorCode.JOURNEY_FORBIDDEN,
    reason: `Advance requires IN_PROGRESS/FAILED/STARTING; current=${status}`,
  };
}

/**
 * Close only when every required step is PASSED (or SKIPPED).
 * Human approval of a task does NOT satisfy this by itself.
 */
export function canRequestClose(input: {
  journeyStatus: OnboardingJourneyStatus | string;
  steps: Array<Pick<OnboardingStepRecord, 'required' | 'stepStatus' | 'stepKey'>>;
}): OnboardingTransitionDecision {
  const terminal =
    input.journeyStatus === OnboardingJourneyStatus.CLOSED ||
    input.journeyStatus === OnboardingJourneyStatus.CANCELLED ||
    input.journeyStatus === OnboardingJourneyStatus.SUPERSEDED;
  if (terminal) {
    return {
      allowed: false,
      code: OnboardingErrorCode.JOURNEY_FORBIDDEN,
      reason: `Journey already terminal (${input.journeyStatus})`,
    };
  }

  if (input.steps.length === 0) {
    return {
      allowed: false,
      code: OnboardingErrorCode.STEP_NOT_READY,
      reason: 'No steps materialized — cannot close',
    };
  }

  const incomplete = input.steps.filter(
    (s) =>
      s.required &&
      s.stepStatus !== OnboardingStepStatus.PASSED &&
      s.stepStatus !== OnboardingStepStatus.SKIPPED,
  );
  if (incomplete.length > 0) {
    return {
      allowed: false,
      code: OnboardingErrorCode.STEP_NOT_READY,
      reason: `Required steps not PASSED: ${incomplete.map((s) => s.stepKey).join(', ')}`,
    };
  }

  return { allowed: true };
}

/**
 * Human task decision guards.
 * CRITICAL: human approval CANNOT bypass P7.1 authorization —
 * caller must still revalidate before accepting the decision.
 */
export function canDecideTask(input: {
  taskStatus: OnboardingTaskStatus | string;
  journeyStatus: OnboardingJourneyStatus | string;
  authorizationRevalidated: boolean;
  decision: 'APPROVE' | 'REJECT';
}): OnboardingTransitionDecision {
  if (!input.authorizationRevalidated) {
    return {
      allowed: false,
      code: OnboardingErrorCode.HUMAN_APPROVAL_CANNOT_BYPASS_AUTH,
      reason:
        'Human approval/reject cannot bypass P7.1 authorization revalidation (fail-closed)',
    };
  }

  if (input.taskStatus !== OnboardingTaskStatus.OPEN) {
    return {
      allowed: false,
      code: OnboardingErrorCode.CONFLICT,
      reason: `Task is not OPEN (current=${input.taskStatus})`,
    };
  }

  if (
    input.journeyStatus !== OnboardingJourneyStatus.WAITING_APPROVAL &&
    input.journeyStatus !== OnboardingJourneyStatus.IN_PROGRESS
  ) {
    return {
      allowed: false,
      code: OnboardingErrorCode.JOURNEY_FORBIDDEN,
      reason: `Task decision requires WAITING_APPROVAL/IN_PROGRESS journey; current=${input.journeyStatus}`,
    };
  }

  void input.decision;
  return { allowed: true };
}

/** Status transition helpers used by mark_* handlers. */
export function assertJourneyTransition(
  from: OnboardingJourneyStatus | string,
  to: OnboardingJourneyStatus,
): OnboardingTransitionDecision {
  const allowed: Record<string, OnboardingJourneyStatus[]> = {
    [OnboardingJourneyStatus.PENDING]: [
      OnboardingJourneyStatus.STARTING,
      OnboardingJourneyStatus.CANCELLED,
      OnboardingJourneyStatus.FAILED,
    ],
    [OnboardingJourneyStatus.STARTING]: [
      OnboardingJourneyStatus.IN_PROGRESS,
      OnboardingJourneyStatus.FAILED,
      OnboardingJourneyStatus.CANCELLED,
    ],
    [OnboardingJourneyStatus.IN_PROGRESS]: [
      OnboardingJourneyStatus.WAITING_APPROVAL,
      OnboardingJourneyStatus.CLOSING,
      OnboardingJourneyStatus.BLOCKED,
      OnboardingJourneyStatus.FAILED,
      OnboardingJourneyStatus.CANCELLED,
    ],
    [OnboardingJourneyStatus.WAITING_APPROVAL]: [
      OnboardingJourneyStatus.IN_PROGRESS,
      OnboardingJourneyStatus.BLOCKED,
      OnboardingJourneyStatus.FAILED,
      OnboardingJourneyStatus.CANCELLED,
    ],
    [OnboardingJourneyStatus.BLOCKED]: [
      OnboardingJourneyStatus.IN_PROGRESS,
      OnboardingJourneyStatus.FAILED,
      OnboardingJourneyStatus.CANCELLED,
    ],
    [OnboardingJourneyStatus.FAILED]: [
      OnboardingJourneyStatus.IN_PROGRESS,
      OnboardingJourneyStatus.STARTING,
      OnboardingJourneyStatus.CANCELLED,
    ],
    [OnboardingJourneyStatus.CLOSING]: [
      OnboardingJourneyStatus.CLOSED,
      OnboardingJourneyStatus.FAILED,
    ],
  };

  const targets = allowed[String(from)] ?? [];
  if (targets.includes(to)) {
    return { allowed: true };
  }
  return {
    allowed: false,
    code: OnboardingErrorCode.JOURNEY_FORBIDDEN,
    reason: `Forbidden transition ${from} → ${to}`,
  };
}

/** Pick next required step that is READY or PENDING (ordered). */
export function pickNextAdvanceableStep(
  steps: OnboardingStepRecord[],
): OnboardingStepRecord | null {
  const ordered = [...steps].sort((a, b) => a.stepOrder - b.stepOrder);
  for (const step of ordered) {
    if (!step.required) continue;
    if (
      step.stepStatus === OnboardingStepStatus.READY ||
      step.stepStatus === OnboardingStepStatus.PENDING
    ) {
      return step;
    }
  }
  return null;
}
