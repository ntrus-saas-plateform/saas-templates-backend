import { describe, expect, it } from 'vitest';
import { DomainError } from '../../../../core/domain/errors/domain-error.js';
import {
  compensationOrder,
  decideFailureAction,
  orderSteps,
} from './saga-coordinator.js';
import { SagaFailurePolicy, type WorkflowStepDefinition } from './workflow.types.js';

describe('saga-coordinator', () => {
  const steps: WorkflowStepDefinition[] = [
    {
      key: 'a',
      type: 'HANDLER',
      handlerKey: 'noop:checkpoint',
      compensationHandlerKey: 'noop:checkpoint',
    },
    {
      key: 'b',
      type: 'HANDLER',
      handlerKey: 'noop:checkpoint',
      dependsOn: ['a'],
      compensationHandlerKey: 'noop:checkpoint',
    },
    {
      key: 'c',
      type: 'HANDLER',
      handlerKey: 'noop:checkpoint',
      dependsOn: ['b'],
      compensationHandlerKey: 'noop:checkpoint',
      failurePolicy: SagaFailurePolicy.COMPENSATE,
    },
  ];

  it('orders steps topologically', () => {
    expect(orderSteps(steps)).toEqual(['a', 'b', 'c']);
  });

  it('rejects cycles', () => {
    expect(() =>
      orderSteps([
        { key: 'a', type: 'HANDLER', handlerKey: 'noop:checkpoint', dependsOn: ['b'] },
        { key: 'b', type: 'HANDLER', handlerKey: 'noop:checkpoint', dependsOn: ['a'] },
      ]),
    ).toThrow(DomainError);
  });

  it('compensates in reverse dependency order for succeeded steps only', () => {
    expect(compensationOrder(steps, ['a', 'b'])).toEqual(['b', 'a']);
    expect(compensationOrder(steps, ['a', 'b', 'c'])).toEqual(['c', 'b', 'a']);
    expect(compensationOrder(steps, [])).toEqual([]);
  });

  it('decideFailureAction COMPENSATE excludes the failed step', () => {
    const decision = decideFailureAction({
      failedStepKey: 'c',
      steps,
      succeededKeys: ['a', 'b'],
    });
    expect(decision).toEqual({
      action: SagaFailurePolicy.COMPENSATE,
      compensationKeys: ['b', 'a'],
    });
  });

  it('honors RETRY / PAUSE / FAIL_WITHOUT_COMPENSATION / CONTINUE', () => {
    const withPolicy = (
      policy: SagaFailurePolicy,
    ): WorkflowStepDefinition[] => [
      steps[0],
      steps[1],
      { ...steps[2], failurePolicy: policy },
    ];

    expect(
      decideFailureAction({
        failedStepKey: 'c',
        steps: withPolicy(SagaFailurePolicy.RETRY),
        succeededKeys: ['a', 'b'],
      }).action,
    ).toBe(SagaFailurePolicy.RETRY);

    expect(
      decideFailureAction({
        failedStepKey: 'c',
        steps: withPolicy(SagaFailurePolicy.PAUSE_FOR_REVIEW),
        succeededKeys: ['a', 'b'],
      }).action,
    ).toBe(SagaFailurePolicy.PAUSE_FOR_REVIEW);

    expect(
      decideFailureAction({
        failedStepKey: 'c',
        steps: withPolicy(SagaFailurePolicy.FAIL_WITHOUT_COMPENSATION),
        succeededKeys: ['a', 'b'],
      }).action,
    ).toBe(SagaFailurePolicy.FAIL_WITHOUT_COMPENSATION);

    expect(
      decideFailureAction({
        failedStepKey: 'c',
        steps: withPolicy(SagaFailurePolicy.CONTINUE),
        succeededKeys: ['a', 'b'],
      }).action,
    ).toBe(SagaFailurePolicy.CONTINUE);
  });
});
