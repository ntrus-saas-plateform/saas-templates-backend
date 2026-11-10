import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import { orderSteps } from './saga-coordinator.js';
import {
  KNOWN_HANDLER_KEYS,
  type ConstrainedExpression,
  type WorkflowDefinitionSnapshot,
  type WorkflowStepDefinition,
} from './workflow.types.js';

const ALLOWED_OPS = new Set(['eq', 'neq', 'exists', 'in']);

export function validateExpression(expr: ConstrainedExpression | null | undefined): void {
  if (!expr) return;
  if (!ALLOWED_OPS.has(expr.op)) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      `Unsupported expression operator "${expr.op}" (allowed: eq/neq/exists/in)`,
    );
  }
  if (!expr.path || typeof expr.path !== 'string' || expr.path.includes('(')) {
    throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Expression path is invalid');
  }
  if (expr.op === 'in' && !Array.isArray(expr.value)) {
    throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Expression "in" requires an array value');
  }
}

export function evaluateExpression(
  expr: ConstrainedExpression | null | undefined,
  context: Record<string, unknown>,
): boolean {
  if (!expr) return true;
  validateExpression(expr);
  const parts = expr.path.split('.').filter(Boolean);
  let cur: unknown = context;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') {
      cur = undefined;
      break;
    }
    cur = (cur as Record<string, unknown>)[p];
  }
  switch (expr.op) {
    case 'exists':
      return cur !== undefined && cur !== null;
    case 'eq':
      return cur === expr.value;
    case 'neq':
      return cur !== expr.value;
    case 'in':
      return Array.isArray(expr.value) && expr.value.includes(cur);
    default:
      return false;
  }
}

export function validateDefinition(
  snapshot: WorkflowDefinitionSnapshot,
  knownHandlers: readonly string[] = KNOWN_HANDLER_KEYS,
): void {
  if (!snapshot || !Array.isArray(snapshot.steps) || snapshot.steps.length === 0) {
    throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Definition must include at least one step');
  }

  const keys = new Set<string>();
  const known = new Set(knownHandlers);

  for (const step of snapshot.steps) {
    validateStep(step, known);
    if (keys.has(step.key)) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, `Duplicate step key "${step.key}"`);
    }
    keys.add(step.key);
  }

  // Cycles + missing refs
  orderSteps(snapshot.steps);

  for (const step of snapshot.steps) {
    if (step.compensationHandlerKey && !known.has(step.compensationHandlerKey)) {
      // Compensation may reference known noop/unavailable keys only in P7.4
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        `Unknown compensation handler "${step.compensationHandlerKey}"`,
      );
    }
  }

  const retry = snapshot.retryDefaults;
  if (retry) {
    if (retry.maxAttempts != null && retry.maxAttempts < 1) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'retryDefaults.maxAttempts must be >= 1');
    }
    if (retry.initialDelayMs != null && retry.initialDelayMs < 0) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'retryDefaults.initialDelayMs invalid');
    }
    if (retry.maxDelayMs != null && retry.maxDelayMs < 0) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'retryDefaults.maxDelayMs invalid');
    }
  }

  if (snapshot.timeoutDefaultsMs != null && snapshot.timeoutDefaultsMs < 1) {
    throw new DomainError(ErrorCode.VALIDATION_ERROR, 'timeoutDefaultsMs must be >= 1');
  }

  // Unreachable required steps: every step must appear in topo order (already ensured).
  const reachable = new Set(orderSteps(snapshot.steps));
  for (const step of snapshot.steps) {
    if (!reachable.has(step.key)) {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        `Unreachable required step "${step.key}"`,
      );
    }
  }
}

function validateStep(step: WorkflowStepDefinition, known: Set<string>): void {
  if (!step.key?.trim()) {
    throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Step key is required');
  }
  if (!step.handlerKey?.trim()) {
    throw new DomainError(ErrorCode.VALIDATION_ERROR, `Step "${step.key}" missing handlerKey`);
  }
  if (!known.has(step.handlerKey)) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      `Unknown handler type "${step.handlerKey}" on step "${step.key}"`,
    );
  }
  if (step.maxAttempts != null && step.maxAttempts < 1) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      `Invalid maxAttempts on step "${step.key}"`,
    );
  }
  if (step.timeoutMs != null && step.timeoutMs < 1) {
    throw new DomainError(ErrorCode.VALIDATION_ERROR, `Invalid timeoutMs on step "${step.key}"`);
  }
  validateExpression(step.skipIf ?? null);
  validateExpression(step.runIf ?? null);
}
