import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import { evaluateCondition, evaluateConditionRules, parseCondition } from './form-condition.js';
import type { FormFieldDefinition, FormSchemaDefinition } from './acquisition.types.js';

export type FormValidationIssue = {
  code: string;
  fieldKey?: string;
  message: string;
};

export type FormValidationResult = {
  valid: boolean;
  issues: FormValidationIssue[];
};

function isBlank(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

function coerceAnswersMap(
  answers: Record<string, unknown> | Array<{ fieldKey: string; value: unknown }>,
): Record<string, unknown> {
  if (Array.isArray(answers)) {
    const map: Record<string, unknown> = {};
    for (const row of answers) {
      if (row && typeof row.fieldKey === 'string') {
        map[row.fieldKey] = row.value;
      }
    }
    return map;
  }
  return answers ?? {};
}

function fieldVisible(field: FormFieldDefinition, answers: Record<string, unknown>): boolean {
  if (field.condition == null) return true;
  const parsed = parseCondition(field.condition);
  if (!parsed) return false;
  return evaluateCondition(parsed, answers).ok;
}

function validateFieldType(field: FormFieldDefinition, value: unknown): FormValidationIssue | null {
  if (isBlank(value)) return null;
  switch (field.type) {
    case 'string':
    case 'text':
    case 'short_text':
    case 'long_text':
    case 'email':
    case 'phone':
    case 'country':
      if (typeof value !== 'string') {
        return {
          code: 'FIELD_TYPE_MISMATCH',
          fieldKey: field.key,
          message: `Field ${field.key} expects string`,
        };
      }
      if (field.pattern) {
        try {
          const re = new RegExp(field.pattern);
          if (!re.test(value)) {
            return {
              code: 'FIELD_PATTERN',
              fieldKey: field.key,
              message: `Field ${field.key} failed pattern`,
            };
          }
        } catch {
          return {
            code: 'FIELD_PATTERN_INVALID',
            fieldKey: field.key,
            message: `Field ${field.key} has invalid pattern`,
          };
        }
      }
      if (field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        return {
          code: 'FIELD_EMAIL',
          fieldKey: field.key,
          message: `Field ${field.key} is not a valid email`,
        };
      }
      break;
    case 'number':
    case 'integer':
      if (typeof value !== 'number' || Number.isNaN(value)) {
        return {
          code: 'FIELD_TYPE_MISMATCH',
          fieldKey: field.key,
          message: `Field ${field.key} expects number`,
        };
      }
      if (field.type === 'integer' && !Number.isInteger(value)) {
        return {
          code: 'FIELD_TYPE_MISMATCH',
          fieldKey: field.key,
          message: `Field ${field.key} expects integer`,
        };
      }
      if (typeof field.min === 'number' && value < field.min) {
        return {
          code: 'FIELD_MIN',
          fieldKey: field.key,
          message: `Field ${field.key} below min`,
        };
      }
      if (typeof field.max === 'number' && value > field.max) {
        return {
          code: 'FIELD_MAX',
          fieldKey: field.key,
          message: `Field ${field.key} above max`,
        };
      }
      break;
    case 'boolean':
      if (typeof value !== 'boolean') {
        return {
          code: 'FIELD_TYPE_MISMATCH',
          fieldKey: field.key,
          message: `Field ${field.key} expects boolean`,
        };
      }
      break;
    case 'select':
    case 'enum':
      if (field.options && field.options.length > 0) {
        const allowed = new Set(field.options.map((o) => String(o)));
        if (!allowed.has(String(value))) {
          return {
            code: 'FIELD_OPTION',
            fieldKey: field.key,
            message: `Field ${field.key} value not in options`,
          };
        }
      }
      break;
    case 'multiselect':
      if (!Array.isArray(value)) {
        return {
          code: 'FIELD_TYPE_MISMATCH',
          fieldKey: field.key,
          message: `Field ${field.key} expects array`,
        };
      }
      if (field.options && field.options.length > 0) {
        const allowed = new Set(field.options.map((o) => String(o)));
        for (const item of value) {
          if (!allowed.has(String(item))) {
            return {
              code: 'FIELD_OPTION',
              fieldKey: field.key,
              message: `Field ${field.key} contains invalid option`,
            };
          }
        }
      }
      break;
    case 'address':
      if (typeof value !== 'string' && (typeof value !== 'object' || value === null || Array.isArray(value))) {
        return {
          code: 'FIELD_TYPE_MISMATCH',
          fieldKey: field.key,
          message: `Field ${field.key} expects address object or string`,
        };
      }
      break;
    case 'file_upload':
      if (
        typeof value !== 'string' &&
        (typeof value !== 'object' || value === null || Array.isArray(value))
      ) {
        return {
          code: 'FIELD_TYPE_MISMATCH',
          fieldKey: field.key,
          message: `Field ${field.key} expects file reference object or string`,
        };
      }
      break;
    default:
      break;
  }
  return null;
}

/**
 * Structural publishability checks for a form schema definition + optional condition rules.
 * Used by PublishFormVersion and product acquisition contract templates.
 */
export function assertFormSchemaDefinitionPublishable(
  schemaDefinition: FormSchemaDefinition,
  conditionRules: unknown,
): void {
  const fields = schemaDefinition?.fields;
  if (!Array.isArray(fields)) {
    throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Form schema must define a fields array', [
      { code: 'FORM_SCHEMA_FIELDS_REQUIRED' },
    ]);
  }
  for (const field of fields) {
    if (!field?.key || typeof field.key !== 'string' || !field.type) {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        'Form schema field definitions require key and type',
        [{ code: 'FORM_SCHEMA_FIELD_INVALID' }],
      );
    }
  }
  if (conditionRules != null) {
    const cond = evaluateConditionRules(conditionRules, {});
    if (!cond.ok && cond.error === 'Invalid condition rule') {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Form condition rules are invalid', [
        { code: 'FORM_CONDITION_INVALID' },
      ]);
    }
  }
  const probe = validateFormAnswers(schemaDefinition, {}, { allowUnknownFields: true });
  const structural = probe.issues.filter((i) => i.code === 'INVALID_FIELD_DEF');
  if (structural.length > 0) {
    throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Form schema failed structural validation', [
      ...structural.map((i) => ({ code: i.code, fieldKey: i.fieldKey, message: i.message })),
    ]);
  }
}

/**
 * Server-side validation of answers against a published form schema definition.
 * Does not mutate schema; unknown fields are reported (fail-closed).
 */
export function validateFormAnswers(
  schemaDefinition: FormSchemaDefinition | null | undefined,
  answersInput: Record<string, unknown> | Array<{ fieldKey: string; value: unknown }>,
  options?: { conditionRules?: unknown; allowUnknownFields?: boolean },
): FormValidationResult {
  const issues: FormValidationIssue[] = [];
  const answers = coerceAnswersMap(answersInput);
  const fields = Array.isArray(schemaDefinition?.fields) ? schemaDefinition!.fields! : [];

  if (options?.conditionRules != null) {
    const global = evaluateConditionRules(options.conditionRules, answers);
    if (!global.ok) {
      issues.push({
        code: 'SCHEMA_CONDITION',
        message: global.error ?? 'Schema condition rules not satisfied',
      });
    }
  }

  const knownKeys = new Set(fields.map((f) => f.key));
  if (!options?.allowUnknownFields) {
    for (const key of Object.keys(answers)) {
      if (!knownKeys.has(key)) {
        issues.push({
          code: 'UNKNOWN_FIELD',
          fieldKey: key,
          message: `Unknown field ${key}`,
        });
      }
    }
  }

  for (const field of fields) {
    if (!field?.key || typeof field.key !== 'string') {
      issues.push({ code: 'INVALID_FIELD_DEF', message: 'Field definition missing key' });
      continue;
    }
    if (!fieldVisible(field, answers)) {
      continue;
    }
    const value = answers[field.key];
    if (field.required && isBlank(value)) {
      issues.push({
        code: 'FIELD_REQUIRED',
        fieldKey: field.key,
        message: `Field ${field.key} is required`,
      });
      continue;
    }
    const typeIssue = validateFieldType(field, value);
    if (typeIssue) issues.push(typeIssue);
  }

  return { valid: issues.length === 0, issues };
}

export function assertFormAnswersValid(
  schemaDefinition: FormSchemaDefinition | null | undefined,
  answersInput: Record<string, unknown> | Array<{ fieldKey: string; value: unknown }>,
  options?: { conditionRules?: unknown; allowUnknownFields?: boolean },
): void {
  const result = validateFormAnswers(schemaDefinition, answersInput, options);
  if (!result.valid) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      'Form answers failed schema validation',
      result.issues.map((i) => ({
        code: i.code,
        fieldKey: i.fieldKey,
        message: i.message,
      })),
    );
  }
}
