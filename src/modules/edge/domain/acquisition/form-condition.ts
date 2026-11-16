/**
 * Constrained condition language for acquisition forms.
 * Supports AND / OR / EQ / NEQ / IN / EXISTS only — no eval / no JS execution.
 */

export type ConditionOperator = 'AND' | 'OR' | 'EQ' | 'NEQ' | 'IN' | 'EXISTS';

export type ConditionNode =
  | { op: 'AND'; args: ConditionNode[] }
  | { op: 'OR'; args: ConditionNode[] }
  | { op: 'EQ'; field: string; value: unknown }
  | { op: 'NEQ'; field: string; value: unknown }
  | { op: 'IN'; field: string; values: unknown[] }
  | { op: 'EXISTS'; field: string };

export type ConditionEvaluationResult = {
  ok: boolean;
  error?: string;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readField(answers: Record<string, unknown>, field: string): unknown {
  if (!field || field.includes('__proto__') || field.includes('prototype')) {
    return undefined;
  }
  const parts = field.split('.').filter(Boolean);
  let current: unknown = answers;
  for (const part of parts) {
    if (!isPlainObject(current) && !Array.isArray(current)) {
      return undefined;
    }
    if (Array.isArray(current)) {
      const idx = Number(part);
      if (!Number.isInteger(idx) || idx < 0 || idx >= current.length) return undefined;
      current = current[idx];
      continue;
    }
    current = current[part];
  }
  return current;
}

function valuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a === 'number' && typeof b === 'number' && Number.isNaN(a) && Number.isNaN(b)) {
    return true;
  }
  if (typeof a === 'string' && typeof b === 'string') {
    return a === b;
  }
  return false;
}

function isConditionNode(value: unknown): value is ConditionNode {
  if (!isPlainObject(value) || typeof value.op !== 'string') return false;
  const op = value.op;
  if (op === 'AND' || op === 'OR') {
    return Array.isArray(value.args);
  }
  if (op === 'EQ' || op === 'NEQ') {
    return typeof value.field === 'string';
  }
  if (op === 'IN') {
    return typeof value.field === 'string' && Array.isArray(value.values);
  }
  if (op === 'EXISTS') {
    return typeof value.field === 'string';
  }
  return false;
}

/** Parse unknown JSON into a ConditionNode; returns null if invalid. */
export function parseCondition(raw: unknown): ConditionNode | null {
  if (raw == null) return null;
  if (!isConditionNode(raw)) return null;
  if (raw.op === 'AND' || raw.op === 'OR') {
    const args: ConditionNode[] = [];
    for (const arg of raw.args) {
      const parsed = parseCondition(arg);
      if (!parsed) return null;
      args.push(parsed);
    }
    return { op: raw.op, args };
  }
  return raw;
}

export function evaluateCondition(
  condition: ConditionNode | null | undefined,
  answers: Record<string, unknown>,
): ConditionEvaluationResult {
  if (condition == null) {
    return { ok: true };
  }

  switch (condition.op) {
    case 'AND': {
      if (condition.args.length === 0) return { ok: true };
      for (const arg of condition.args) {
        const result = evaluateCondition(arg, answers);
        if (!result.ok) return result;
      }
      return { ok: true };
    }
    case 'OR': {
      if (condition.args.length === 0) return { ok: true };
      const errors: string[] = [];
      for (const arg of condition.args) {
        const result = evaluateCondition(arg, answers);
        if (result.ok) return { ok: true };
        if (result.error) errors.push(result.error);
      }
      return { ok: false, error: errors[0] ?? 'OR condition not satisfied' };
    }
    case 'EQ': {
      const actual = readField(answers, condition.field);
      if (!valuesEqual(actual, condition.value)) {
        return { ok: false, error: `EQ failed for field ${condition.field}` };
      }
      return { ok: true };
    }
    case 'NEQ': {
      const actual = readField(answers, condition.field);
      if (valuesEqual(actual, condition.value)) {
        return { ok: false, error: `NEQ failed for field ${condition.field}` };
      }
      return { ok: true };
    }
    case 'IN': {
      const actual = readField(answers, condition.field);
      const hit = condition.values.some((v) => valuesEqual(actual, v));
      if (!hit) {
        return { ok: false, error: `IN failed for field ${condition.field}` };
      }
      return { ok: true };
    }
    case 'EXISTS': {
      const actual = readField(answers, condition.field);
      const exists =
        actual !== undefined &&
        actual !== null &&
        !(typeof actual === 'string' && actual.trim() === '');
      if (!exists) {
        return { ok: false, error: `EXISTS failed for field ${condition.field}` };
      }
      return { ok: true };
    }
    default: {
      return { ok: false, error: 'Unsupported condition operator' };
    }
  }
}

/** Convenience: evaluate raw JSON condition rules (single node or array of AND nodes). */
export function evaluateConditionRules(
  rules: unknown,
  answers: Record<string, unknown>,
): ConditionEvaluationResult {
  if (rules == null) return { ok: true };
  if (Array.isArray(rules)) {
    if (rules.length === 0) return { ok: true };
    const nodes: ConditionNode[] = [];
    for (const rule of rules) {
      const parsed = parseCondition(rule);
      if (!parsed) {
        return { ok: false, error: 'Invalid condition rule' };
      }
      nodes.push(parsed);
    }
    return evaluateCondition({ op: 'AND', args: nodes }, answers);
  }
  const parsed = parseCondition(rules);
  if (!parsed) {
    return { ok: false, error: 'Invalid condition' };
  }
  return evaluateCondition(parsed, answers);
}
