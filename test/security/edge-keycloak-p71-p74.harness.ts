import { vi } from 'vitest';
import { createLiveKeycloakExecutor } from '../../src/modules/edge/infrastructure/keycloak/live-keycloak.executor.js';
import type { KeycloakRepositoryPort } from '../../src/modules/edge/domain/keycloak-topology/keycloak-repository.port.js';
import type {
  KeycloakAdminConnection,
  KeycloakProviderPort,
  KeycloakRealmObservation,
  KeycloakTopologyTarget,
} from '../../src/modules/edge/domain/keycloak-topology/keycloak-provider.port.js';
import {
  KeycloakTopologyStatus,
  KeycloakTopologyType,
} from '../../src/modules/edge/domain/keycloak-topology/keycloak.types.js';
import type {
  KeycloakRealmRecord,
  KeycloakServerRecord,
  KeycloakTopologyRecord,
} from '../../src/modules/edge/domain/keycloak-topology/keycloak.types.js';
import type { WorkflowReadyAuthorizationView } from '../../src/modules/edge/domain/workflow/workflow-authorization.port.js';
import {
  RepositoryWorkflowLeaseValidator,
  type WorkflowLeasePort,
} from '../../src/modules/edge/domain/workflow/workflow-lease.port.js';
import { WorkflowStepStatus, type WorkflowStepRecord } from '../../src/modules/edge/domain/workflow/workflow.types.js';
import type { WorkflowHandlerInput } from '../../src/modules/edge/domain/workflow/workflow-handler.port.js';
import type {
  DiscoverKeycloakCapabilitiesUseCase,
  CreateKeycloakTopologyUseCase,
} from '../../src/modules/edge/application/keycloak-topology/keycloak.use-cases.js';

/**
 * Shared harness for the P7.7 P0 remediation suite.
 * Repo/provider/authorization are RAW mock objects so tests can assert on
 * `mock.calls` (including "ZERO Keycloak mutations on denial").
 */

export const TENANT = '11111111-1111-4111-8111-111111111111';
export const PRODUCT = '22222222-2222-4222-8222-222222222222';
export const OTHER_TENANT = '99999999-9999-4999-8999-999999999999';
export const OTHER_PRODUCT = '88888888-8888-4888-8888-888888888888';
export const AUTH_ROW = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
export const REQUEST_ID = 'rrrrrrrr-rrrr-4rrr-8rrr-rrrrrrrrrrrr';
export const WORKFLOW_ID = 'wwwwwwww-wwww-4www-8www-wwwwwwwwwwww';
export const STEP_ID = 'ssssssss-ssss-4sss-8sss-ssssssssssss';
export const WORKER = 'worker-a';

export function authView(
  overrides: Partial<WorkflowReadyAuthorizationView> = {},
): WorkflowReadyAuthorizationView {
  return {
    requestId: REQUEST_ID,
    requestNumber: 'PR-0001',
    requestStatus: 'ACCEPTED',
    authorizationRowId: AUTH_ROW,
    authorizationId: 'auth-1',
    authorizationVersion: 1,
    accountId: 'acc-1',
    productId: PRODUCT,
    subscriptionId: 'sub-1',
    productTenantId: TENANT,
    correlationId: 'corr-1',
    expiresAt: new Date(Date.now() + 3_600_000),
    revocationStatus: 'NOT_REVOKED',
    verificationStatus: 'VERIFIED',
    decision: 'ALLOW',
    ...overrides,
  };
}

export function topologyRecord(
  overrides: Partial<KeycloakTopologyRecord> = {},
): KeycloakTopologyRecord {
  return {
    id: 'topo-1',
    tenantId: TENANT,
    productId: PRODUCT,
    subscriptionId: 'sub-1',
    authorizationId: AUTH_ROW,
    authorizationVersion: 1,
    placementDecisionId: null,
    deploymentProfileId: null,
    deploymentProfileVersion: null,
    runtimeProfileId: null,
    providerId: 'prov-1',
    serverId: 'server-1',
    topologyType: KeycloakTopologyType.DEDICATED_REALM,
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
    workflowId: WORKFLOW_ID,
    deletionProtection: false,
    metadata: { resolvedRealmName: 'okapi-t-test' },
    version: 3,
    createdBy: 'actor',
    updatedBy: 'actor',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function realmRecord(
  overrides: Partial<KeycloakRealmRecord> = {},
): KeycloakRealmRecord {
  return {
    id: 'realm-1',
    topologyId: 'topo-1',
    tenantId: TENANT,
    realmName: 'okapi-t-test',
    externalRealmId: 'ext-realm',
    managedByEdge: true,
    sslRequired: 'external',
    ssoSessionIdleSeconds: 1800,
    ssoSessionMaxSeconds: 36000,
    accessTokenLifespanSeconds: 300,
    passwordPolicy: null,
    revokeRefreshToken: true,
    refreshTokenMaxReuse: 0,
    desiredFingerprint: null,
    appliedFingerprint: null,
    status: 'READY',
    workflowId: WORKFLOW_ID,
    evidence: {},
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function stepRecord(overrides: Partial<WorkflowStepRecord> = {}): WorkflowStepRecord {
  return {
    id: STEP_ID,
    workflowId: WORKFLOW_ID,
    stepKey: 'topology_provision',
    stepType: 'HANDLER',
    handlerKey: 'keycloak.provision_realm',
    dependsOn: [],
    inputSnapshot: {},
    outputSnapshot: {},
    status: WorkflowStepStatus.RUNNING,
    attemptCount: 1,
    maxAttempts: 3,
    idempotencyKey: 'idem-1',
    ownerWorkerId: WORKER,
    leaseExpiresAt: new Date(Date.now() + 60_000),
    fencingToken: 1,
    startedAt: new Date(),
    finishedAt: null,
    timeoutAt: null,
    errorClass: null,
    nextRetryAt: null,
    compensationHandlerKey: null,
    executionOrder: 0,
    version: 5,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function handlerInput(overrides: Partial<WorkflowHandlerInput> = {}): WorkflowHandlerInput {
  return {
    workflowId: WORKFLOW_ID,
    stepId: STEP_ID,
    stepKey: 'topology_provision',
    handlerKey: 'keycloak.provision_realm',
    fencingToken: 1,
    attemptNumber: 1,
    inputSnapshot: {},
    workflowInput: {
      topologyId: 'topo-1',
      tenantId: TENANT,
      productId: PRODUCT,
      actorId: 'actor',
      serverId: 'server-1',
      provisioningRequestId: REQUEST_ID,
    },
    correlationId: 'corr-1',
    workerId: WORKER,
    ...overrides,
  };
}

export type AuthBehavior =
  | { mode: 'valid'; view?: WorkflowReadyAuthorizationView }
  | { mode: 'null' }
  | { mode: 'reject'; message?: string }
  | { mode: 'hang' };

export function harness(options?: {
  auth?: AuthBehavior;
  authorizationId?: string | null;
  authorizationVersion?: number | null;
  topology?: Partial<KeycloakTopologyRecord>;
  step?: Partial<WorkflowStepRecord>;
  lease?: WorkflowLeasePort;
}) {
  const authBehavior: AuthBehavior = options?.auth ?? { mode: 'valid' };
  const step = stepRecord(options?.step);
  const stepStore = new Map<string, WorkflowStepRecord>([[STEP_ID, step]]);

  const evidence: Array<{ operation: string; outcome: string; evidence: Record<string, unknown> }> =
    [];
  const topologyWrites: Array<Record<string, unknown>> = [];

  const repo = {
    getTopology: vi.fn(async () =>
      topologyRecord({
        authorizationId: options?.authorizationId === undefined ? AUTH_ROW : options.authorizationId,
        authorizationVersion:
          options?.authorizationVersion === undefined ? 1 : options.authorizationVersion,
        ...(options?.topology ?? {}),
      }),
    ),
    getRealmByTopology: vi.fn(async () => realmRecord()),
    getOrganizationByTopology: vi.fn(async () => null),
    getCapabilities: vi.fn(async () => ({
      id: 'cap-1',
      serverId: 'server-1',
      keycloakVersion: '26.0.7',
      features: {},
      organizationsSupported: true,
      realmsSupported: true,
      adminApiReachable: true,
      discoverySource: 'SERVERINFO',
      rawEvidence: {},
      verifiedAt: new Date(),
      createdAt: new Date(),
    })),
    getServerById: vi.fn(async () =>
      ({
        id: 'server-1',
        providerId: 'prov-1',
        code: 'kc-1',
        name: 'KC',
        baseUrl: 'https://kc.example',
        adminRealm: 'master',
        adminClientId: 'edge-admin',
        adminCredentialRef: 'sec_admin',
        tlsMode: 'REQUIRED',
        allowPrivateNetwork: false,
        environment: 'TEST',
        operationalStatus: 'ACTIVE',
        discoveredVersion: '26.0.7',
        lastConnectivityStatus: 'OK',
        lastConnectivityAt: new Date(),
        metadata: {},
        version: 1,
        createdBy: 'a',
        updatedBy: 'a',
        createdAt: new Date(),
        updatedAt: new Date(),
      }) as unknown as KeycloakServerRecord,
    ),
    updateTopology: vi.fn(async (_id: string, patch: Record<string, unknown>) => {
      topologyWrites.push(patch);
      return topologyRecord(patch);
    }),
    createEvidence: vi.fn(
      async (input: { operation: string; outcome: string; evidence: Record<string, unknown> }) => {
        evidence.push({
          operation: input.operation,
          outcome: input.outcome,
          evidence: input.evidence,
        });
        return { id: 'ev-1', ...input, performedAt: new Date() };
      },
    ),
    createRealm: vi.fn(async (input: Record<string, unknown>) => realmRecord({ ...input })),
    createOrganization: vi.fn(async (input: Record<string, unknown>) => ({
      id: 'org-1',
      ...input,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
    createResourceReference: vi.fn(async () => ({ id: 'ref-1' })),
    listClients: vi.fn(async () => []),
    getOidcConfiguration: vi.fn(async () => null),
    createReconciliationRun: vi.fn(async (input: Record<string, unknown>) => ({
      id: 'run-1',
      ...input,
      startedAt: new Date(),
      completedAt: null,
    })),
    completeReconciliationRun: vi.fn(async (id: string, patch: Record<string, unknown>) => ({
      id,
      ...patch,
    })),
    listReconciliationRuns: vi.fn(async () => []),
    appendHistory: vi.fn(async () => undefined),
  };

  const provider = {
    providerCode: 'keycloak-managed-v1',
    discoverCapabilities: vi.fn(async () => ({})),
    realmExists: vi.fn(
      async (): Promise<KeycloakRealmObservation> => ({
        exists: true,
        realmName: 'okapi-t-test',
        externalId: 'ext-realm',
        fingerprint: 'fp-1',
        settings: {} as Record<string, unknown>,
      }),
    ),
    createRealm: vi.fn(
      async (
        _conn: KeycloakAdminConnection,
        _target: KeycloakTopologyTarget,
      ): Promise<{
        exists: boolean;
        realmName: string;
        externalId: string | null;
        fingerprint: string | null;
      }> => ({
        exists: false,
        realmName: 'okapi-t-test',
        externalId: 'ext-realm',
        fingerprint: 'fp-1',
      }),
    ),
    updateRealmSettings: vi.fn(async () => undefined),
    organizationExists: vi.fn(async () => ({ exists: false, externalId: null, alias: 'x' })),
    createOrganization: vi.fn(async () => ({ exists: true, externalId: 'ext-org', alias: 'x' })),
    clientExists: vi.fn(async () => ({
      exists: true,
      clientId: 'c',
      externalId: 'e',
      redirectUris: [],
      serviceAccountEnabled: false,
    })),
    createTechnicalClient: vi.fn(async () => ({
      externalId: 'ext-client',
      observation: {
        exists: false,
        clientId: 'c',
        externalId: 'ext-client',
        redirectUris: [],
        serviceAccountEnabled: false,
      },
    })),
    getOpenidConfiguration: vi.fn(async () => ({
      issuer: 'https://kc.example/realms/okapi-t-test',
      token_endpoint: 'https://kc.example/realms/okapi-t-test/protocol/openid-connect/token',
      jwks_uri: 'https://kc.example/realms/okapi-t-test/protocol/openid-connect/certs',
    })),
    health: vi.fn(async () => ({ ok: true, latencyMs: 1, details: {} })),
  };

  const authorization = {
    getWorkflowReadyRequest: vi.fn(async () => authView()),
    isAuthorizationStillValid: vi.fn(async () => authBehavior.mode === 'valid'),
    revalidateBoundAuthorization: vi.fn(async (): Promise<WorkflowReadyAuthorizationView | null> => {
      switch (authBehavior.mode) {
        case 'valid':
          return authBehavior.view ?? authView();
        case 'null':
          return null;
        case 'reject':
          throw new Error(authBehavior.message ?? 'P7.1 service down');
        case 'hang':
          return new Promise<WorkflowReadyAuthorizationView>(() => undefined);
      }
    }),
  };

  const lease: WorkflowLeasePort =
    options?.lease ??
    new RepositoryWorkflowLeaseValidator(async (id) => stepStore.get(id) ?? null);

  const executor = createLiveKeycloakExecutor({
    repo: repo as unknown as KeycloakRepositoryPort,
    provider: provider as unknown as KeycloakProviderPort,
    secrets: {
      put: vi.fn(async () => ({ credentialRef: 'sec_x' })),
      get: vi.fn(async () => ({ value: 'v' })),
      describe: vi.fn(async () => ({})),
      exists: vi.fn(async () => true),
      revoke: vi.fn(async () => undefined),
    } as never,
    discoverCapabilities: {
      execute: vi.fn(async () => ({})),
    } as unknown as DiscoverKeycloakCapabilitiesUseCase,
    createTopology: {
      execute: vi.fn(async () => ({})),
    } as unknown as CreateKeycloakTopologyUseCase,
    authorization,
    lease,
  });

  const mutationCalls = () =>
    provider.createRealm.mock.calls.length +
    provider.createOrganization.mock.calls.length +
    provider.createTechnicalClient.mock.calls.length +
    provider.updateRealmSettings.mock.calls.length;

  return {
    executor,
    repo,
    provider,
    authorization,
    evidence,
    topologyWrites,
    stepStore,
    step,
    mutationCalls,
  };
}
