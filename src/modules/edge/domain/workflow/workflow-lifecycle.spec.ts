import { describe, expect, it } from 'vitest';
import { DomainError } from '../../../../core/domain/errors/domain-error.js';
import {
  assertDefinitionTransition,
  assertInstanceTransition,
  assertStepTransition,
  assertTaskTransition,
  isTerminalInstanceState,
} from './workflow-lifecycle.js';
import {
  HumanTaskStatus,
  WorkflowDefinitionStatus,
  WorkflowInstanceState,
  WorkflowStepStatus,
} from './workflow.types.js';

describe('workflow lifecycle', () => {
  it('allows CREATED → READY → RUNNING → SUCCEEDED', () => {
    expect(() =>
      assertInstanceTransition(WorkflowInstanceState.CREATED, WorkflowInstanceState.READY),
    ).not.toThrow();
    expect(() =>
      assertInstanceTransition(WorkflowInstanceState.READY, WorkflowInstanceState.RUNNING),
    ).not.toThrow();
    expect(() =>
      assertInstanceTransition(WorkflowInstanceState.RUNNING, WorkflowInstanceState.SUCCEEDED),
    ).not.toThrow();
  });

  it('allows compensation failure path', () => {
    expect(() =>
      assertInstanceTransition(
        WorkflowInstanceState.RUNNING,
        WorkflowInstanceState.COMPENSATING,
      ),
    ).not.toThrow();
    expect(() =>
      assertInstanceTransition(
        WorkflowInstanceState.COMPENSATING,
        WorkflowInstanceState.COMPENSATION_FAILED,
      ),
    ).not.toThrow();
  });

  it('rejects illegal instance jumps and terminal escapes', () => {
    expect(() =>
      assertInstanceTransition(WorkflowInstanceState.CREATED, WorkflowInstanceState.SUCCEEDED),
    ).toThrow(DomainError);
    expect(() =>
      assertInstanceTransition(WorkflowInstanceState.SUCCEEDED, WorkflowInstanceState.RUNNING),
    ).toThrow(DomainError);
    expect(isTerminalInstanceState(WorkflowInstanceState.CANCELLED)).toBe(true);
  });

  it('allows step claim path and compensation', () => {
    expect(() =>
      assertStepTransition(WorkflowStepStatus.READY, WorkflowStepStatus.CLAIMED),
    ).not.toThrow();
    expect(() =>
      assertStepTransition(WorkflowStepStatus.CLAIMED, WorkflowStepStatus.RUNNING),
    ).not.toThrow();
    expect(() =>
      assertStepTransition(WorkflowStepStatus.SUCCEEDED, WorkflowStepStatus.COMPENSATION_PENDING),
    ).not.toThrow();
  });

  it('allows human task approve path and blocks conflicting terminal rewrite', () => {
    expect(() =>
      assertTaskTransition(HumanTaskStatus.ASSIGNED, HumanTaskStatus.APPROVED),
    ).not.toThrow();
    expect(() =>
      assertTaskTransition(HumanTaskStatus.APPROVED, HumanTaskStatus.REJECTED),
    ).toThrow(DomainError);
  });

  it('allows definition DRAFT → VALIDATED → PUBLISHED', () => {
    expect(() =>
      assertDefinitionTransition(
        WorkflowDefinitionStatus.DRAFT,
        WorkflowDefinitionStatus.VALIDATED,
      ),
    ).not.toThrow();
    expect(() =>
      assertDefinitionTransition(
        WorkflowDefinitionStatus.VALIDATED,
        WorkflowDefinitionStatus.PUBLISHED,
      ),
    ).not.toThrow();
  });
});
