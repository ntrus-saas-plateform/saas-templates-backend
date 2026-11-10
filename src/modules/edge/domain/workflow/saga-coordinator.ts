import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import {
  SagaFailurePolicy,
  type WorkflowStepDefinition,
  type WorkflowStepRecord,
} from './workflow.types.js';

/** Topological order of step keys; throws on cycles. */
export function orderSteps(steps: WorkflowStepDefinition[]): string[] {
  const byKey = new Map(steps.map((s) => [s.key, s]));
  for (const step of steps) {
    for (const dep of step.dependsOn ?? []) {
      if (!byKey.has(dep)) {
        throw new DomainError(
          ErrorCode.VALIDATION_ERROR,
          `Missing dependency reference "${dep}" for step "${step.key}"`,
        );
      }
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const ordered: string[] = [];

  function dfs(key: string): void {
    if (visited.has(key)) return;
    if (visiting.has(key)) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, `Cyclic dependency involving "${key}"`);
    }
    visiting.add(key);
    const step = byKey.get(key)!;
    for (const dep of step.dependsOn ?? []) dfs(dep);
    visiting.delete(key);
    visited.add(key);
    ordered.push(key);
  }

  for (const step of steps) dfs(step.key);
  return ordered;
}

/**
 * Compensation order: reverse dependency order among successfully completed compensatable steps.
 * Steps that never succeeded are omitted.
 */
export function compensationOrder(
  steps: WorkflowStepDefinition[],
  completedSucceededKeys: readonly string[],
): string[] {
  const succeeded = new Set(completedSucceededKeys);
  const compensatable = steps.filter(
    (s) => succeeded.has(s.key) && Boolean(s.compensationHandlerKey),
  );
  const forward = orderSteps(compensatable);
  return [...forward].reverse();
}

export function resolveFailurePolicy(
  step: WorkflowStepDefinition | null | undefined,
  workflowDefault: SagaFailurePolicy = SagaFailurePolicy.COMPENSATE,
): SagaFailurePolicy {
  return step?.failurePolicy ?? workflowDefault;
}

export type SagaFailureDecision =
  | { action: SagaFailurePolicy.CONTINUE }
  | { action: SagaFailurePolicy.RETRY }
  | { action: SagaFailurePolicy.COMPENSATE; compensationKeys: string[] }
  | { action: SagaFailurePolicy.PAUSE_FOR_REVIEW }
  | { action: SagaFailurePolicy.FAIL_WITHOUT_COMPENSATION };

/**
 * Decide saga reaction after a step failure.
 * COMPENSATE returns reverse-dependency order of successfully completed compensatable steps
 * (excluding the failed step itself).
 */
export function decideFailureAction(params: {
  failedStepKey: string;
  steps: WorkflowStepDefinition[];
  succeededKeys: readonly string[];
  workflowDefault?: SagaFailurePolicy;
}): SagaFailureDecision {
  const failed = params.steps.find((s) => s.key === params.failedStepKey);
  if (!failed) {
    throw new DomainError(
      ErrorCode.RESOURCE_NOT_FOUND,
      `Unknown failed step "${params.failedStepKey}"`,
    );
  }
  const policy = resolveFailurePolicy(
    failed,
    params.workflowDefault ?? SagaFailurePolicy.COMPENSATE,
  );
  switch (policy) {
    case SagaFailurePolicy.CONTINUE:
      return { action: SagaFailurePolicy.CONTINUE };
    case SagaFailurePolicy.RETRY:
      return { action: SagaFailurePolicy.RETRY };
    case SagaFailurePolicy.PAUSE_FOR_REVIEW:
      return { action: SagaFailurePolicy.PAUSE_FOR_REVIEW };
    case SagaFailurePolicy.FAIL_WITHOUT_COMPENSATION:
      return { action: SagaFailurePolicy.FAIL_WITHOUT_COMPENSATION };
    case SagaFailurePolicy.COMPENSATE:
      return {
        action: SagaFailurePolicy.COMPENSATE,
        compensationKeys: compensationOrder(
          params.steps,
          params.succeededKeys.filter((k) => k !== params.failedStepKey),
        ),
      };
    default:
      throw new DomainError(ErrorCode.VALIDATION_ERROR, `Unhandled saga policy: ${policy}`);
  }
}

export function selectEligibleReadySteps(
  definitions: WorkflowStepDefinition[],
  records: WorkflowStepRecord[],
): WorkflowStepRecord[] {
  const byKey = new Map(records.map((r) => [r.stepKey, r]));
  const eligible: WorkflowStepRecord[] = [];
  for (const def of definitions) {
    const rec = byKey.get(def.key);
    if (!rec) continue;
    if (rec.status !== 'PENDING' && rec.status !== 'READY') continue;
    const deps = def.dependsOn ?? [];
    const depsMet = deps.every((d) => {
      const dep = byKey.get(d);
      return dep && (dep.status === 'SUCCEEDED' || dep.status === 'SKIPPED');
    });
    if (depsMet) eligible.push(rec);
  }
  return eligible;
}
