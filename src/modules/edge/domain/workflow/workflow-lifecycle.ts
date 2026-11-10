import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import {
  HumanTaskStatus,
  WorkflowDefinitionStatus,
  WorkflowInstanceState,
  WorkflowStepStatus,
} from './workflow.types.js';

const INSTANCE_TRANSITIONS: Record<WorkflowInstanceState, readonly WorkflowInstanceState[]> = {
  [WorkflowInstanceState.CREATED]: [
    WorkflowInstanceState.READY,
    WorkflowInstanceState.CANCELLED,
    WorkflowInstanceState.FAILED,
  ],
  [WorkflowInstanceState.READY]: [
    WorkflowInstanceState.RUNNING,
    WorkflowInstanceState.PAUSED,
    WorkflowInstanceState.CANCEL_REQUESTED,
    WorkflowInstanceState.CANCELLED,
  ],
  [WorkflowInstanceState.RUNNING]: [
    WorkflowInstanceState.WAITING,
    WorkflowInstanceState.WAITING_APPROVAL,
    WorkflowInstanceState.RETRY_PENDING,
    WorkflowInstanceState.COMPENSATING,
    WorkflowInstanceState.PAUSED,
    WorkflowInstanceState.SUCCEEDED,
    WorkflowInstanceState.FAILED,
    WorkflowInstanceState.CANCEL_REQUESTED,
    WorkflowInstanceState.TIMED_OUT,
    WorkflowInstanceState.REQUIRES_INTERVENTION,
  ],
  [WorkflowInstanceState.WAITING]: [
    WorkflowInstanceState.RUNNING,
    WorkflowInstanceState.WAITING_APPROVAL,
    WorkflowInstanceState.PAUSED,
    WorkflowInstanceState.CANCEL_REQUESTED,
    WorkflowInstanceState.TIMED_OUT,
    WorkflowInstanceState.FAILED,
  ],
  [WorkflowInstanceState.WAITING_APPROVAL]: [
    WorkflowInstanceState.RUNNING,
    WorkflowInstanceState.PAUSED,
    WorkflowInstanceState.CANCEL_REQUESTED,
    WorkflowInstanceState.FAILED,
    WorkflowInstanceState.REQUIRES_INTERVENTION,
    WorkflowInstanceState.TIMED_OUT,
  ],
  [WorkflowInstanceState.COMPENSATING]: [
    WorkflowInstanceState.COMPENSATION_FAILED,
    WorkflowInstanceState.FAILED,
    WorkflowInstanceState.CANCELLED,
    WorkflowInstanceState.REQUIRES_INTERVENTION,
    WorkflowInstanceState.SUCCEEDED,
  ],
  [WorkflowInstanceState.COMPENSATION_FAILED]: [
    WorkflowInstanceState.REQUIRES_INTERVENTION,
    WorkflowInstanceState.COMPENSATING,
    WorkflowInstanceState.CANCELLED,
  ],
  [WorkflowInstanceState.RETRY_PENDING]: [
    WorkflowInstanceState.RUNNING,
    WorkflowInstanceState.PAUSED,
    WorkflowInstanceState.CANCEL_REQUESTED,
    WorkflowInstanceState.FAILED,
    WorkflowInstanceState.REQUIRES_INTERVENTION,
  ],
  [WorkflowInstanceState.PAUSED]: [
    WorkflowInstanceState.RUNNING,
    WorkflowInstanceState.READY,
    WorkflowInstanceState.CANCEL_REQUESTED,
    WorkflowInstanceState.REQUIRES_INTERVENTION,
  ],
  [WorkflowInstanceState.SUCCEEDED]: [],
  [WorkflowInstanceState.FAILED]: [
    WorkflowInstanceState.COMPENSATING,
    WorkflowInstanceState.REQUIRES_INTERVENTION,
  ],
  [WorkflowInstanceState.CANCEL_REQUESTED]: [
    WorkflowInstanceState.CANCELLED,
    WorkflowInstanceState.COMPENSATING,
    WorkflowInstanceState.REQUIRES_INTERVENTION,
  ],
  [WorkflowInstanceState.CANCELLED]: [],
  [WorkflowInstanceState.TIMED_OUT]: [
    WorkflowInstanceState.REQUIRES_INTERVENTION,
    WorkflowInstanceState.COMPENSATING,
  ],
  [WorkflowInstanceState.REQUIRES_INTERVENTION]: [
    WorkflowInstanceState.RUNNING,
    WorkflowInstanceState.COMPENSATING,
    WorkflowInstanceState.CANCELLED,
    WorkflowInstanceState.FAILED,
    WorkflowInstanceState.PAUSED,
  ],
};

const STEP_TRANSITIONS: Record<WorkflowStepStatus, readonly WorkflowStepStatus[]> = {
  [WorkflowStepStatus.PENDING]: [
    WorkflowStepStatus.READY,
    WorkflowStepStatus.SKIPPED,
    WorkflowStepStatus.CANCELLED,
  ],
  [WorkflowStepStatus.READY]: [
    WorkflowStepStatus.CLAIMED,
    WorkflowStepStatus.WAITING_APPROVAL,
    WorkflowStepStatus.SKIPPED,
    WorkflowStepStatus.CANCELLED,
  ],
  [WorkflowStepStatus.CLAIMED]: [
    WorkflowStepStatus.RUNNING,
    WorkflowStepStatus.READY,
    WorkflowStepStatus.FAILED,
    WorkflowStepStatus.CANCELLED,
  ],
  [WorkflowStepStatus.RUNNING]: [
    WorkflowStepStatus.SUCCEEDED,
    WorkflowStepStatus.FAILED,
    WorkflowStepStatus.WAITING,
    WorkflowStepStatus.WAITING_APPROVAL,
    WorkflowStepStatus.RETRY_PENDING,
    WorkflowStepStatus.TIMED_OUT,
    WorkflowStepStatus.CANCELLED,
  ],
  [WorkflowStepStatus.WAITING]: [
    WorkflowStepStatus.READY,
    WorkflowStepStatus.RUNNING,
    WorkflowStepStatus.CANCELLED,
    WorkflowStepStatus.TIMED_OUT,
  ],
  [WorkflowStepStatus.WAITING_APPROVAL]: [
    WorkflowStepStatus.READY,
    WorkflowStepStatus.SUCCEEDED,
    WorkflowStepStatus.FAILED,
    WorkflowStepStatus.CANCELLED,
    WorkflowStepStatus.TIMED_OUT,
  ],
  [WorkflowStepStatus.SUCCEEDED]: [
    WorkflowStepStatus.COMPENSATION_PENDING,
    WorkflowStepStatus.COMPENSATING,
  ],
  [WorkflowStepStatus.FAILED]: [
    WorkflowStepStatus.RETRY_PENDING,
    WorkflowStepStatus.COMPENSATION_PENDING,
    WorkflowStepStatus.CANCELLED,
  ],
  [WorkflowStepStatus.RETRY_PENDING]: [
    WorkflowStepStatus.READY,
    WorkflowStepStatus.CLAIMED,
    WorkflowStepStatus.FAILED,
    WorkflowStepStatus.CANCELLED,
  ],
  [WorkflowStepStatus.COMPENSATION_PENDING]: [
    WorkflowStepStatus.COMPENSATING,
    WorkflowStepStatus.CANCELLED,
  ],
  [WorkflowStepStatus.COMPENSATING]: [
    WorkflowStepStatus.COMPENSATED,
    WorkflowStepStatus.FAILED,
  ],
  [WorkflowStepStatus.COMPENSATED]: [],
  [WorkflowStepStatus.SKIPPED]: [],
  [WorkflowStepStatus.CANCELLED]: [],
  [WorkflowStepStatus.TIMED_OUT]: [
    WorkflowStepStatus.RETRY_PENDING,
    WorkflowStepStatus.COMPENSATION_PENDING,
    WorkflowStepStatus.CANCELLED,
  ],
};

const TASK_TRANSITIONS: Record<HumanTaskStatus, readonly HumanTaskStatus[]> = {
  [HumanTaskStatus.OPEN]: [
    HumanTaskStatus.ASSIGNED,
    HumanTaskStatus.IN_PROGRESS,
    HumanTaskStatus.EXPIRED,
    HumanTaskStatus.CANCELLED,
  ],
  [HumanTaskStatus.ASSIGNED]: [
    HumanTaskStatus.IN_PROGRESS,
    HumanTaskStatus.APPROVED,
    HumanTaskStatus.REJECTED,
    HumanTaskStatus.EXPIRED,
    HumanTaskStatus.CANCELLED,
  ],
  [HumanTaskStatus.IN_PROGRESS]: [
    HumanTaskStatus.APPROVED,
    HumanTaskStatus.REJECTED,
    HumanTaskStatus.COMPLETED,
    HumanTaskStatus.EXPIRED,
    HumanTaskStatus.CANCELLED,
  ],
  [HumanTaskStatus.APPROVED]: [HumanTaskStatus.COMPLETED],
  [HumanTaskStatus.REJECTED]: [HumanTaskStatus.COMPLETED],
  [HumanTaskStatus.COMPLETED]: [],
  [HumanTaskStatus.EXPIRED]: [HumanTaskStatus.CANCELLED],
  [HumanTaskStatus.CANCELLED]: [],
};

const DEFINITION_TRANSITIONS: Record<
  WorkflowDefinitionStatus,
  readonly WorkflowDefinitionStatus[]
> = {
  [WorkflowDefinitionStatus.DRAFT]: [
    WorkflowDefinitionStatus.VALIDATED,
    WorkflowDefinitionStatus.RETIRED,
  ],
  [WorkflowDefinitionStatus.VALIDATED]: [
    WorkflowDefinitionStatus.PUBLISHED,
    WorkflowDefinitionStatus.DRAFT,
    WorkflowDefinitionStatus.RETIRED,
  ],
  [WorkflowDefinitionStatus.PUBLISHED]: [
    WorkflowDefinitionStatus.DEPRECATED,
    WorkflowDefinitionStatus.RETIRED,
  ],
  [WorkflowDefinitionStatus.DEPRECATED]: [WorkflowDefinitionStatus.RETIRED],
  [WorkflowDefinitionStatus.RETIRED]: [],
};

function assertTransition<T extends string>(
  kind: string,
  from: T,
  to: T,
  allowed: readonly T[],
): void {
  if (from === to) return;
  if (!allowed.includes(to)) {
    throw new DomainError(
      ErrorCode.INVALID_STATE_TRANSITION,
      `Invalid ${kind} transition ${from} → ${to}`,
      [{ from, to }],
    );
  }
}

export function assertInstanceTransition(
  from: WorkflowInstanceState,
  to: WorkflowInstanceState,
): void {
  assertTransition('workflow instance', from, to, INSTANCE_TRANSITIONS[from] ?? []);
}

export function assertStepTransition(from: WorkflowStepStatus, to: WorkflowStepStatus): void {
  assertTransition('workflow step', from, to, STEP_TRANSITIONS[from] ?? []);
}

export function assertTaskTransition(from: HumanTaskStatus, to: HumanTaskStatus): void {
  assertTransition('human task', from, to, TASK_TRANSITIONS[from] ?? []);
}

/** Alias — same as assertTaskTransition. */
export const assertHumanTaskTransition = assertTaskTransition;

export function assertDefinitionTransition(
  from: WorkflowDefinitionStatus,
  to: WorkflowDefinitionStatus,
): void {
  assertTransition('workflow definition', from, to, DEFINITION_TRANSITIONS[from] ?? []);
}

export function isTerminalInstanceState(state: WorkflowInstanceState): boolean {
  return (
    state === WorkflowInstanceState.SUCCEEDED ||
    state === WorkflowInstanceState.FAILED ||
    state === WorkflowInstanceState.CANCELLED ||
    state === WorkflowInstanceState.TIMED_OUT
  );
}
