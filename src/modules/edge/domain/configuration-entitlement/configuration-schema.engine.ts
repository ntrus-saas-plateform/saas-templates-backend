import { createHash } from 'node:crypto';
import { ConfigurationErrorCode } from './configuration.types.js';

const SECRET_KEY_PATTERN =
  /(secret|password|token|credential|api[_-]?key|private[_-]?key|client[_-]?secret)/i;

export type SchemaValidationIssue = {
  path: string;
  code: ConfigurationErrorCode | string;
  message: string;
};

export type SchemaValidationResult = {
  ok: boolean;
  issues: SchemaValidationIssue[];
};

/** Stable SHA-256 hex over canonical JSON (sorted keys). */
export function checksumPayload(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) {
      out[key] = sortKeys(obj[key]);
    }
    return out;
  }
  return value;
}

/**
 * Lightweight JSON-Schema-inspired validator for P7.8.
 * Supports: type, required, enum, minimum/maximum, properties, additionalProperties:false,
 * and forbids plaintext secret-looking keys anywhere in the payload.
 */
export function validateAgainstSchema(
  schema: Record<string, unknown>,
  payload: unknown,
): SchemaValidationResult {
  const issues: SchemaValidationIssue[] = [];
  walkSecrets(payload, '$', issues);
  validateNode(schema, payload, '$', issues);
  return { ok: issues.length === 0, issues };
}

function walkSecrets(value: unknown, path: string, issues: SchemaValidationIssue[]): void {
  if (Array.isArray(value)) {
    value.forEach((v, i) => walkSecrets(v, `${path}[${i}]`, issues));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const child = `${path}.${k}`;
      if (SECRET_KEY_PATTERN.test(k) && typeof v === 'string' && v.trim() && !isVaultRef(v)) {
        issues.push({
          path: child,
          code: ConfigurationErrorCode.SECRET_PLAINTEXT_FORBIDDEN,
          message: `Plaintext secret-like field "${k}" is forbidden; use a vault reference`,
        });
      }
      walkSecrets(v, child, issues);
    }
  }
}

function isVaultRef(value: string): boolean {
  return /^sec_[A-Za-z0-9_-]+$/.test(value) || value.startsWith('vault:');
}

function validateNode(
  schema: Record<string, unknown>,
  value: unknown,
  path: string,
  issues: SchemaValidationIssue[],
): void {
  const type = schema.type;
  if (type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      issues.push({ path, code: ConfigurationErrorCode.SCHEMA_INVALID, message: 'expected object' });
      return;
    }
    const obj = value as Record<string, unknown>;
    const required = Array.isArray(schema.required) ? (schema.required as string[]) : [];
    for (const key of required) {
      if (!(key in obj)) {
        issues.push({
          path: `${path}.${key}`,
          code: ConfigurationErrorCode.SCHEMA_INVALID,
          message: `required property "${key}" missing`,
        });
      }
    }
    const properties =
      schema.properties && typeof schema.properties === 'object'
        ? (schema.properties as Record<string, Record<string, unknown>>)
        : {};
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(obj)) {
        if (!(key in properties)) {
          issues.push({
            path: `${path}.${key}`,
            code: ConfigurationErrorCode.SCHEMA_INVALID,
            message: `additional property "${key}" is not allowed`,
          });
        }
      }
    }
    for (const [key, childSchema] of Object.entries(properties)) {
      if (key in obj) validateNode(childSchema, obj[key], `${path}.${key}`, issues);
    }
    return;
  }

  if (type === 'string') {
    if (typeof value !== 'string') {
      issues.push({ path, code: ConfigurationErrorCode.SCHEMA_INVALID, message: 'expected string' });
      return;
    }
  } else if (type === 'number' || type === 'integer') {
    if (typeof value !== 'number' || (type === 'integer' && !Number.isInteger(value))) {
      issues.push({ path, code: ConfigurationErrorCode.SCHEMA_INVALID, message: `expected ${type}` });
      return;
    }
    if (typeof schema.minimum === 'number' && value < schema.minimum) {
      issues.push({
        path,
        code: ConfigurationErrorCode.SCHEMA_INVALID,
        message: `value ${value} < minimum ${schema.minimum}`,
      });
    }
    if (typeof schema.maximum === 'number' && value > schema.maximum) {
      issues.push({
        path,
        code: ConfigurationErrorCode.SCHEMA_INVALID,
        message: `value ${value} > maximum ${schema.maximum}`,
      });
    }
  } else if (type === 'boolean') {
    if (typeof value !== 'boolean') {
      issues.push({ path, code: ConfigurationErrorCode.SCHEMA_INVALID, message: 'expected boolean' });
      return;
    }
  } else if (type === 'array') {
    if (!Array.isArray(value)) {
      issues.push({ path, code: ConfigurationErrorCode.SCHEMA_INVALID, message: 'expected array' });
      return;
    }
    const itemSchema =
      schema.items && typeof schema.items === 'object'
        ? (schema.items as Record<string, unknown>)
        : null;
    if (itemSchema) {
      value.forEach((item, i) => validateNode(itemSchema, item, `${path}[${i}]`, issues));
    }
  }

  if (Array.isArray(schema.enum) && !schema.enum.includes(value as never)) {
    issues.push({
      path,
      code: ConfigurationErrorCode.SCHEMA_INVALID,
      message: `value not in enum`,
    });
  }
}

/**
 * Fail-closed: desired entitlements must be a subset of the granted P5 snapshot.
 * Expansion of commercial capabilities, flags, quotas or limits is rejected.
 */
export function assertNoEntitlementExpansion(input: {
  granted: {
    capabilities?: Record<string, unknown>;
    featureFlags?: Record<string, unknown>;
    quotas?: Record<string, unknown>;
    limits?: Record<string, unknown>;
  };
  desired: {
    capabilities?: Record<string, unknown>;
    featureFlags?: Record<string, unknown>;
    quotas?: Record<string, unknown>;
    limits?: Record<string, unknown>;
  };
}): SchemaValidationResult {
  const issues: SchemaValidationIssue[] = [];
  compareMap('capabilities', input.granted.capabilities ?? {}, input.desired.capabilities ?? {}, issues);
  compareMap('featureFlags', input.granted.featureFlags ?? {}, input.desired.featureFlags ?? {}, issues);
  compareNumericCeiling('quotas', input.granted.quotas ?? {}, input.desired.quotas ?? {}, issues);
  compareNumericCeiling('limits', input.granted.limits ?? {}, input.desired.limits ?? {}, issues);
  return { ok: issues.length === 0, issues };
}

function compareMap(
  section: string,
  granted: Record<string, unknown>,
  desired: Record<string, unknown>,
  issues: SchemaValidationIssue[],
): void {
  for (const [key, value] of Object.entries(desired)) {
    if (!(key in granted)) {
      issues.push({
        path: `$.${section}.${key}`,
        code: ConfigurationErrorCode.ENTITLEMENT_EXPANSION,
        message: `capability/flag "${key}" not present in P5 granted snapshot`,
      });
      continue;
    }
    if (value === true && granted[key] !== true) {
      issues.push({
        path: `$.${section}.${key}`,
        code: ConfigurationErrorCode.ENTITLEMENT_EXPANSION,
        message: `enabling "${key}" expands beyond granted entitlement`,
      });
    }
  }
}

function compareNumericCeiling(
  section: string,
  granted: Record<string, unknown>,
  desired: Record<string, unknown>,
  issues: SchemaValidationIssue[],
): void {
  for (const [key, value] of Object.entries(desired)) {
    const g = granted[key];
    if (typeof value !== 'number') continue;
    if (typeof g !== 'number') {
      issues.push({
        path: `$.${section}.${key}`,
        code: ConfigurationErrorCode.ENTITLEMENT_EXPANSION,
        message: `"${key}" not granted numerically by P5`,
      });
      continue;
    }
    if (value > g) {
      issues.push({
        path: `$.${section}.${key}`,
        code: ConfigurationErrorCode.ENTITLEMENT_EXPANSION,
        message: `desired ${value} exceeds granted ceiling ${g}`,
      });
    }
  }
}
