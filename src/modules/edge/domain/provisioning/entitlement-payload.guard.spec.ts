import { describe, expect, it } from 'vitest';
import {
  assessEntitlementPayload,
  assertProvisioningAdapterAllowedInEnv,
  isLabProvisioningAdapter,
} from './entitlement-payload.guard.js';

describe('entitlement-payload.guard', () => {
  it('flags empty object', () => {
    expect(assessEntitlementPayload({}).empty).toBe(true);
  });

  it('accepts modules map', () => {
    expect(assessEntitlementPayload({ modules: { pos: true } }).empty).toBe(false);
  });

  it('accepts grants array', () => {
    expect(
      assessEntitlementPayload({}, [{ code: 'pharmacy.batch', enabled: true }]).empty,
    ).toBe(false);
  });

  it('forbids lab_bb in production', () => {
    expect(() =>
      assertProvisioningAdapterAllowedInEnv({ nodeEnv: 'production', adapter: 'lab_bb' }),
    ).toThrow(/lab_bb is forbidden in production/);
  });

  it('allows lab_bb in development', () => {
    expect(() =>
      assertProvisioningAdapterAllowedInEnv({ nodeEnv: 'development', adapter: 'lab_bb' }),
    ).not.toThrow();
  });

  it('detects lab adapter', () => {
    expect(isLabProvisioningAdapter('lab_bb')).toBe(true);
    expect(isLabProvisioningAdapter('durable')).toBe(false);
  });
});
