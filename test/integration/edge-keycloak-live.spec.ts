import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GenericContainer, type StartedTestContainer } from 'testcontainers';
import { randomUUID } from 'node:crypto';
import { runTestcontainers } from '../helpers/testcontainers-env.js';
import { EncryptedSecretsProvider } from '../../src/modules/edge/infrastructure/infrastructure-provisioning/secrets-provider.adapter.js';
import { HttpKeycloakAdminAdapter, redactSensitive, isVersionAtLeast } from '../../src/modules/edge/infrastructure/keycloak/keycloak-admin.adapter.js';
import type { KeycloakAdminConnection } from '../../src/modules/edge/domain/keycloak-topology/keycloak-provider.port.js';

/**
 * P7.7 Keycloak integration — REAL Keycloak container (Testcontainers).
 * Exercises the certified adapter end-to-end: token auth, realm lifecycle
 * (idempotent), technical clients (secret → vault only), OIDC discovery,
 * origin confinement (SSRF) and secret redaction.
 */
describe.skipIf(!runTestcontainers)('P7.7 Keycloak live adapter (Testcontainers)', () => {
  let container: StartedTestContainer;
  let adapter: HttpKeycloakAdminAdapter;
  let conn: KeycloakAdminConnection;
  let secrets: EncryptedSecretsProvider;
  let baseUrl: string;
  let port: number;
  const REALM = 'p77-it-realm';
  const CLIENT_ID = `edge-tech-${randomUUID().slice(0, 8)}`;

  beforeAll(async () => {
    container = await new GenericContainer('quay.io/keycloak/keycloak:26.0.7')
      .withCommand(['start-dev', '--http-port=8080', '--features=organization'])
      .withEnvironment({
        KC_BOOTSTRAP_ADMIN_USERNAME: 'edge-admin-initial',
        KC_BOOTSTRAP_ADMIN_PASSWORD: 'EdgeAdminInitial123!',
      })
      .withExposedPorts(8080)
      .withStartupTimeout(300_000)
      .start();
    port = container.getMappedPort(8080);
    baseUrl = `http://localhost:${port}`;

    // Wait until the admin API answers (ready = 401 without token).
    const deadline = Date.now() + 120_000;
    for (;;) {
      try {
        const res = await fetch(`${baseUrl}/admin/serverinfo`);
        if (res.status === 401 || res.status === 200) break;
      } catch {
        /* not up yet */
      }
      if (Date.now() > deadline) throw new Error('Keycloak did not become ready in time');
      await new Promise((r) => setTimeout(r, 1_500));
    }

    // Provision a service-account admin client via the bootstrap admin, then
    // hand its secret ONLY to the encrypted vault (opaque ref afterwards).
    const bootstrapToken = await (async () => {
      const res = await fetch(`${baseUrl}/realms/master/protocol/openid-connect/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'password',
          client_id: 'admin-cli',
          username: 'edge-admin-initial',
          password: 'EdgeAdminInitial123!',
        }),
      });
      const data = (await res.json()) as { access_token?: string };
      if (!data.access_token) throw new Error('bootstrap token failed');
      return data.access_token;
    })();

    const clientSecret = 'edge-service-account-secret-1';
    const createRes = await fetch(`${baseUrl}/admin/realms/master/clients`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${bootstrapToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        clientId: 'edge-topology-admin',
        enabled: true,
        publicClient: false,
        secret: clientSecret,
        serviceAccountsEnabled: true,
        standardFlowEnabled: false,
        directAccessGrantsEnabled: false,
      }),
    });
    expect([201, 204, 409]).toContain(createRes.status);

    // Grant the service account the master `admin` role (real admin API access).
    const clientListRes = await fetch(
      `${baseUrl}/admin/realms/master/clients?clientId=edge-topology-admin`,
      { headers: { Authorization: `Bearer ${bootstrapToken}` } },
    );
    const clientRows = (await clientListRes.json()) as Array<{ id: string }>;
    const clientUuid = clientRows[0]?.id;
    if (!clientUuid) throw new Error('edge-topology-admin client not found');
    const saRes = await fetch(
      `${baseUrl}/admin/realms/master/clients/${clientUuid}/service-account-users`,
      { headers: { Authorization: `Bearer ${bootstrapToken}` } },
    );
    let saUserId: string | undefined;
    if (saRes.ok) {
      const saRows = (await saRes.json()) as Array<{ id: string }>;
      saUserId = saRows[0]?.id;
    }
    if (!saUserId) {
      // Fallback: resolve the service account user by its conventional username.
      const usersRes = await fetch(
        `${baseUrl}/admin/realms/master/users?username=service-account-edge-topology-admin&exact=true`,
        { headers: { Authorization: `Bearer ${bootstrapToken}` } },
      );
      const usersText = await usersRes.text();
      if (usersRes.ok) {
        const userRows = JSON.parse(usersText) as Array<{ id: string }>;
        saUserId = userRows[0]?.id;
      }
      if (!saUserId) {
        throw new Error(
          `service account user unresolved (sa=${saRes.status}: ${await saRes.text()} / users=${usersRes.status}: ${usersText})`,
        );
      }
    }
    const adminRoleRes = await fetch(`${baseUrl}/admin/realms/master/roles/admin`, {
      headers: { Authorization: `Bearer ${bootstrapToken}` },
    });
    const adminRole = (await adminRoleRes.json()) as { id: string; name: string };
    const grantRes = await fetch(
      `${baseUrl}/admin/realms/master/users/${saUserId}/role-mappings/realm`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${bootstrapToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([{ id: adminRole.id, name: adminRole.name }]),
      },
    );
    expect([204, 409]).toContain(grantRes.status);

    secrets = new EncryptedSecretsProvider('p77-integration-test-key');
    const stored = await secrets.put({
      kind: 'keycloak-admin-service-account',
      material: { value: clientSecret },
    });
    adapter = new HttpKeycloakAdminAdapter({ secrets });
    conn = {
      baseUrl,
      adminRealm: 'master',
      adminClientId: 'edge-topology-admin',
      adminCredentialRef: stored.credentialRef,
      tlsMode: 'OPTIONAL_INSECURE_LOCAL',
      allowPrivateNetwork: true,
      timeoutMs: 20_000,
      maxRetries: 1,
    };
  }, 240_000);

  afterAll(async () => {
    await container?.stop();
  });

  it('discovers real server capabilities (authenticated admin API)', async () => {
    const caps = await adapter.discoverCapabilities(conn);
    expect(caps.adminApiReachable).toBe(true);
    expect(caps.keycloakVersion).toMatch(/^\d+\.\d+/);
    expect(caps.discoverySource).toBe('SERVERINFO');
    expect(isVersionAtLeast(caps.keycloakVersion ?? '0.0', 26, 0)).toBe(true);
  });

  it('creates a realm idempotently and re-adopts it on second call', async () => {
    const target = {
      topologyId: randomUUID(),
      realmName: REALM,
      tenantId: randomUUID(),
      topologyType: 'DEDICATED_REALM',
      expectedFingerprint: '',
    };
    const first = await adapter.createRealm(conn, target);
    expect(first.exists).toBe(true);
    expect(first.externalId).toBeTruthy();

    // Second call: no duplicate, same external id (reconcile-before-create).
    const second = await adapter.createRealm(conn, target);
    expect(second.exists).toBe(true);
    expect(second.externalId).toBe(first.externalId);
  });

  it('creates a confidential technical client and returns its secret ONCE', async () => {
    const spec = {
      clientId: CLIENT_ID,
      clientKind: 'CONFIDENTIAL' as const,
      ownerFunction: 'console',
      usage: 'P7.7 integration',
      redirectUris: ['https://app.example.com/callback'],
      webOrigins: ['https://app.example.com'],
      scopes: ['openid', 'profile'],
    };
    const created = await adapter.createTechnicalClient(conn, REALM, spec);
    expect(created.externalId).toBeTruthy();
    expect(typeof created.clientSecret).toBe('string');
    expect(created.clientSecret!.length).toBeGreaterThan(10);

    // Idempotent re-create: same external id, NO secret re-issued.
    const again = await adapter.createTechnicalClient(conn, REALM, spec);
    expect(again.externalId).toBe(created.externalId);
    expect(again.clientSecret).toBeUndefined();
  });

  it('serves real OIDC discovery for the provisioned realm', async () => {
    const oidc = await adapter.getOpenidConfiguration(conn, REALM);
    expect(String(oidc.issuer)).toContain(`/realms/${REALM}`);
    expect(oidc.authorization_endpoint).toBeTruthy();
    expect(oidc.token_endpoint).toBeTruthy();
  });

  it('detects organization support by probing the real admin API', async () => {
    const obs = await adapter.organizationExists(conn, REALM, 't-itorg');
    // 404 (unsupported/disabled) or empty list (supported, no match) both fine —
    // the probe must never throw a transport error against a healthy server.
    expect(typeof obs.exists).toBe('boolean');
  });

  it('keeps hostile realm names on the registered origin (SSRF)', async () => {
    // The discovery URL is built ONLY from the registered conn origin; a
    // hostile realm name must resolve to a 404 on the registered server,
    // never to a request against another host.
    await expect(
      adapter.getOpenidConfiguration(conn, 'https://evil.example.com/'),
    ).rejects.toThrow(/OIDC discovery failed: HTTP 404/);
    await expect(
      adapter.getOpenidConfiguration(conn, '//evil.example.com/steal'),
    ).rejects.toThrow(/OIDC discovery failed: HTTP 404/);
  });

  it('health() reports authenticated reachability without leaking the secret', async () => {
    const h = await adapter.health(conn);
    expect(h.ok).toBe(true);
    expect(h.details.authenticated).toBe(true);
    const serialized = JSON.stringify(h);
    expect(serialized).not.toContain('edge-service-account-secret-1');
    expect(serialized).not.toContain('EdgeAdminInitial123!');
  });

  it('redacts bearer tokens and client secrets in any outbound text', () => {
    const raw = 'Bearer abc.def.ghi client_secret=SUPERSECRET123 "client_secret":"OTHERSECRET"';
    const safe = redactSensitive(raw);
    expect(safe).not.toContain('abc.def.ghi');
    expect(safe).not.toContain('SUPERSECRET123');
    expect(safe).not.toContain('OTHERSECRET');
  });
});

