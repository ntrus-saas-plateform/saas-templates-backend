import { describe, expect, it } from 'vitest';
import {
  HttpKeycloakAdminAdapter,
  redactSensitive,
} from '../../src/modules/edge/infrastructure/keycloak/keycloak-admin.adapter.js';
import { EncryptedSecretsProvider } from '../../src/modules/edge/infrastructure/infrastructure-provisioning/secrets-provider.adapter.js';
import {
  validateRedirectUris,
  validateWebOrigins,
  validateResourcePlan,
  deriveRealmName,
  type PlanValidationContext,
} from '../../src/modules/edge/domain/keycloak-topology/keycloak-plan.js';
import {
  KeycloakTopologyType,
  type KeycloakPlanInput,
} from '../../src/modules/edge/domain/keycloak-topology/keycloak.types.js';
import { KeycloakProvisioningHandler } from '../../src/modules/edge/domain/keycloak-topology/keycloak-handlers.js';
import type { KeycloakAdminConnection } from '../../src/modules/edge/domain/keycloak-topology/keycloak-provider.port.js';
import type { WorkflowHandlerInput } from '../../src/modules/edge/domain/workflow/workflow-handler.port.js';

/**
 * P7.7 security suite — SSRF origin guard, redirect/origin wildcard policy,
 * secret masking, fencing-token enforcement, P7.1 fail-closed revocation.
 */
describe('P7.7 security — SSRF origin guard (registered server origin only)', () => {
  const secrets = new EncryptedSecretsProvider('security-suite-key');
  const conn: KeycloakAdminConnection = {
    baseUrl: 'https://kc.corp.example',
    adminRealm: 'master',
    adminClientId: 'edge-admin',
    adminCredentialRef: 'sec_x',
    tlsMode: 'REQUIRED',
    allowPrivateNetwork: false,
    timeoutMs: 1_000,
    maxRetries: 0,
  };

  function build(fetchImpl: typeof fetch): HttpKeycloakAdminAdapter {
    return new HttpKeycloakAdminAdapter({ secrets, fetchImpl });
  }

  const okFetch = (async () =>
    new Response('{}', { status: 200 })) as unknown as typeof fetch;

  it('OIDC discovery is ALWAYS built from the registered origin (no caller URL)', async () => {
    const seen: string[] = [];
    const spy = (async (url: string | URL | Request) => {
      seen.push(String(url));
      return new Response('{}', { status: 200 });
    }) as unknown as typeof fetch;
    const adapter = build(spy);

    // Hostile realm names must never move the request off the registered origin.
    await adapter.getOpenidConfiguration(conn, 'https://evil.example.net/steal');
    await adapter.getOpenidConfiguration(conn, '//evil.example.net/steal');
    await adapter.getOpenidConfiguration(conn, '../../admin/realms');

    expect(seen.length).toBe(3);
    for (const url of seen) {
      expect(url.startsWith('https://kc.corp.example/')).toBe(true);
    }
  });

  it('refuses plain http on a non-loopback registered origin', async () => {
    const plainConn: KeycloakAdminConnection = {
      ...conn,
      baseUrl: 'http://kc.corp.example',
    };
    const adapter = build(okFetch);
    await expect(
      adapter.getOpenidConfiguration(plainConn, 'realm-x'),
    ).rejects.toThrow(/scheme not allowed/);
  });

  it('loopback plain http is allowed only for local lab servers', async () => {
    const loopConn: KeycloakAdminConnection = {
      ...conn,
      baseUrl: 'http://localhost:8080',
    };
    const seen: string[] = [];
    const spy = (async (url: string | URL | Request) => {
      seen.push(String(url));
      return new Response('{"issuer":"x"}', { status: 200 });
    }) as unknown as typeof fetch;
    const adapter = build(spy);
    const doc = await adapter.getOpenidConfiguration(loopConn, 'lab-realm');
    expect(doc.issuer).toBe('x');
    expect(seen[0]).toBe(
      'http://localhost:8080/realms/lab-realm/.well-known/openid-configuration',
    );
  });

  it('refuses redirect wildcards and dangerous origins', () => {
    expect(validateRedirectUris(['https://app.example.com/*']).length).toBeGreaterThan(0);
    expect(validateRedirectUris(['https://*']).length).toBeGreaterThan(0);
    expect(validateRedirectUris(['javascript:alert(1)']).length).toBeGreaterThan(0);
    expect(validateRedirectUris(['{{template}}']).length).toBeGreaterThan(0);
    expect(validateRedirectUris(['https://app.example.com/cb']).length).toBe(0);

    expect(validateWebOrigins(['*']).length).toBeGreaterThan(0);
    expect(validateWebOrigins(['null']).length).toBeGreaterThan(0);
    expect(validateWebOrigins(['https://app.example.com']).length).toBe(0);
  });

  it('conn.baseUrl is never mutated by adapter calls', async () => {
    const adapter = build(okFetch);
    await adapter.getOpenidConfiguration(conn, 'r').catch(() => undefined);
    expect(conn.baseUrl).toBe('https://kc.corp.example');
  });
});

describe('P7.7 security — secret masking', () => {
  it('redacts bearer tokens, client secrets in URL and JSON forms', () => {
    const cases = [
      'Authorization: Bearer eyJhbGciOi.secret.sig',
      'POST token endpoint client_secret=abcd1234&grant_type=client_credentials',
      '{"client_secret":"s3cr3t-value","access_token":"zzz"}',
    ];
    for (const raw of cases) {
      const safe = redactSensitive(raw);
      expect(safe).not.toContain('eyJhbGciOi.secret');
      expect(safe).not.toContain('abcd1234');
      expect(safe).not.toContain('s3cr3t-value');
    }
  });

  it('vault stores material encrypted and returns it only by ref', async () => {
    const vault = new EncryptedSecretsProvider('masking-key');
    const stored = await vault.put({
      kind: 'keycloak-admin-service-account',
      material: { value: 'super-secret-admin-value' },
    });
    expect(stored.credentialRef).toMatch(/^sec_/);
    const meta = await vault.describe(stored.credentialRef);
    expect(JSON.stringify(meta)).not.toContain('super-secret-admin-value');
    const back = await vault.get(stored.credentialRef);
    expect(back.value).toBe('super-secret-admin-value'); // roundtrip for runtime use only
  });
});

describe('P7.7 security — fencing token enforcement', () => {
  function input(overrides: Partial<WorkflowHandlerInput> = {}): WorkflowHandlerInput {
    return {
      workflowId: 'wf-1',
      stepId: 's1',
      stepKey: 'topology_provision',
      handlerKey: 'keycloak.provision_realm',
      fencingToken: 3,
      attemptNumber: 1,
      inputSnapshot: {},
      workflowInput: {},
      correlationId: 'c1',
      workerId: 'w1',
      ...overrides,
    };
  }

  it('a stale/missing fencing token is rejected before touching Keycloak', async () => {
    let touched = false;
    const handler = new KeycloakProvisioningHandler('keycloak.provision_realm', async () => {
      touched = true;
      return { status: 'SUCCEEDED' };
    });
    const stale = await handler.execute(input({ fencingToken: 0 as unknown as number }));
    expect(stale.status).toBe('FAILED');
    expect(touched).toBe(false);

    const missing = await handler.execute(
      input({ fencingToken: undefined as unknown as number }),
    );
    expect(missing.status).toBe('FAILED');
    expect(touched).toBe(false);
  });

  it('a valid fencing token reaches the live executor', async () => {
    let touched = false;
    const handler = new KeycloakProvisioningHandler('keycloak.provision_realm', async () => {
      touched = true;
      return { status: 'SUCCEEDED' };
    });
    const ok = await handler.execute(input({ fencingToken: 3 }));
    expect(ok.status).toBe('SUCCEEDED');
    expect(touched).toBe(true);
  });
});

describe('P7.7 security — P7.1 authorization fail-closed', () => {
  function plan(overrides: Partial<PlanValidationContext> = {}): PlanValidationContext {
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
  const input: KeycloakPlanInput = {
    tenantId: '11111111-1111-4111-8111-111111111111',
    productId: '22222222-2222-4222-8222-222222222222',
    providerId: '33333333-3333-4333-8333-333333333333',
    serverId: '44444444-4444-4444-8444-444444444444',
    topologyType: KeycloakTopologyType.DEDICATED_REALM,
    profileOptions: {},
  };

  it('a revoked or expired authorization blocks provisioning', () => {
    expect(
      validateResourcePlan(input, plan({ authorizationValid: false })).valid,
    ).toBe(false);
    expect(validateResourcePlan(input, plan({ authorizationExpired: true })).valid).toBe(false);
    expect(validateResourcePlan(input, plan({ authorizationRevoked: true })).valid).toBe(false);
  });

  it('no authorization at all (fail-closed defaults) is refused', () => {
    const failClosed: PlanValidationContext = {
      ...plan(),
      authorizationValid: false,
      placementValid: false,
      organizationsSupportedByServer: false,
    };
    expect(validateResourcePlan(input, failClosed).valid).toBe(false);
  });

  it('realm identity is Edge-derived — never taken from raw input endpoints', () => {
    const name = deriveRealmName({
      tenantId: input.tenantId,
      productId: input.productId,
      topologyType: KeycloakTopologyType.DEDICATED_REALM,
      profileOptions: { issuer: 'http://169.254.169.254' },
    });
    expect(name).toMatch(/^okapi-t-[0-9a-f]{8}-p-[0-9a-f]{8}$/);
    expect(name).not.toContain('169.254');
  });
});
