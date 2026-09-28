import { createHash } from 'node:crypto';

const SENSITIVE_KEYS = new Set([
  'password',
  'access_token',
  'accessToken',
  'refresh_token',
  'refreshToken',
  'secret',
  'credential',
  'credentials',
  'apiKey',
  'api_key',
  'token',
]);

export function sanitizeForAudit(data: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!data) return null;
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (SENSITIVE_KEYS.has(key)) {
      result[key] = '[REDACTED]';
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = sanitizeForAudit(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result;
}

export function hashRequestBody(body: unknown): string {
  const serialized = JSON.stringify(body ?? {});
  return createHash('sha256').update(serialized).digest('hex');
}
