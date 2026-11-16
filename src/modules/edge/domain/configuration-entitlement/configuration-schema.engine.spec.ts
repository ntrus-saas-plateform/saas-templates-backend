import { describe, expect, it } from 'vitest';
import {
  assertNoEntitlementExpansion,
  checksumPayload,
  validateAgainstSchema,
} from './configuration-schema.engine.js';
import { ConfigurationErrorCode } from './configuration.types.js';

describe('P7.8 configuration schema engine', () => {
  it('computes stable checksums independent of key order', () => {
    expect(checksumPayload({ b: 1, a: 2 })).toBe(checksumPayload({ a: 2, b: 1 }));
  });

  it('validates required fields, enums and rejects additional properties', () => {
    const schema = {
      type: 'object',
      required: ['mode'],
      additionalProperties: false,
      properties: {
        mode: { type: 'string', enum: ['STANDARD', 'ENTERPRISE'] },
        seats: { type: 'integer', minimum: 1, maximum: 100 },
      },
    };
    expect(validateAgainstSchema(schema, { mode: 'STANDARD', seats: 5 }).ok).toBe(true);
    const bad = validateAgainstSchema(schema, { mode: 'OTHER', seats: 0, extra: true });
    expect(bad.ok).toBe(false);
    expect(bad.issues.some((i) => i.path === '$.mode')).toBe(true);
    expect(bad.issues.some((i) => i.path === '$.seats')).toBe(true);
    expect(bad.issues.some((i) => i.path === '$.extra')).toBe(true);
  });

  it('rejects plaintext secret-like fields but allows vault refs', () => {
    const schema = { type: 'object', properties: { clientSecret: { type: 'string' } } };
    const denied = validateAgainstSchema(schema, { clientSecret: 'super-secret-value' });
    expect(denied.ok).toBe(false);
    expect(denied.issues[0]?.code).toBe(ConfigurationErrorCode.SECRET_PLAINTEXT_FORBIDDEN);

    const allowed = validateAgainstSchema(schema, { clientSecret: 'sec_abc123' });
    expect(allowed.ok).toBe(true);
  });

  it('fail-closes entitlement expansion beyond P5 granted snapshot', () => {
    const granted = {
      capabilities: { reporting: true, api: true },
      featureFlags: { betaUi: false },
      quotas: { seats: 10 },
      limits: { storageGb: 50 },
    };
    expect(
      assertNoEntitlementExpansion({
        granted,
        desired: {
          capabilities: { reporting: true },
          featureFlags: { betaUi: false },
          quotas: { seats: 10 },
          limits: { storageGb: 40 },
        },
      }).ok,
    ).toBe(true);

    const expanded = assertNoEntitlementExpansion({
      granted,
      desired: {
        capabilities: { reporting: true, analytics: true },
        featureFlags: { betaUi: true },
        quotas: { seats: 20 },
        limits: { storageGb: 100 },
      },
    });
    expect(expanded.ok).toBe(false);
    expect(
      expanded.issues.every((i) => i.code === ConfigurationErrorCode.ENTITLEMENT_EXPANSION),
    ).toBe(true);
  });
});
