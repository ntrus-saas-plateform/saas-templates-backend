import { describe, expect, it } from 'vitest';
import {
  computePlanFingerprint,
  validateResourcePlan,
  type PlanValidationContext,
} from './keycloak-plan.js';
import { KeycloakTopologyType, type KeycloakPlanInput } from './keycloak.types.js';

/** Fully-satisfied context — everything P7.1/P7.3/P7.6 gates green. */
function happyContext(overrides: Partial<PlanValidationContext> = {}): PlanValidationContext {
  return {
    providerActive: true,
    providerSupportsTopology: true,
    serverActive: true,
    serverReachable: true,
    tlsRequiredByProfile: true,
    tlsModeOnServer: 'REQUIRED',
    privateNetworkAllowed: false,
    authorizationValid: true,
    authorizationExpired: false,
    authorizationRevoked: false,
    placementValid: true,
    organizationsSupportedByServer: true,
    profileOptions: {},
    ...overrides,
  };
}

function baseInput(overrides: Partial<KeycloakPlanInput> = {}): KeycloakPlanInput {
  return {
    tenantId: '11111111-1111-4111-8111-111111111111',
    productId: '22222222-2222-4222-8222-222222222222',
    providerId: '33333333-3333-4333-8333-333333333333',
    serverId: '44444444-4444-4444-8444-444444444444',
    topologyType: KeycloakTopologyType.DEDICATED_REALM,
    profileOptions: {},
    ...overrides,
  };
}

describe('validateResourcePlan (P7.7 fail-closed)', () => {
  it('rejects when authorization is not valid', () => {
    const result = validateResourcePlan(baseInput(), happyContext({ authorizationValid: false }));
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === 'AUTHORIZATION_FAILED')).toBe(true);
  });

  it('rejects when authorization is revoked', () => {
    const result = validateResourcePlan(baseInput(), happyContext({ authorizationRevoked: true }));
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === 'AUTHORIZATION_REVOKED')).toBe(true);
  });

  it('rejects when authorization is expired', () => {
    const result = validateResourcePlan(baseInput(), happyContext({ authorizationExpired: true }));
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === 'AUTHORIZATION_EXPIRED')).toBe(true);
  });

  it('rejects when placement is invalid', () => {
    const result = validateResourcePlan(baseInput(), happyContext({ placementValid: false }));
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === 'PLACEMENT_INVALID')).toBe(true);
  });

  it('rejects when the server is not ACTIVE or not reachable', () => {
    expect(
      validateResourcePlan(baseInput(), happyContext({ serverActive: false })).valid,
    ).toBe(false);
    expect(
      validateResourcePlan(baseInput(), happyContext({ serverReachable: false })).valid,
    ).toBe(false);
  });

  it('rejects a non-TLS server when the profile requires TLS', () => {
    const result = validateResourcePlan(
      baseInput(),
      happyContext({ tlsRequiredByProfile: true, tlsModeOnServer: 'OPTIONAL_INSECURE_LOCAL' }),
    );
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.field === 'serverId')).toBe(true);
  });

  it('rejects SHARED_REALM_ORGANIZATIONS when organizations are not verified', () => {
    const result = validateResourcePlan(
      baseInput({ topologyType: KeycloakTopologyType.SHARED_REALM_ORGANIZATIONS }),
      happyContext({ organizationsSupportedByServer: false }),
    );
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === 'CAPABILITY_UNSUPPORTED')).toBe(true);
  });

  it('rejects EXTERNAL_SPECIFIC without a certified adapter contract', () => {
    const result = validateResourcePlan(
      baseInput({ topologyType: KeycloakTopologyType.EXTERNAL_SPECIFIC }),
      happyContext(),
    );
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === 'TOPOLOGY_UNSUPPORTED')).toBe(true);

    const certified = validateResourcePlan(
      baseInput({
        topologyType: KeycloakTopologyType.EXTERNAL_SPECIFIC,
        profileOptions: { certifiedExternalAdapter: true },
      }),
      happyContext({ profileOptions: { certifiedExternalAdapter: true } }),
    );
    expect(certified.valid).toBe(true);
  });

  it('rejects unknown topology types', () => {
    const result = validateResourcePlan(
      baseInput({ topologyType: 'SOMETHING_ELSE' }),
      happyContext(),
    );
    expect(result.valid).toBe(false);
  });

  it('accepts a valid dedicated-realm plan with a deterministic realm name', () => {
    const result = validateResourcePlan(baseInput(), happyContext());
    expect(result.valid).toBe(true);
    expect(result.resolvedRealmName).toBeTruthy();
    const again = validateResourcePlan(baseInput(), happyContext());
    expect(again.resolvedRealmName).toBe(result.resolvedRealmName);
  });

  it('rejects dangerous redirect URIs and web origins from the profile', () => {
    const result = validateResourcePlan(baseInput(), {
      ...happyContext(),
      profileOptions: {
        clientRedirectUris: ['https://evil.example.com/*'],
        clientWebOrigins: ['*'],
      },
    });
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.field === 'clientRedirectUris')).toBe(true);
    expect(result.issues.some((i) => i.field === 'clientWebOrigins')).toBe(true);
  });

  it('rejects wildcard/template redirect patterns and non-http schemes', () => {
    const result = validateResourcePlan(baseInput(), {
      ...happyContext(),
      profileOptions: {
        clientRedirectUris: ['{{evil}}', 'javascript:alert(1)', 'ftp://x'],
      },
    });
    expect(result.valid).toBe(false);
  });

  it('never lets an arbitrary internal endpoint become the resolved realm identity', () => {
    const result = validateResourcePlan(
      baseInput({ profileOptions: { issuer: 'http://169.254.169.254/latest' } }),
      happyContext(),
    );
    // The realm name is ALWAYS derived from tenant/product — never from an endpoint.
    expect(result.resolvedRealmName).not.toContain('169.254');
    expect(result.resolvedRealmName).toMatch(/^okapi-t-/);
  });
});

describe('computePlanFingerprint', () => {
  it('is deterministic for identical inputs (key order independent)', () => {
    const a = computePlanFingerprint(
      baseInput({ profileOptions: { b: 1, a: 2 } }),
    );
    const b = computePlanFingerprint(
      baseInput({ profileOptions: { a: 2, b: 1 } }),
    );
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('changes when a security-relevant field changes', () => {
    const a = computePlanFingerprint(baseInput());
    const b = computePlanFingerprint(
      baseInput({ topologyType: KeycloakTopologyType.SHARED_REALM_ORGANIZATIONS }),
    );
    expect(a).not.toBe(b);
  });

  it('contains no secret material (fingerprint only)', () => {
    const fp = computePlanFingerprint(
      baseInput({ metadata: { adminCredential: 'super-secret-value' } }),
    );
    expect(fp).not.toContain('super-secret');
    expect(fp).toMatch(/^[0-9a-f]{64}$/);
  });
});
