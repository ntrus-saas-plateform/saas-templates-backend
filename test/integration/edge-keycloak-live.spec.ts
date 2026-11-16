import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GenericContainer, type StartedTestContainer } from 'testcontainers';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { runTestcontainers } from '../helpers/testcontainers-env.js';
import { applyControlPlaneMigrations } from '../helpers/control-plane-migrate.js';
import { EncryptedSecretsProvider } from '../../src/modules/edge/infrastructure/infrastructure-provisioning/secrets-provider.adapter.js';
import { HttpKeycloakAdminAdapter, redactSensitive, isVersionAtLeast } from '../../src/modules/edge/infrastructure/keycloak/keycloak-admin.adapter.js';
import type { KeycloakAdminConnection } from '../../src/modules/edge/domain/keycloak-topology/keycloak-provider.port.js';
import type { ControlPlaneTransactionManagerPort } from '../../src/core/domain/ports/control-plane-transaction-manager.port.js';
import type { ControlPlaneOutboxStorePort } from '../../src/core/domain/ports/control-plane-outbox.port.js';
import { ControlPlaneOutboxTransactionService } from '../../src/shared/messaging/control-plane-outbox-transaction.service.js';
import { PgControlPlaneOutboxStore } from '../../src/shared/messaging/pg-control-plane-outbox.store.js';
import { PgAuditEventRepository } from '../../src/modules/edge/infrastructure/persistence/pg-audit-event.repository.js';
import { PgWorkflowRepository } from '../../src/modules/edge/infrastructure/workflow/pg-workflow.repository.js';
import { PgProvisioningRepository } from '../../src/modules/edge/infrastructure/provisioning/pg-provisioning.repository.js';
import { PgWorkflowAuthorizationAdapter } from '../../src/modules/edge/infrastructure/workflow/pg-workflow-authorization.adapter.js';
import { PgKeycloakRepository } from '../../src/modules/edge/infrastructure/keycloak/pg-keycloak.repository.js';
import { WorkflowHandlerRegistry } from '../../src/modules/edge/infrastructure/workflow/workflow-handler.registry.js';
import {
  ClaimStepUseCase,
  CompleteStepUseCase,
  CreateWorkflowInstanceUseCase,
  ExecuteClaimedStepUseCase,
  FailStepUseCase,
  StartWorkflowUseCase,
} from '../../src/modules/edge/application/workflow/workflow.use-cases.js';
import {
  CreateKeycloakTopologyUseCase,
  DiscoverKeycloakCapabilitiesUseCase,
  ensureKeycloakDefinition,
  LaunchTopologyWorkflowUseCase,
} from '../../src/modules/edge/application/keycloak-topology/keycloak.use-cases.js';
import { createLiveKeycloakExecutor } from '../../src/modules/edge/infrastructure/keycloak/live-keycloak.executor.js';
import { RepositoryWorkflowLeaseValidator } from '../../src/modules/edge/domain/workflow/workflow-lease.port.js';
import {
  KeycloakErrorCode,
  KeycloakTopologyStatus,
  KeycloakTopologyType,
} from '../../src/modules/edge/domain/keycloak-topology/keycloak.types.js';
import { EdgeKeycloakController } from '../../src/modules/edge/presentation/controllers/keycloak.controller.js';

const ACTOR = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

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

  // -------------------------------------------------------------------------
  // P7.7 live operations harness (§4 organization + §5 reconciliation):
  // REAL Postgres (P7.1 authorizations, P7.4 engine, P7.7 topology registry),
  // REAL Keycloak container, production wiring end-to-end (executor + worker
  // claim/execute path + controller → workflow routing).
  // -------------------------------------------------------------------------
  let pgContainer: StartedPostgreSqlContainer;
  let pool: pg.Pool;
  let liveRepo: PgKeycloakRepository;
  let wfRepo: PgWorkflowRepository;
  let authPort: PgWorkflowAuthorizationAdapter;
  let outbox: ControlPlaneOutboxTransactionService;
  let audit: PgAuditEventRepository;
  let discoverUC: DiscoverKeycloakCapabilitiesUseCase;
  let launchUC: LaunchTopologyWorkflowUseCase;
  let createInstanceUC: CreateWorkflowInstanceUseCase;
  let startUC: StartWorkflowUseCase;
  let claimUC: ClaimStepUseCase;
  let executeClaimedUC: ExecuteClaimedStepUseCase;
  let provisionDefinitionId: string;
  let reconcileDefinitionId: string;
  let serverId: string;
  let providerId: string;
  let productId: string;
  let controller: EdgeKeycloakController;
  let recorder: HttpKeycloakAdminAdapter;
  let opsSeq = 0;
  const WORKER = 'live-worker-a';
  /** Counts of REAL provider calls made through the executor (never replaces it). */
  const providerCalls: Record<string, number> = {};
  /** Shared context between the organization tests (create → partial-failure). */
  let orgCtx: {
    topologyId: string;
    tenantId: string;
    requestId: string;
    externalOrgId: string;
  };

  const SHARED_REALM = 'p77-live-shared-realm';
  const ORG_ALIAS = 'p77techorg';
  const DENY_REALM = 'p77-live-deny-realm';
  const DENY_ALIAS = 'p77denyorg';
  const REC_REALM = 'p77-live-reconcile-realm';

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

    // -------------------------------------------------------------------------
    // Live operations harness — REAL Postgres for P7.1 (authorizations),
    // P7.4 (durable workflow engine: definitions/instances/steps/leases) and
    // P7.7 (topology registry). Same components the application wires.
    // -------------------------------------------------------------------------
    pgContainer = await new PostgreSqlContainer('postgres:16-alpine').start();
    pool = new pg.Pool({ connectionString: pgContainer.getConnectionUri() });
    await applyControlPlaneMigrations(pool);
    // Control-plane outbox tenant is a logical TEXT key (migration 021 typed UUID).
    await pool.query(`
      ALTER TABLE control_plane_outbox_events
        DROP CONSTRAINT IF EXISTS control_plane_outbox_events_tenant_id_fkey;
      ALTER TABLE control_plane_outbox_events
        ALTER COLUMN tenant_id TYPE TEXT USING tenant_id::text;
    `);

    const cpDb = { getPool: () => pool };
    const txManager: ControlPlaneTransactionManagerPort = {
      async runInTransaction<T>(fn: (client: unknown) => Promise<T>): Promise<T> {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const result = await fn(client);
          await client.query('COMMIT');
          return result;
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        } finally {
          client.release();
        }
      },
    };
    outbox = new ControlPlaneOutboxTransactionService(
      txManager,
      new PgControlPlaneOutboxStore({ getControlPlanePool: () => pool } as never) as ControlPlaneOutboxStorePort,
    );
    audit = new PgAuditEventRepository(cpDb as never);
    wfRepo = new PgWorkflowRepository(cpDb as never);
    liveRepo = new PgKeycloakRepository(cpDb as never);
    authPort = new PgWorkflowAuthorizationAdapter(new PgProvisioningRepository(cpDb as never));

    providerId = (await liveRepo.getProviderByCode('keycloak-managed-v1'))!.id;

    // Real product row (FK on edge_p7_keycloak_topologies.product_id).
    opsSeq += 1;
    const vertical = randomUUID();
    productId = randomUUID();
    await pool.query(
      `INSERT INTO edge_verticals (id, code, slug, display_name, status)
       VALUES ($1,$2,$2,$3,'DRAFT')`,
      [vertical, `p77-live-v-${opsSeq}`, `P77 Live V ${opsSeq}`],
    );
    await pool.query(
      `INSERT INTO edge_products (id, code, slug, name, vertical_id, lifecycle_status, commercial_availability)
       VALUES ($1,$2,$2,$3,$4,'PUBLISHED','AVAILABLE')`,
      [productId, `p77-live-p-${opsSeq}`, `Product live ${opsSeq}`, vertical],
    );

    // Server row bound to the REAL container; the secret stays in the vault.
    const server = await liveRepo.createServer(
      {
        id: randomUUID(),
        providerId,
        code: `kc-live-${opsSeq}`,
        name: 'Keycloak Live',
        baseUrl,
        adminRealm: 'master',
        adminClientId: 'edge-topology-admin',
        adminCredentialRef: stored.credentialRef,
        tlsMode: 'OPTIONAL_INSECURE_LOCAL',
        allowPrivateNetwork: true,
        environment: 'TEST',
        operationalStatus: 'ACTIVE',
        discoveredVersion: null,
        lastConnectivityStatus: null,
        lastConnectivityAt: null,
        metadata: {},
        createdBy: ACTOR,
        updatedBy: ACTOR,
      },
      ACTOR,
    );
    serverId = server.id;

    // Canonical P7.4 definitions — the exact same function the controller path uses.
    provisionDefinitionId = (await ensureKeycloakDefinition(wfRepo, outbox, audit, ACTOR, 'provision')).id;
    reconcileDefinitionId = (await ensureKeycloakDefinition(wfRepo, outbox, audit, ACTOR, 'reconcile')).id;

    const placementStub = {
      getWorkflowReadyPlacement: async () => null,
      validateConfirmedPlacement: async () =>
        ({ ok: false as const, reason: 'DECISION_NOT_FOUND' as const }),
    };

    // Recording wrapper over the REAL adapter (counts calls, never replaces it).
    recorder = recordingProvider(adapter);
    discoverUC = new DiscoverKeycloakCapabilitiesUseCase(liveRepo, recorder, outbox, audit);
    const createTopologyUC = new CreateKeycloakTopologyUseCase(
      liveRepo,
      authPort,
      placementStub as never,
      outbox,
      audit,
    );
    // Production executor wiring: real repo + real provider + canonical P7.1
    // authorization port + authoritative P7.4 lease validator.
    const executor = createLiveKeycloakExecutor({
      repo: liveRepo,
      provider: recorder,
      secrets,
      discoverCapabilities: discoverUC,
      createTopology: createTopologyUC,
      authorization: authPort,
      lease: new RepositoryWorkflowLeaseValidator((stepId) => wfRepo.getStep(stepId)),
    });
    const handlers = new WorkflowHandlerRegistry(undefined, undefined, executor);
    createInstanceUC = new CreateWorkflowInstanceUseCase(wfRepo, authPort, placementStub as never, outbox, audit);
    startUC = new StartWorkflowUseCase(wfRepo, authPort, placementStub as never, outbox, audit);
    claimUC = new ClaimStepUseCase(wfRepo, outbox, audit);
    const completeUC = new CompleteStepUseCase(wfRepo, outbox, audit);
    const failUC = new FailStepUseCase(wfRepo, outbox, audit);
    executeClaimedUC = new ExecuteClaimedStepUseCase(handlers, completeUC, failUC, wfRepo, outbox, audit);
    launchUC = new LaunchTopologyWorkflowUseCase(
      liveRepo,
      wfRepo,
      authPort,
      outbox,
      audit,
      createInstanceUC,
      startUC,
    );
    // Controller instance with the REAL launch use case (routing proof at DB level).
    controller = new EdgeKeycloakController(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      launchUC,
    );
  }, 300_000);

  afterAll(async () => {
    await pool?.end();
    await pgContainer?.stop();
    await container?.stop();
  });

  it('discovers real server capabilities (authenticated admin API)', async () => {
    const caps = await adapter.discoverCapabilities(conn);
    expect(caps.adminApiReachable).toBe(true);
    expect(caps.keycloakVersion).toMatch(/^\d+\.\d+/);
    expect(caps.discoverySource).toBe('SERVERINFO');
    expect(isVersionAtLeast(caps.keycloakVersion ?? '0.0', 26, 0)).toBe(true);
    // KC 26 Organizations feature is enabled at server level (--features=organization).
    // Per-realm switch is applied later at createRealm/createOrganization time.
    expect(caps.organizationsSupported).toBe(true);
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

  // =========================================================================
  // §4 — LIVE Keycloak Organization creation (genuine Testcontainers path)
  // §5 — LIVE reconciliation (drift → remediation → idempotence → recovery)
  // §1 — LIVE P7.1 fail-closed revocation (zero provider calls on denial)
  // =========================================================================

  /** Wraps the REAL adapter to count provider calls — never replaces it. */
  function recordingProvider(target: HttpKeycloakAdminAdapter): HttpKeycloakAdminAdapter {
    return new Proxy(target, {
      get(t, prop) {
        const value = Reflect.get(t, prop) as unknown;
        if (typeof value === 'function' && typeof prop === 'string' && prop !== 'constructor') {
          return (...args: unknown[]) => {
            providerCalls[prop] = (providerCalls[prop] ?? 0) + 1;
            return (value as (...a: unknown[]) => unknown).apply(t, args);
          };
        }
        return value;
      },
    });
  }
  function providerSnapshot(): Record<string, number> {
    return { ...providerCalls };
  }
  function providerDelta(before: Record<string, number>): Record<string, number> {
    const out: Record<string, number> = {};
    for (const k of new Set([...Object.keys(before), ...Object.keys(providerCalls)])) {
      out[k] = (providerCalls[k] ?? 0) - (before[k] ?? 0);
    }
    return out;
  }

  /** Fresh bootstrap-admin token (minted at call time: carries realms existing NOW). */
  async function masterAdminToken(): Promise<string> {
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
    if (!data.access_token) throw new Error(`bootstrap admin token failed: ${res.status}`);
    return data.access_token;
  }

  async function adminGet<T>(path: string): Promise<T> {
    const token = await masterAdminToken();
    const res = await fetch(`${baseUrl}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`admin GET ${path} → ${res.status}: ${text.slice(0, 300)}`);
    return JSON.parse(text) as T;
  }

  /** Persist a canonical P7.1 authorization + ACCEPTED provisioning request. */
  async function seedAuthorization(tenantId: string) {
    opsSeq += 1;
    const authRowId = randomUUID();
    const authorizationId = randomUUID();
    const requestId = randomUUID();
    const accountId = randomUUID();
    const subscriptionId = randomUUID();
    await pool.query(
      `INSERT INTO edge_provisioning_authorizations (
         id, authorization_id, authorization_version, authorization_type, operation,
         account_id, subscription_id, product_id, product_tenant_id, correlation_id, idempotency_key,
         decision, authorization_status, decision_timestamp, issued_at,
         entitlement_snapshot_reference, entitlement_version, issuer, audience, key_id,
         signature_algorithm, payload_digest, signature_present, issued_by_service_identity,
         revocation_status, environment_slot, verification_status, verified_at, payload_snapshot
       ) VALUES (
         $1,$2,1,'PROVISION','PROVISION',$3,$4,$5,$6,$7,$8,
         'ALLOW','ACTIVE',NOW(),NOW(),
         'ent-ref','1','p5','okapi.edge.p7','kid-1',
         'EdDSA','digest',TRUE,'p5-svc',
         'NOT_REVOKED','PROD','VERIFIED',NOW(),'{}'::jsonb
       )`,
      [
        authRowId,
        authorizationId,
        accountId,
        subscriptionId,
        productId,
        tenantId,
        randomUUID(),
        `live-auth-idem-${opsSeq}`,
      ],
    );
    await pool.query(
      `INSERT INTO edge_p7_provisioning_requests (
         id, request_number, authorization_id, authorization_version, authorization_row_id,
         operation, account_id, product_id, subscription_id, product_tenant_id, correlation_id,
         request_status, environment_slot, idempotency_key, accepted_at
       ) VALUES (
         $1,$2,$3,1,$4,'PROVISION',$5,$6,$7,$8,$9,'ACCEPTED','PROD',$10,NOW()
       )`,
      [
        requestId,
        `LIVE-PR-${opsSeq}`,
        authorizationId,
        authRowId,
        accountId,
        productId,
        subscriptionId,
        tenantId,
        randomUUID(),
        `live-prov-idem-${opsSeq}`,
      ],
    );
    return { authRowId, requestId };
  }

  async function createTopologyRow(input: {
    tenantId: string;
    topologyType: KeycloakTopologyType;
    metadata: Record<string, unknown>;
    authRowId: string;
    authVersion: number;
  }) {
    return liveRepo.createTopology({
      id: randomUUID(),
      tenantId: input.tenantId,
      productId,
      subscriptionId: null,
      authorizationId: input.authRowId,
      authorizationVersion: input.authVersion,
      placementDecisionId: null,
      deploymentProfileId: null,
      deploymentProfileVersion: null,
      runtimeProfileId: null,
      providerId,
      serverId,
      topologyType: input.topologyType,
      realmRef: null,
      organizationRef: null,
      oidcConfigurationRef: null,
      externalRealmId: null,
      externalOrganizationId: null,
      keycloakVersion: null,
      desiredConfigVersion: 1,
      appliedConfigVersion: null,
      resourceFingerprint: null,
      status: KeycloakTopologyStatus.PLANNED,
      statusReason: null,
      lastHealthCheckAt: null,
      lastReconciliationAt: null,
      workflowId: null,
      deletionProtection: false,
      metadata: input.metadata,
      createdBy: ACTOR,
      updatedBy: ACTOR,
    });
  }

  /** Create + start a P7.4 provisioning workflow bound to the canonical authorization. */
  async function launchProvisionWorkflow(topologyId: string, tenantId: string, requestId: string) {
    opsSeq += 1;
    const instance = await createInstanceUC.execute({
      actorId: ACTOR,
      idempotencyKey: `live-prov-${opsSeq}`,
      definitionId: provisionDefinitionId,
      workflowType: 'keycloak.topology.provision',
      inputSnapshot: {
        topologyId,
        tenantId,
        serverId,
        provisioningRequestId: requestId,
        operation: 'provision',
      },
      provisioningRequestId: requestId,
    });
    await startUC.execute({ actorId: ACTOR, workflowId: instance.id });
    return instance.id;
  }

  /** Controller → LaunchTopologyWorkflowUseCase → registered reconcile definition. */
  async function launchReconcileViaController(topologyId: string, requestId: string) {
    opsSeq += 1;
    const result = await controller.requestReconciliation(
      topologyId,
      {
        correlationId: randomUUID(),
        idempotencyKey: `live-rec-${opsSeq}`,
        provisioningRequestId: requestId,
      } as never,
      { user: { sub: ACTOR } } as never,
    );
    return (result as { workflow: { id: string } }).workflow.id;
  }

  /**
   * Production worker path: ClaimStepUseCase → ExecuteClaimedStepUseCase
   * (fresh lease + fencing token from the AUTHORITATIVE step row).
   * Polls while a failed step is in retry backoff (next_retry_at).
   */
  async function runNextStep(workflowId: string, handlerKeys: string[]) {
    let claimed = null as Awaited<ReturnType<ClaimStepUseCase['execute']>>;
    for (let i = 0; i < 40; i++) {
      claimed = await claimUC.execute({
        workerId: WORKER,
        leaseMs: 180_000,
        handlerKeys,
        workflowId,
      });
      if (claimed) break;
      await new Promise((r) => setTimeout(r, 500));
    }
    if (!claimed) throw new Error(`no claimable step among: ${handlerKeys.join(', ')}`);
    if (claimed.workflow.id !== workflowId) {
      throw new Error(`claimed step of workflow ${claimed.workflow.id}, expected ${workflowId}`);
    }
    await executeClaimedUC.execute({
      step: claimed.step,
      workflow: claimed.workflow,
      workerId: WORKER,
    });
    const step = await wfRepo.getStep(claimed.step.id);
    if (!step) throw new Error('step disappeared after execution');
    return step;
  }

  it(
    'P7.7 §4 — creates a REAL technical organization (read-back, idempotent adoption, persisted references/evidence, no business identities)',
    async () => {
      opsSeq += 1;
      const tenantId = randomUUID();

      // (2) Discover organization capability against the REAL admin API.
      const caps = await discoverUC.execute({
        actorId: ACTOR,
        serverId,
        correlationId: randomUUID(),
      });
      expect(caps.adminApiReachable).toBe(true);
      expect(caps.organizationsSupported).toBe(true);

      // (1) Shared-realm topology bound to a canonical P7.1 authorization.
      const { authRowId, requestId } = await seedAuthorization(tenantId);
      const topology = await createTopologyRow({
        tenantId,
        topologyType: KeycloakTopologyType.SHARED_REALM_ORGANIZATIONS,
        metadata: { resolvedRealmName: SHARED_REALM, resolvedOrgAlias: ORG_ALIAS },
        authRowId,
        authVersion: 1,
      });

      // (1) Create/prepare the shared realm through the P7.4 workflow engine.
      const wf1 = await launchProvisionWorkflow(topology.id, tenantId, requestId);
      expect((await runNextStep(wf1, ['keycloak.validate_plan'])).status).toBe('SUCCEEDED');
      expect((await runNextStep(wf1, ['keycloak.discover_capabilities'])).status).toBe('SUCCEEDED');
      expect((await runNextStep(wf1, ['keycloak.provision_realm'])).status).toBe('SUCCEEDED');
      const baselineRoles = await adminGet<Array<{ name: string }>>(
        `/admin/realms/${SHARED_REALM}/roles`,
      );

      // (3) Create the technical organization — REAL POST through the executor.
      const orgStep1 = await runNextStep(wf1, ['keycloak.provision_organization']);
      expect(orgStep1.status).toBe('SUCCEEDED');
      const created1 = orgStep1.outputSnapshot as { alias: string; externalOrganizationId: string };
      expect(created1.alias).toBe(ORG_ALIAS);
      expect(created1.externalOrganizationId).toBeTruthy();

      // (4-5) Read it back from the Admin API: external id + alias verified.
      const orgs = await adminGet<Array<{ id: string; alias: string; name: string }>>(
        `/admin/realms/${SHARED_REALM}/organizations`,
      );
      const mine = orgs.filter((o) => o.alias === ORG_ALIAS);
      expect(mine).toHaveLength(1);
      expect(mine[0]!.id).toBe(created1.externalOrganizationId);

      // (8) Internal reference + durable, redacted evidence persisted.
      const orgRow = await liveRepo.getOrganizationByTopology(topology.id);
      expect(orgRow).toBeTruthy();
      expect(orgRow!.externalOrganizationId).toBe(created1.externalOrganizationId);
      expect(orgRow!.orgAlias).toBe(ORG_ALIAS);
      const refs = await liveRepo.listResourceReferences(topology.id);
      const orgRef = refs.find((r) => r.resourceKind === 'ORGANIZATION');
      expect(orgRef?.externalId).toBe(created1.externalOrganizationId);
      expect(String(orgRef?.internalRef)).toBe(orgRow!.id);
      const evidence1 = await liveRepo.listEvidence(topology.id, 100);
      expect(
        evidence1.some((e) => e.operation === 'provision_organization' && e.outcome === 'SUCCEEDED'),
      ).toBe(true);
      expect(
        evidence1.some(
          (e) => e.operation.endsWith(':authorization_check') && e.outcome === 'SUCCEEDED',
        ),
      ).toBe(true);
      expect(
        evidence1.some(
          (e) =>
            (e.evidence as Record<string, unknown>).p71AuthorizationDecision === 'ALLOW',
        ),
      ).toBe(true);
      const evidenceJson = JSON.stringify(evidence1);
      expect(evidenceJson).not.toContain('edge-service-account-secret-1');
      expect(evidenceJson).not.toContain('EdgeAdminInitial123!');

      // (6-7) Retry the SAME operation → idempotent adoption, no duplicate org.
      const wf2 = await launchProvisionWorkflow(topology.id, tenantId, requestId);
      expect((await runNextStep(wf2, ['keycloak.validate_plan'])).status).toBe('SUCCEEDED');
      expect((await runNextStep(wf2, ['keycloak.discover_capabilities'])).status).toBe('SUCCEEDED');
      expect((await runNextStep(wf2, ['keycloak.provision_realm'])).status).toBe('SUCCEEDED');
      const orgStep2 = await runNextStep(wf2, ['keycloak.provision_organization']);
      expect(orgStep2.status).toBe('SUCCEEDED');
      const created2 = orgStep2.outputSnapshot as {
        alias: string;
        externalOrganizationId: string;
      };
      expect(created2.externalOrganizationId).toBe(created1.externalOrganizationId);
      const orgsAfterRetry = await adminGet<Array<{ alias: string }>>(
        `/admin/realms/${SHARED_REALM}/organizations`,
      );
      expect(orgsAfterRetry.filter((o) => o.alias === ORG_ALIAS)).toHaveLength(1);
      const evidenceAfterRetry = await liveRepo.listEvidence(topology.id, 200);
      expect(
        evidenceAfterRetry.some(
          (e) =>
            e.operation === 'provision_organization' &&
            (e.evidence as Record<string, unknown>).preexisting === true,
        ),
      ).toBe(true);

      // (10) No business users, memberships, roles or permissions created.
      const users = await adminGet<unknown[]>(`/admin/realms/${SHARED_REALM}/users?max=100`);
      expect(users).toHaveLength(0);
      const groups = await adminGet<unknown[]>(`/admin/realms/${SHARED_REALM}/groups`);
      expect(groups).toHaveLength(0);
      const members = await adminGet<unknown[]>(
        `/admin/realms/${SHARED_REALM}/organizations/${created1.externalOrganizationId}/members?max=100`,
      );
      expect(members).toHaveLength(0);
      const rolesAfter = await adminGet<Array<{ name: string }>>(
        `/admin/realms/${SHARED_REALM}/roles`,
      );
      const byName = (a: Array<{ name: string }>, b: Array<{ name: string }>) =>
        a.map((r) => r.name).sort().join(',') === b.map((r) => r.name).sort().join(',');
      expect(byName(rolesAfter, baselineRoles)).toBe(true);
      expect(rolesAfter.map((r) => r.name).sort()).toEqual(baselineRoles.map((r) => r.name).sort());

      orgCtx = {
        topologyId: topology.id,
        tenantId,
        requestId,
        externalOrgId: created1.externalOrganizationId,
      };
    },
    300_000,
  );

  it(
    'P7.7 §4 — safe recovery after a partial failure (external organization exists, internal state lost — adoption without duplication)',
    async () => {
      expect(orgCtx).toBeTruthy();
      // Fault injection: a prior attempt created the organization REMOTELY but
      // crashed before persisting the internal reference (partial failure).
      await pool.query(`DELETE FROM edge_p7_keycloak_organizations WHERE topology_id = $1`, [
        orgCtx.topologyId,
      ]);
      await pool.query(
        `UPDATE edge_p7_keycloak_topologies
           SET organization_ref = NULL, external_organization_id = NULL, version = version + 1
         WHERE id = $1`,
        [orgCtx.topologyId],
      );
      expect(await liveRepo.getOrganizationByTopology(orgCtx.topologyId)).toBeNull();
      const realmBefore = await liveRepo.getRealmByTopology(orgCtx.topologyId);

      const wf = await launchProvisionWorkflow(orgCtx.topologyId, orgCtx.tenantId, orgCtx.requestId);
      expect((await runNextStep(wf, ['keycloak.validate_plan'])).status).toBe('SUCCEEDED');
      expect((await runNextStep(wf, ['keycloak.discover_capabilities'])).status).toBe('SUCCEEDED');
      expect((await runNextStep(wf, ['keycloak.provision_realm'])).status).toBe('SUCCEEDED');
      const orgStep = await runNextStep(wf, ['keycloak.provision_organization']);
      expect(orgStep.status).toBe('SUCCEEDED');
      const out = orgStep.outputSnapshot as { externalOrganizationId: string };
      // Adopted the SAME external identity — never re-created.
      expect(out.externalOrganizationId).toBe(orgCtx.externalOrgId);

      const restored = await liveRepo.getOrganizationByTopology(orgCtx.topologyId);
      expect(restored?.externalOrganizationId).toBe(orgCtx.externalOrgId);
      expect(restored?.orgAlias).toBe(ORG_ALIAS);
      const orgs = await adminGet<Array<{ id: string; alias: string }>>(
        `/admin/realms/${SHARED_REALM}/organizations`,
      );
      expect(orgs.filter((o) => o.alias === ORG_ALIAS)).toHaveLength(1);
      const realmAfter = await liveRepo.getRealmByTopology(orgCtx.topologyId);
      expect(realmAfter?.externalRealmId).toBe(realmBefore?.externalRealmId);
      const evidence = await liveRepo.listEvidence(orgCtx.topologyId, 200);
      expect(
        evidence.some(
          (e) =>
            e.operation === 'provision_organization' &&
            (e.evidence as Record<string, unknown>).preexisting === true,
        ),
      ).toBe(true);
      expect(JSON.stringify(evidence)).not.toContain('edge-service-account-secret-1');
    },
    300_000,
  );

  it(
    'P7.7 §1 (live) — revocation between workflow steps blocks the organization mutation with ZERO provider calls (durable DENY evidence)',
    async () => {
      opsSeq += 1;
      const tenantId = randomUUID();
      const { authRowId, requestId } = await seedAuthorization(tenantId);
      const topology = await createTopologyRow({
        tenantId,
        topologyType: KeycloakTopologyType.SHARED_REALM_ORGANIZATIONS,
        metadata: { resolvedRealmName: DENY_REALM, resolvedOrgAlias: DENY_ALIAS },
        authRowId,
        authVersion: 1,
      });

      const wf = await launchProvisionWorkflow(topology.id, tenantId, requestId);
      expect((await runNextStep(wf, ['keycloak.validate_plan'])).status).toBe('SUCCEEDED');
      expect((await runNextStep(wf, ['keycloak.discover_capabilities'])).status).toBe('SUCCEEDED');
      expect((await runNextStep(wf, ['keycloak.provision_realm'])).status).toBe('SUCCEEDED');

      // Revocation lands BETWEEN two workflow steps.
      await pool.query(
        `UPDATE edge_provisioning_authorizations
            SET revocation_status = 'REVOKED',
                revocation_version = COALESCE(revocation_version, 0) + 1,
                revoked_at = NOW(), updated_at = NOW()
          WHERE id = $1`,
        [authRowId],
      );

      const before = providerSnapshot();
      const orgStep = await runNextStep(wf, ['keycloak.provision_organization']);
      expect(orgStep.status).toBe('FAILED');
      expect(orgStep.errorClass).toBe(KeycloakErrorCode.AUTHORIZATION_FAILED);
      // ZERO Keycloak calls of ANY kind — denied before touching the provider.
      const delta = providerDelta(before);
      expect(Object.values(delta).every((n) => n === 0)).toBe(true);
      expect(delta.createOrganization ?? 0).toBe(0);

      // Durable, redacted DENY decision + no organization created.
      // Precheck and mutation guards both record `*:authorization_check` evidence.
      const evidence = await liveRepo.listEvidence(topology.id, 200);
      const deny = evidence.find(
        (e) =>
          e.operation.includes('provision_organization') &&
          e.operation.endsWith(':authorization_check') &&
          e.outcome === 'FAILED',
      );
      expect(deny).toBeTruthy();
      const denyEvidence = deny?.evidence as Record<string, unknown>;
      expect(denyEvidence.p71AuthorizationDecision).toBe('DENY');
      expect(denyEvidence.p71AuthorizationReason).toBe('AUTHORIZATION_NOT_VALID');
      expect(denyEvidence.p71AuthorizationRowId).toBe(authRowId);
      expect(JSON.stringify(evidence)).not.toContain('edge-service-account-secret-1');
      expect(JSON.stringify(evidence)).not.toContain('EdgeAdminInitial123!');
      const orgs = await adminGet<Array<{ alias: string }>>(
        `/admin/realms/${DENY_REALM}/organizations`,
      );
      expect(orgs.filter((o) => o.alias === DENY_ALIAS)).toHaveLength(0);
      expect(await liveRepo.getOrganizationByTopology(topology.id)).toBeNull();
    },
    300_000,
  );

  it(
    'P7.7 §5 (live) — reconciliation: registered definition, drift detection, in-place remediation, idempotence and server-loss recovery (no blind recreation)',
    async () => {
      opsSeq += 1;
      const tenantId = randomUUID();
      const { authRowId, requestId } = await seedAuthorization(tenantId);
      const topology = await createTopologyRow({
        tenantId,
        topologyType: KeycloakTopologyType.DEDICATED_REALM,
        metadata: {
          resolvedRealmName: REC_REALM,
          realmSettings: {
            sslRequired: 'external',
            ssoSessionIdleTimeout: 1800,
            accessTokenLifespan: 300,
          },
        },
        authRowId,
        authVersion: 1,
      });

      // (1) Provision a REAL dedicated realm through the P7.4 workflow engine.
      const provWf = await launchProvisionWorkflow(topology.id, tenantId, requestId);
      expect((await runNextStep(provWf, ['keycloak.validate_plan'])).status).toBe('SUCCEEDED');
      expect((await runNextStep(provWf, ['keycloak.discover_capabilities'])).status).toBe('SUCCEEDED');
      expect((await runNextStep(provWf, ['keycloak.provision_realm'])).status).toBe('SUCCEEDED');

      // (§3 + §5.4) Reconciliation launched BY THE CONTROLLER on its OWN definition.
      const recWfId = await launchReconcileViaController(topology.id, requestId);
      expect(recWfId).toBeTruthy();
      const instanceRow = await pool.query<{ workflow_type: string; definition_id: string }>(
        `SELECT workflow_type, definition_id FROM edge_p7_workflow_instances WHERE id = $1`,
        [recWfId],
      );
      expect(instanceRow.rows[0]?.workflow_type).toBe('keycloak.topology.reconcile');
      expect(instanceRow.rows[0]?.definition_id).toBe(reconcileDefinitionId);

      // Registered definition in the DB: exactly validate_plan → reconcile_topology.
      const defRow = await pool.query<{ id: string; definition_status: string }>(
        `SELECT id, definition_status FROM edge_p7_workflow_definitions
          WHERE code = 'p77.keycloak.topology.reconcile'`,
      );
      expect(defRow.rows).toHaveLength(1);
      expect(defRow.rows[0]?.definition_status).toBe('PUBLISHED');
      const snapRow = await pool.query<{ snapshot: { steps: Array<{ handlerKey: string }> } }>(
        `SELECT snapshot FROM edge_p7_workflow_definition_versions
          WHERE definition_id = $1 ORDER BY version_number DESC LIMIT 1`,
        [defRow.rows[0]!.id],
      );
      const handlerKeys = (snapRow.rows[0]?.snapshot?.steps ?? []).map((s) => s.handlerKey);
      expect(handlerKeys).toEqual(['keycloak.validate_plan', 'keycloak.reconcile_topology']);

      // (2) Observed configuration read from the real server.
      const observedBefore = await adapter.realmExists(conn, REC_REALM);
      expect(observedBefore.exists).toBe(true);
      expect(observedBefore.externalId).toBeTruthy();
      expect(Number((observedBefore.settings ?? {}).ssoSessionIdleTimeout)).toBe(1800);

      // (3) Modify an ALLOWED setting externally (out-of-band drift).
      await adapter.updateRealmSettings(conn, REC_REALM, { ssoSessionIdleTimeout: 600 });
      const drifted = await adapter.realmExists(conn, REC_REALM);
      expect(Number(drifted.settings?.ssoSessionIdleTimeout)).toBe(600);

      // (4-5) Execute reconciliation → drift detected AND remediated in place.
      expect((await runNextStep(recWfId, ['keycloak.validate_plan'])).status).toBe('SUCCEEDED');
      const beforeRec = providerSnapshot();
      const recStep = await runNextStep(recWfId, ['keycloak.reconcile_topology']);
      expect(recStep.status).toBe('SUCCEEDED');
      const recOut = recStep.outputSnapshot as {
        driftDetected: boolean;
        remediated: boolean;
        settingsDrift: string[];
      };
      expect(recOut.driftDetected).toBe(true);
      expect(recOut.remediated).toBe(true);
      expect(recOut.settingsDrift).toContain('ssoSessionIdleTimeout');

      // (6) Resulting state — setting restored, SAME realm (no recreation).
      const remedied = await adapter.realmExists(conn, REC_REALM);
      expect(Number(remedied.settings?.ssoSessionIdleTimeout)).toBe(1800);
      expect(remedied.externalId).toBe(observedBefore.externalId);
      const realmRow = await liveRepo.getRealmByTopology(topology.id);
      expect(realmRow?.externalRealmId).toBe(observedBefore.externalId);

      // (7) Evidence + reconciliation history (durable, redacted).
      const runs = await liveRepo.listReconciliationRuns(topology.id, 20);
      const remediationRun = runs.find((r) => r.driftDetected && r.outcome === 'REMEDIATED');
      expect(remediationRun).toBeTruthy();
      expect(remediationRun?.driftClassification).toBe('CONFIGURATION');
      expect(remediationRun?.actionTaken).toBe('REMEDIATE_SETTINGS');
      const observedState = remediationRun?.observedState as Record<string, unknown>;
      const driftFields = observedState.settingsDrift as Array<{ field: string; observed: number }>;
      expect(driftFields.find((d) => d.field === 'ssoSessionIdleTimeout')?.observed).toBe(600);
      const evidence = await liveRepo.listEvidence(topology.id, 200);
      expect(
        evidence.some((e) => e.operation === 'reconcile' && e.outcome === 'SUCCEEDED'),
      ).toBe(true);
      expect(JSON.stringify({ evidence, runs })).not.toContain('edge-service-account-secret-1');
      expect(JSON.stringify({ evidence, runs })).not.toContain('EdgeAdminInitial123!');

      // (8) NO blind recreation or deletion during reconciliation.
      const deltaRec = providerDelta(beforeRec);
      expect(deltaRec.createRealm ?? 0).toBe(0);
      expect(deltaRec.createOrganization ?? 0).toBe(0);
      expect(deltaRec.createTechnicalClient ?? 0).toBe(0);
      expect(deltaRec.deleteRealm ?? 0).toBe(0);

      // (9) Repeat reconciliation → idempotent NO_DRIFT.
      const recWf2 = await launchReconcileViaController(topology.id, requestId);
      expect((await runNextStep(recWf2, ['keycloak.validate_plan'])).status).toBe('SUCCEEDED');
      const recStep2 = await runNextStep(recWf2, ['keycloak.reconcile_topology']);
      expect(recStep2.status).toBe('SUCCEEDED');
      expect((recStep2.outputSnapshot as { driftDetected: boolean }).driftDetected).toBe(false);
      const runs2 = await liveRepo.listReconciliationRuns(topology.id, 20);
      expect(runs2.some((r) => r.outcome === 'NO_DRIFT')).toBe(true);

      // (10) Server unavailability → fail closed, then recover.
      const runsBeforeOutage = runs2.length;
      await pool.query(
        `UPDATE edge_p7_keycloak_servers SET base_url = $1, version = version + 1 WHERE id = $2`,
        ['http://127.0.0.1:9', serverId],
      );
      const recWf3 = await launchReconcileViaController(topology.id, requestId);
      expect((await runNextStep(recWf3, ['keycloak.validate_plan'])).status).toBe('SUCCEEDED');
      const downStep = await runNextStep(recWf3, ['keycloak.reconcile_topology']);
      // Fail-closed: either permanent FAILED or scheduled RETRY_PENDING — never SUCCEEDED.
      expect(['FAILED', 'RETRY_PENDING']).toContain(downStep.status);
      expect(['TIMEOUT', 'DEPENDENCY_UNAVAILABLE', 'SERVER_UNAVAILABLE']).toContain(
        downStep.errorClass,
      );

      // Restore the server and recover (retry backoff is polled by runNextStep).
      await pool.query(
        `UPDATE edge_p7_keycloak_servers SET base_url = $1, version = version + 1 WHERE id = $2`,
        [baseUrl, serverId],
      );
      const recovered = await runNextStep(recWf3, ['keycloak.reconcile_topology']);
      expect(recovered.status).toBe('SUCCEEDED');
      expect((recovered.outputSnapshot as { driftDetected: boolean }).driftDetected).toBe(false);
      const runs3 = await liveRepo.listReconciliationRuns(topology.id, 20);
      expect(runs3.length).toBeGreaterThan(runsBeforeOutage);
      // The realm survived the outage untouched.
      const finalRealm = await adapter.realmExists(conn, REC_REALM);
      expect(finalRealm.exists).toBe(true);
      expect(finalRealm.externalId).toBe(observedBefore.externalId);
    },
    300_000,
  );
});

