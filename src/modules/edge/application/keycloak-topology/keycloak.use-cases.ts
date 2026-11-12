import { randomUUID } from 'node:crypto';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import type { ControlPlaneOutboxTransactionService } from '../../../../shared/messaging/control-plane-outbox-transaction.service.js';
import type { AuditEventRepositoryPort } from '../../domain/ports/audit-event-repository.port.js';
import { EDGE_P7_OUTBOX_TENANT } from '../../domain/provisioning/provisioning.events.js';
import {
  assertTopologyTransition,
  assertReadyRequiresVerification,
} from '../../domain/keycloak-topology/keycloak-state-machine.js';
import {
  computePlanFingerprint,
  validateResourcePlan,
} from '../../domain/keycloak-topology/keycloak-plan.js';
import type {
  KeycloakAdminConnection,
  KeycloakProviderPort,
} from '../../domain/keycloak-topology/keycloak-provider.port.js';
import type {
  KeycloakRepositoryPort,
  KeycloakTopologyListFilter,
} from '../../domain/keycloak-topology/keycloak-repository.port.js';
import {
  createKeycloakDriftDetectedEvent,
  createKeycloakProvisioningFailedEvent,
  createKeycloakQuarantineEvent,
  createKeycloakTopologyProvisionedEvent,
  createKeycloakTopologyReadyEvent,
  createKeycloakTopologyRequestedEvent,
} from '../../domain/keycloak-topology/keycloak.events.js';
import {
  KeycloakClientKind,
  KeycloakErrorCode,
  KeycloakOperationalStatus,
  KeycloakTopologyStatus,
  KeycloakTopologyType,
  type KeycloakPlanValidationResult,
  type KeycloakPlanInput,
} from '../../domain/keycloak-topology/keycloak.types.js';
import type { KeycloakPlanValidationContext } from '../../domain/keycloak-topology/keycloak-validation-context.js';
import type { WorkflowAuthorizationPort } from '../../domain/workflow/workflow-authorization.port.js';
import type { WorkflowPlacementPort } from '../../domain/workflow/workflow-placement.port.js';
import type { WorkflowRepositoryPort } from '../../domain/workflow/workflow-repository.port.js';
import {
  WorkflowDefinitionStatus,
  WorkflowInstanceState,
  WorkflowHistoryResourceType,
  WorkflowStepStatus,
} from '../../domain/workflow/workflow.types.js';
import { validateDefinition } from '../../domain/workflow/workflow-definition.js';
import { orderSteps } from '../../domain/workflow/saga-coordinator.js';
import type { SecretsProviderPort } from '../../domain/infrastructure-provisioning/secrets-provider.port.js';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

async function requireAudit(
  audit: AuditEventRepositoryPort,
  input: {
    eventType: string;
    actorId: string;
    subjectType: string;
    subjectId: string;
    details: Record<string, unknown>;
  },
  client: unknown,
): Promise<void> {
  try {
    await audit.create(input, client);
  } catch (err) {
    throw new DomainError(
      ErrorCode.DEPENDENCY_UNAVAILABLE,
      'Durable audit required for Keycloak topology mutation',
      [{ eventType: input.eventType }],
      err instanceof Error ? err : undefined,
    );
  }
}

function enqueue(
  enqueueFn: (event: unknown) => Promise<string>,
  event: unknown,
): Promise<string> {
  return enqueueFn(event);
}

/** Strip any accidental secret-bearing fields before persistence / API output. */
export function redactSecrets<T>(value: T): T {
  const secretKeys = ['secret', 'clientSecret', 'client_secret', 'password', 'credential', 'token', 'adminCredentialRef'];
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, raw] of Object.entries(v as Record<string, unknown>)) {
        if (secretKeys.some((s) => k.toLowerCase().includes(s.toLowerCase()))) {
          out[k] = raw == null || raw === '' ? raw : '**********';
        } else {
          out[k] = walk(raw);
        }
      }
      return out;
    }
    return v;
  };
  return walk(value) as T;
}

/**
 * Revalidate the bound P7.1 authorization at every protected boundary.
 * P7.4 workflow authorization is authoritative when the workflow carries rows;
 * otherwise the caller must provide the original ids (fail-closed when absent).
 */
async function revalidateAuthorization(
  auth: WorkflowAuthorizationPort,
  params: {
    workflowId: string;
    authorizationId?: string | null;
    authorizationVersion?: number | null;
    provisioningRequestId?: string | null;
  },
): Promise<{ ok: boolean; reason: string }> {
  const wfAuthView =
    params.workflowId && params.authorizationId
      ? await auth.revalidateBoundAuthorization({
          authorizationRowId: params.authorizationId,
          authorizationVersion: params.authorizationVersion ?? 1,
          provisioningRequestId: params.provisioningRequestId ?? null,
        })
      : null;

  if (!wfAuthView && params.provisioningRequestId) {
    // Fail-closed: request exists but not workflow-ready (revoked/expired).
    return { ok: false, reason: 'AUTHORIZATION_REVOKED' };
  }
  if (!wfAuthView && !params.authorizationId) {
    return { ok: false, reason: 'AUTHORIZATION_MISSING' };
  }
  return { ok: Boolean(wfAuthView), reason: wfAuthView ? 'OK' : 'AUTHORIZATION_INVALID' };
}

// ---------------------------------------------------------------------------
// Reads (query side)
// ---------------------------------------------------------------------------

export class ListKeycloakUseCase {
  constructor(private readonly repo: KeycloakRepositoryPort) {}

  providers() {
    return this.repo.listProviders();
  }
  provider(id: string) {
    return this.repo.getProviderById(id);
  }
  servers() {
    return this.repo.listServers();
  }
  server(id: string) {
    return this.repo.getServerById(id);
  }
  capabilities(serverId: string) {
    return this.repo.getCapabilities(serverId);
  }
  topologies(filter: KeycloakTopologyListFilter) {
    return this.repo.listTopologies(filter);
  }
  topology(id: string) {
    return this.repo.getTopology(id);
  }
  realms(topologyId: string) {
    return this.repo.getRealmByTopology(topologyId);
  }
  organizations(topologyId: string) {
    return this.repo.getOrganizationByTopology(topologyId);
  }
  clients(topologyId: string) {
    return this.repo.listClients(topologyId);
  }
  oidc(topologyId: string) {
    return this.repo.getOidcConfiguration(topologyId);
  }
  references(topologyId: string) {
    return this.repo.listResourceReferences(topologyId);
  }
  health(topologyId: string, serverId: string | null, limit: number) {
    return this.repo.listHealthChecks(topologyId, serverId, limit);
  }
  reconciliations(topologyId: string, limit: number) {
    return this.repo.listReconciliationRuns(topologyId, limit);
  }
  history(resourceType: string, resourceId: string, limit: number) {
    return this.repo.listHistory(resourceType, resourceId, limit);
  }
  evidence(topologyId: string, limit: number) {
    return this.repo.listEvidence(topologyId, limit);
  }
}

// ---------------------------------------------------------------------------
// Provider / server management (operator registrations, audited)
// ---------------------------------------------------------------------------

export class RegisterKeycloakServerUseCase {
  constructor(
    private readonly repo: KeycloakRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
    private readonly secrets?: SecretsProviderPort,
  ) {}

  async execute(input: {
    actorId: string;
    correlationId: string;
    providerId: string;
    code: string;
    name: string;
    baseUrl: string;
    adminRealm?: string;
    adminClientId: string;
    /** Plaintext service-account secret — stored ONLY in the external vault. */
    adminCredential?: string | null;
    credentialRef?: string | null;
    tlsMode?: string;
    allowPrivateNetwork?: boolean;
    environment?: string;
    metadata?: Record<string, unknown>;
  }) {
    const provider = await this.repo.getProviderById(input.providerId);
    if (!provider) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Keycloak provider not found', [
        { code: KeycloakErrorCode.PROVIDER_UNAVAILABLE },
      ]);
    }
    if (provider.operationalStatus !== KeycloakOperationalStatus.ACTIVE) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Provider is not ACTIVE', [
        { code: KeycloakErrorCode.PROVIDER_UNAVAILABLE },
      ]);
    }
    const url = input.baseUrl.trim().replace(/\/$/, '');
    if (!/^https?:\/\//i.test(url)) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'baseUrl must be http(s) URL', [
        { code: KeycloakErrorCode.VALIDATION },
      ]);
    }
    if (url.startsWith('http://') && (input.allowPrivateNetwork !== true || url.includes('localhost') || url.includes('127.0.0.1') === false ? url.startsWith('http://') : true)) {
      // Plain http allowed ONLY for explicit non-production loopback lab servers.
      const isLoopback = /^http:\/\/(localhost|127\.0\.0\.1|::1)(:\d+)?(\/|$)/i.test(url);
      if (!isLoopback) {
        throw new DomainError(
          ErrorCode.VALIDATION_ERROR,
          'Non-loopback Keycloak servers must use TLS (https)',
          [{ code: KeycloakErrorCode.VALIDATION, field: 'baseUrl' }],
        );
      }
      if (input.environment === 'PRODUCTION') {
        throw new DomainError(
          ErrorCode.VALIDATION_ERROR,
          'Production Keycloak servers must use TLS',
          [{ code: KeycloakErrorCode.VALIDATION, field: 'baseUrl' }],
        );
      }
    }

    // Secret goes to the external vault; PostgreSQL only ever stores the ref.
    let credentialRef = input.credentialRef ?? null;
    if (!credentialRef && input.adminCredential) {
      if (this.secrets) {
        const stored = await this.secrets.put({ kind: 'keycloak-admin-service-account', material: { value: input.adminCredential } });
        credentialRef = stored.credentialRef;
      } else {
        throw new DomainError(
          ErrorCode.DEPENDENCY_UNAVAILABLE,
          'Secrets vault unavailable — refusing to store credentials without external vault',
          [{ code: KeycloakErrorCode.VALIDATION }],
        );
      }
    }
    if (!credentialRef) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'credentialRef or adminCredential required', [
        { code: KeycloakErrorCode.VALIDATION, field: 'credentialRef' },
      ]);
    }

    return this.outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client, enqueueEvt) => {
      const created = await this.repo.createServer(
        {
          id: randomUUID(),
          providerId: input.providerId,
          code: input.code.trim().toLowerCase(),
          name: input.name.trim(),
          baseUrl: url,
          adminRealm: (input.adminRealm ?? 'master').trim(),
          adminClientId: input.adminClientId.trim(),
          adminCredentialRef: credentialRef,
          tlsMode: input.tlsMode ?? (url.startsWith('https://') ? 'REQUIRED' : 'REQUIRED'),
          allowPrivateNetwork: input.allowPrivateNetwork ?? false,
          environment: input.environment ?? 'TEST',
          operationalStatus: KeycloakOperationalStatus.ACTIVE,
          discoveredVersion: null,
          lastConnectivityStatus: null,
          lastConnectivityAt: null,
          metadata: input.metadata ?? {},
          createdBy: input.actorId,
          updatedBy: input.actorId,
        },
        input.actorId,
        client,
      );
      await this.repo.appendHistory(
        {
          resourceType: 'KEYCLOAK_SERVER',
          resourceId: created.id,
          topologyId: null,
          workflowId: null,
          fromStatus: null,
          toStatus: null,
          action: 'REGISTER',
          reason: null,
          actorId: input.actorId,
          details: { code: created.code, baseUrl: created.baseUrl },
        },
        client,
      );
      await requireAudit(
        this.audit,
        {
          eventType: 'p7.keycloak.server.registered',
          actorId: input.actorId,
          subjectType: 'KEYCLOAK_SERVER',
          subjectId: created.id,
          details: { code: created.code, credentialRef: '**********' },
        },
        client,
      );
      await enqueueEvt(
        createKeycloakTopologyRequestedEvent(
          created.id,
          '00000000-0000-0000-0000-000000000000',
          '00000000-0000-0000-0000-000000000000',
          'SERVER_REGISTERED',
          input.correlationId,
          input.actorId,
        ),
      );
      return created;
    });
  }
}

// ---------------------------------------------------------------------------
// Capabilities discovery (real Keycloak probe, persisted)
// ---------------------------------------------------------------------------

export class DiscoverKeycloakCapabilitiesUseCase {
  constructor(
    private readonly repo: KeycloakRepositoryPort,
    private readonly provider: KeycloakProviderPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: { actorId: string; serverId: string; correlationId: string }) {
    const server = await this.repo.getServerById(input.serverId);
    if (!server) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Keycloak server not found', [
        { code: KeycloakErrorCode.SERVER_UNAVAILABLE },
      ]);
    }
    if (!server.adminCredentialRef) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Server has no credential reference', [
        { code: KeycloakErrorCode.VALIDATION },
      ]);
    }
    const connection: KeycloakAdminConnection = {
      baseUrl: server.baseUrl,
      adminRealm: server.adminRealm,
      adminClientId: server.adminClientId,
      adminCredentialRef: server.adminCredentialRef,
      tlsMode: server.tlsMode === 'REQUIRED' ? 'REQUIRED' : 'OPTIONAL_INSECURE_LOCAL',
      allowPrivateNetwork: server.allowPrivateNetwork,
    };

    const started = Date.now();
    let capabilities;
    try {
      capabilities = await this.provider.discoverCapabilities(connection);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client) => {
        await this.repo.createHealthCheck(
          {
            topologyId: null,
            serverId: server.id,
            checkType: 'CAPABILITY_DISCOVERY',
            outcome: 'UNHEALTHY',
            latencyMs: Date.now() - started,
            details: { error: message },
            checkedAt: new Date(),
          },
          client,
        );
        await this.repo.updateServer(
          server.id,
          { operationalStatus: KeycloakOperationalStatus.UNAVAILABLE, lastConnectivityStatus: 'FAILED', lastConnectivityAt: new Date() },
          server.version,
          input.actorId,
          client,
        );
      });
      throw new DomainError(ErrorCode.DEPENDENCY_UNAVAILABLE, `Keycloak capability discovery failed: ${message}`, [
        { code: KeycloakErrorCode.SERVER_UNAVAILABLE },
      ]);
    }

    return this.outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client) => {
      await this.repo.upsertCapabilities(
        {
          serverId: server.id,
          keycloakVersion: capabilities.keycloakVersion,
          features: capabilities.features,
          organizationsSupported: capabilities.organizationsSupported,
          realmsSupported: capabilities.realmsSupported,
          adminApiReachable: capabilities.adminApiReachable,
          discoverySource: capabilities.discoverySource,
          rawEvidence: capabilities.rawEvidence ?? {},
          verifiedAt: new Date(capabilities.verifiedAt),
        },
        client,
      );
      await this.repo.updateServer(
        server.id,
        {
          operationalStatus: KeycloakOperationalStatus.ACTIVE,
          discoveredVersion: capabilities.keycloakVersion,
          lastConnectivityStatus: 'OK',
          lastConnectivityAt: new Date(),
        },
        server.version,
        input.actorId,
        client,
      );
      await this.repo.createHealthCheck(
        {
          topologyId: null,
          serverId: server.id,
          checkType: 'CAPABILITY_DISCOVERY',
          outcome: capabilities.adminApiReachable ? 'HEALTHY' : 'DEGRADED',
          latencyMs: Date.now() - started,
          details: {
            keycloakVersion: capabilities.keycloakVersion,
            organizationsSupported: capabilities.organizationsSupported,
          },
          checkedAt: new Date(),
        },
        client,
      );
      await this.repo.appendHistory(
        {
          resourceType: 'KEYCLOAK_SERVER',
          resourceId: server.id,
          topologyId: null,
          workflowId: null,
          fromStatus: null,
          toStatus: null,
          action: 'DISCOVER_CAPABILITIES',
          reason: null,
          actorId: input.actorId,
          details: {
            keycloakVersion: capabilities.keycloakVersion,
            organizationsSupported: capabilities.organizationsSupported,
          },
        },
        client,
      );
      await requireAudit(
        this.audit,
        {
          eventType: 'p7.keycloak.capabilities.discovered',
          actorId: input.actorId,
          subjectType: 'KEYCLOAK_SERVER',
          subjectId: server.id,
          details: {
            keycloakVersion: capabilities.keycloakVersion,
            organizationsSupported: capabilities.organizationsSupported,
          },
        },
        client,
      );
      return capabilities;
    });
  }
}

// ---------------------------------------------------------------------------
// Topology plan + creation (P7.1 / P7.2 / P7.3 / P7.6 gates)
// ---------------------------------------------------------------------------

export class CreateKeycloakTopologyUseCase {
  constructor(
    private readonly repo: KeycloakRepositoryPort,
    private readonly auth: WorkflowAuthorizationPort,
    private readonly placement: WorkflowPlacementPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(
    input: KeycloakPlanInput & {
      actorId: string;
      correlationId: string;
      provisioningRequestId?: string | null;
      validationContext: KeycloakPlanValidationContext;
    },
  ) {
    const provider = await this.repo.getProviderById(input.providerId);
    if (!provider) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Keycloak provider not found', [
        { code: KeycloakErrorCode.PROVIDER_UNAVAILABLE },
      ]);
    }
    const server = await this.repo.getServerById(input.serverId);
    if (!server) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Keycloak server not found', [
        { code: KeycloakErrorCode.SERVER_UNAVAILABLE },
      ]);
    }

    // P7.1 revalidation (fail-closed) when bound to a provisioning request.
    if (input.provisioningRequestId || (input.authorizationId && input.authorizationVersion)) {
      const revalidated = await revalidateAuthorization(this.auth, {
        workflowId: '',
        authorizationId: input.authorizationId,
        authorizationVersion: input.authorizationVersion,
        provisioningRequestId: input.provisioningRequestId,
      });
      if (!revalidated.ok) {
        throw new DomainError(ErrorCode.FORBIDDEN, `P7.1 authorization not valid: ${revalidated.reason}`, [
          { code: KeycloakErrorCode.AUTHORIZATION_FAILED, reason: revalidated.reason },
        ]);
      }
    }
    // P7.3 placement (fail-closed) when a decision was provided.
    if (input.placementDecisionId) {
      const place = await this.placement.getWorkflowReadyPlacement(input.placementDecisionId);
      if (!place) {
        throw new DomainError(ErrorCode.FORBIDDEN, 'Placement decision not workflow-ready', [
          { code: KeycloakErrorCode.PLACEMENT_INVALID },
        ]);
      }
    }

    const providerSupportsTopology =
      Array.isArray(provider.supportedTopologyTypes) &&
      provider.supportedTopologyTypes.includes(String(input.topologyType));
    const ctx = {
      providerActive: provider.operationalStatus === KeycloakOperationalStatus.ACTIVE,
      providerSupportsTopology,
      serverActive: server.operationalStatus === KeycloakOperationalStatus.ACTIVE,
      serverReachable: server.lastConnectivityStatus !== 'FAILED',
      tlsRequiredByProfile: input.validationContext.tlsRequiredByProfile,
      tlsModeOnServer: server.tlsMode,
      privateNetworkAllowed: server.allowPrivateNetwork,
      authorizationValid: input.validationContext.authorizationValid,
      authorizationExpired: input.validationContext.authorizationExpired,
      authorizationRevoked: input.validationContext.authorizationRevoked,
      placementValid: input.validationContext.placementValid,
      organizationsSupportedByServer: input.validationContext.organizationsSupportedByServer,
      profileOptions: input.profileOptions ?? {},
    };
    const validation: KeycloakPlanValidationResult = validateResourcePlan(input, ctx);
    const fingerprint = computePlanFingerprint(input);

    // Collision check: one active topology per tenant+product+server.
    const existing = await this.repo.getActiveTopologyByKey(
      input.tenantId,
      input.productId,
      input.serverId,
    );
    if (existing) {
      throw new DomainError(
        ErrorCode.CONFLICT,
        `Active Keycloak topology already exists for tenant/product/server (${existing.id})`,
        [{ code: KeycloakErrorCode.TOPOLOGY_COLLISION, topologyId: existing.id }],
      );
    }

    return this.outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client, enqueueEvt) => {
      const topology = await this.repo.createTopology(
        {
          id: randomUUID(),
          tenantId: input.tenantId,
          productId: input.productId,
          subscriptionId: input.subscriptionId ?? null,
          authorizationId: input.authorizationId ?? null,
          authorizationVersion: input.authorizationVersion ?? null,
          placementDecisionId: input.placementDecisionId ?? null,
          deploymentProfileId: input.deploymentProfileId ?? null,
          deploymentProfileVersion: input.deploymentProfileVersion ?? null,
          runtimeProfileId: input.runtimeProfileId ?? null,
          providerId: input.providerId,
          serverId: input.serverId,
          topologyType: input.topologyType,
          realmRef: null,
          organizationRef: null,
          oidcConfigurationRef: null,
          externalRealmId: null,
          externalOrganizationId: null,
          keycloakVersion: null,
          desiredConfigVersion: 1,
          appliedConfigVersion: null,
          resourceFingerprint: fingerprint,
          status: validation.valid ? KeycloakTopologyStatus.PLANNED : KeycloakTopologyStatus.FAILED,
          statusReason: validation.valid
            ? null
            : validation.issues.map((i) => i.message).join('; '),
          lastHealthCheckAt: null,
          lastReconciliationAt: null,
          workflowId: null,
          deletionProtection: true,
          metadata: {
            ...(input.metadata ?? {}),
            resolvedRealmName: validation.resolvedRealmName,
            resolvedOrgAlias: validation.resolvedOrgAlias,
            profileOptions: redactSecrets(input.profileOptions ?? {}),
          },
          createdBy: input.actorId,
          updatedBy: input.actorId,
        },
        client,
      );

      await this.repo.insertTopologyVersion(
        {
          topologyId: topology.id,
          versionNumber: 1,
          fingerprint,
          snapshot: redactSecrets({
            tenantId: input.tenantId,
            productId: input.productId,
            topologyType: input.topologyType,
            resolvedRealmName: validation.resolvedRealmName,
            resolvedOrgAlias: validation.resolvedOrgAlias,
            providerId: input.providerId,
            serverId: input.serverId,
            profileOptions: input.profileOptions ?? {},
          }),
          validationStatus: validation.valid ? 'VALID' : 'INVALID',
          validationErrors: validation.issues.map((i) => ({
            code: i.code,
            message: i.message,
            field: i.field ?? null,
          })),
          createdBy: input.actorId,
        },
        client,
      );

      await this.repo.appendHistory(
        {
          resourceType: 'KEYCLOAK_TOPOLOGY',
          resourceId: topology.id,
          topologyId: topology.id,
          workflowId: null,
          fromStatus: null,
          toStatus: topology.status,
          action: 'CREATE',
          reason: validation.valid ? null : 'PLAN_INVALID',
          actorId: input.actorId,
          details: { fingerprint, topologyType: input.topologyType },
        },
        client,
      );
      await requireAudit(
        this.audit,
        {
          eventType: 'p7.keycloak.topology.created',
          actorId: input.actorId,
          subjectType: 'KEYCLOAK_TOPOLOGY',
          subjectId: topology.id,
          details: {
            tenantId: input.tenantId,
            productId: input.productId,
            topologyType: input.topologyType,
            valid: validation.valid,
          },
        },
        client,
      );
      await enqueueEvt(
        createKeycloakTopologyRequestedEvent(
          topology.id,
          input.tenantId,
          input.productId,
          String(input.topologyType),
          input.correlationId,
          input.actorId,
        ),
      );
      if (!validation.valid) {
        throw new DomainError(
          ErrorCode.VALIDATION_ERROR,
          `Keycloak topology validation failed: ${validation.issues.map((i) => i.message).join('; ')}`,
          validation.issues.map((i) => ({ code: i.code, message: i.message, field: i.field ?? null })),
        );
      }
      return topology;
    });
  }
}

// ---------------------------------------------------------------------------
// Status transition + transition
// ---------------------------------------------------------------------------

export class TransitionKeycloakTopologyStatusUseCase {
  constructor(
    private readonly repo: KeycloakRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    topologyId: string;
    to: KeycloakTopologyStatus | string;
    reason?: string;
    patch?: Record<string, unknown>;
    workflowId?: string | null;
    correlationId: string;
    eventType?: 'provisioned' | 'ready' | 'drift' | 'quarantine' | 'failed';
  }) {
    const topology = await this.repo.getTopology(input.topologyId);
    if (!topology) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Keycloak topology not found', [
        { code: KeycloakErrorCode.VALIDATION },
      ]);
    }
    assertTopologyTransition(topology.status, input.to);
    assertReadyRequiresVerification(topology.status, input.to);

    return this.outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client, enqueueEvt) => {
      const updated = await this.repo.updateTopology(
        topology.id,
        {
          status: input.to,
          statusReason: input.reason ?? null,
          workflowId: input.workflowId ?? topology.workflowId,
          ...(input.patch ?? {}),
        },
        topology.version,
        input.actorId,
        client,
      );
      await this.repo.appendHistory(
        {
          resourceType: 'KEYCLOAK_TOPOLOGY',
          resourceId: topology.id,
          topologyId: topology.id,
          workflowId: input.workflowId ?? topology.workflowId,
          fromStatus: topology.status,
          toStatus: input.to,
          action: 'TRANSITION',
          reason: input.reason ?? null,
          actorId: input.actorId,
          details: {},
        },
        client,
      );
      const evtMap = {
        provisioned: () =>
          createKeycloakTopologyProvisionedEvent(
            topology.id,
            topology.tenantId,
            updated.realmRef,
            input.correlationId,
            input.actorId,
          ),
        ready: () =>
          createKeycloakTopologyReadyEvent(
            topology.id,
            topology.tenantId,
            updated.appliedConfigVersion,
            input.correlationId,
            input.actorId,
          ),
        drift: () =>
          createKeycloakDriftDetectedEvent(
            topology.id,
            String(updated.statusReason ?? 'UNKNOWN'),
            input.correlationId,
            input.actorId,
          ),
        quarantine: () =>
          createKeycloakQuarantineEvent(
            topology.id,
            String(updated.statusReason ?? 'quarantined'),
            input.correlationId,
            input.actorId,
          ),
        failed: () =>
          createKeycloakProvisioningFailedEvent(
            topology.id,
            String(updated.statusReason ?? 'FAILED'),
            input.correlationId,
            input.actorId,
          ),
      };
      if (input.eventType && evtMap[input.eventType]) {
        await enqueueEvt(evtMap[input.eventType]());
      }
      await requireAudit(
        this.audit,
        {
          eventType: `p7.keycloak.topology.${String(input.to).toLowerCase()}`,
          actorId: input.actorId,
          subjectType: 'KEYCLOAK_TOPOLOGY',
          subjectId: topology.id,
          details: { from: topology.status, to: input.to, reason: input.reason ?? null },
        },
        client,
      );
      return updated;
    });
  }
}

// ---------------------------------------------------------------------------
// Provisioning requests → P7.4 workflow (HA: topology row + workflow instance)
// ---------------------------------------------------------------------------

export class RequestKeycloakProvisioningUseCase {
  constructor(
    private readonly repo: KeycloakRepositoryPort,
    private readonly wfRepo: WorkflowRepositoryPort,
    private readonly auth: WorkflowAuthorizationPort,
    private readonly placement: WorkflowPlacementPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
    private readonly createInstance: {
      execute(input: {
        actorId: string;
        idempotencyKey: string;
        definitionId: string;
        workflowType: string;
        inputSnapshot?: Record<string, unknown>;
        provisioningRequestId?: string | null;
        placementDecisionId?: string | null;
        businessReference?: string | null;
        workflowHeaderAuth?: unknown;
      }): Promise<{ id: string; state: string }>;
    },
    private readonly startWorkflow: {
      execute(input: { actorId: string; workflowId: string }): Promise<{ id: string; state: string }>;
    },
  ) {}

  /**
   * Full P7.7 §6 entry point:
   * revalidate P7.1 → ensure P7.4 definition → create topology → bind workflow →
   * start workflow (fail-closed if any dependency is missing).
   */
  async execute(input: {
    actorId: string;
    correlationId: string;
    idempotencyKey: string;
    plan: KeycloakPlanInput;
    validationContext: KeycloakPlanValidationContext;
    provisioningRequestId?: string | null;
    start?: boolean;
  }) {
    const wfExisting = await this.wfRepo.getInstanceByIdempotencyKey(input.idempotencyKey);
    if (wfExisting) {
      const topologyId = String(wfExisting.inputSnapshot.topologyId ?? '');
      const topology = topologyId ? await this.repo.getTopology(topologyId) : null;
      return { workflow: wfExisting, topology };
    }

    // P7.1 fail-closed: a provisioning request is MANDATORY for provisioning.
    if (!input.provisioningRequestId) {
      throw new DomainError(
        ErrorCode.FORBIDDEN,
        'P7.1 provisioning authorization request required (fail-closed)',
        [{ code: KeycloakErrorCode.AUTHORIZATION_FAILED }],
      );
    }
    await revalidateAuthorization(this.auth, {
      workflowId: '',
      provisioningRequestId: input.provisioningRequestId,
    });

    const definition = await ensureKeycloakDefinition(
      this.wfRepo,
      this.outbox,
      this.audit,
      input.actorId,
    );

    // 1) Create topology (atomic: row + version + history + audit + outbox event).
    const topology = await new CreateKeycloakTopologyUseCase(
      this.repo,
      this.auth,
      this.placement,
      this.outbox,
      this.audit,
    ).execute({
      ...input.plan,
      actorId: input.actorId,
      correlationId: input.correlationId,
      provisioningRequestId: input.provisioningRequestId,
      validationContext: input.validationContext,
    });

    // 2) Create workflow instance (P7.4 revalidates authorization again).
    const instance = await this.createInstance.execute({
      actorId: input.actorId,
      idempotencyKey: input.idempotencyKey,
      definitionId: definition.id,
      workflowType: 'keycloak.topology.provision',
      provisioningRequestId: input.provisioningRequestId,
      placementDecisionId: input.plan.placementDecisionId ?? null,
      businessReference: topology.id,
      inputSnapshot: {
        topologyId: topology.id,
        tenantId: topology.tenantId,
        productId: topology.productId,
        providerId: topology.providerId,
        serverId: topology.serverId,
        topologyType: topology.topologyType,
        actorId: input.actorId,
        correlationId: input.correlationId,
      },
    });

    // 3) Bind workflow to topology (own tx — idempotent).
    const bound = await this.outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client) =>
      this.repo.updateTopology(
        topology.id,
        {
          workflowId: instance.id,
          status: KeycloakTopologyStatus.PENDING,
          statusReason: 'workflow-scheduled',
        },
        topology.version,
        input.actorId,
        client,
      ),
    );
    await this.bindWorkflowHistory(topology.id, instance.id, input.actorId);

    let started = null;
    if (input.start !== false) {
      started = await this.startWorkflow.execute({
        actorId: input.actorId,
        workflowId: instance.id,
      });
    }
    return { workflow: started ?? instance, topology: bound };
  }

  private async bindWorkflowHistory(topologyId: string, workflowId: string, actorId: string) {
    await this.outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client) =>
      this.repo.appendHistory(
        {
          resourceType: 'KEYCLOAK_TOPOLOGY',
          resourceId: topologyId,
          topologyId,
          workflowId,
          fromStatus: 'PENDING',
          toStatus: 'PENDING',
          action: 'BIND_WORKFLOW',
          reason: null,
          actorId,
          details: { workflowId },
        },
        client,
      ),
    );
  }
}

/** Canonical P7.7 workflow definitions (all steps use P7.7 handler keys). */
export const KEYCLOAK_WORKFLOW_DEFINITIONS = {
  provision: {
    code: 'p77.keycloak.topology.provision',
    name: 'P7.7 Keycloak Topology Provisioning',
    description: 'Realm/organization/OIDC provisioning for Okapi Edge tenants',
    snapshot: {
      steps: [
        { key: 'validate_plan', type: 'HANDLER', handlerKey: 'keycloak.validate_plan', maxAttempts: 3, timeoutMs: 60_000 },
        {
          key: 'capabilities',
          type: 'HANDLER',
          handlerKey: 'keycloak.discover_capabilities',
          dependsOn: ['validate_plan'],
          maxAttempts: 3,
          timeoutMs: 60_000,
        },
        {
          key: 'topology_provision',
          type: 'HANDLER',
          handlerKey: 'keycloak.provision_realm',
          dependsOn: ['capabilities'],
          maxAttempts: 3,
          timeoutMs: 300_000,
          compensationHandlerKey: 'keycloak.deprovision_topology',
        },
        {
          key: 'topology_organization',
          type: 'HANDLER',
          handlerKey: 'keycloak.provision_organization',
          dependsOn: ['topology_provision'],
          maxAttempts: 3,
          timeoutMs: 300_000,
        },
        {
          key: 'configure_oidc',
          type: 'HANDLER',
          handlerKey: 'keycloak.configure_oidc',
          dependsOn: ['topology_organization'],
          maxAttempts: 3,
          timeoutMs: 120_000,
        },
        {
          key: 'create_client',
          type: 'HANDLER',
          handlerKey: 'keycloak.create_technical_client',
          dependsOn: ['configure_oidc'],
          maxAttempts: 3,
          timeoutMs: 120_000,
        },
        {
          key: 'verify_topology',
          type: 'HANDLER',
          handlerKey: 'keycloak.verify_topology',
          dependsOn: ['create_client'],
          maxAttempts: 3,
          timeoutMs: 120_000,
        },
      ],
    },
  },
  reconcile: {
    code: 'p77.keycloak.topology.reconcile',
    name: 'P7.7 Keycloak Topology Reconciliation',
    description: 'Drift detection + reconciliation of a Keycloak topology',
    snapshot: {
      steps: [
        { key: 'validate_plan', type: 'HANDLER', handlerKey: 'keycloak.validate_plan', maxAttempts: 3, timeoutMs: 60_000 },
        {
          key: 'reconcile',
          type: 'HANDLER',
          handlerKey: 'keycloak.reconcile_topology',
          dependsOn: ['validate_plan'],
          maxAttempts: 3,
          timeoutMs: 120_000,
        },
      ],
    },
  },
  deprovision: {
    code: 'p77.keycloak.topology.deprovision',
    name: 'P7.7 Keycloak Topology Deprovisioning',
    description: 'Destructive, approval-gated retirement of a Keycloak topology',
    snapshot: {
      steps: [
        { key: 'validate_plan', type: 'HANDLER', handlerKey: 'keycloak.validate_plan', maxAttempts: 1, timeoutMs: 60_000 },
        {
          key: 'deprovision',
          type: 'HANDLER',
          handlerKey: 'keycloak.deprovision_topology',
          dependsOn: ['validate_plan'],
          maxAttempts: 1,
          timeoutMs: 300_000,
        },
      ],
    },
  },
  declare_client: {
    code: 'p77.keycloak.topology.declare_client',
    name: 'P7.7 Keycloak Technical Client Declaration',
    description: 'Add a contract-declared technical client and verify the topology',
    snapshot: {
      steps: [
        { key: 'validate_plan', type: 'HANDLER', handlerKey: 'keycloak.validate_plan', maxAttempts: 3, timeoutMs: 60_000 },
        {
          key: 'create_client',
          type: 'HANDLER',
          handlerKey: 'keycloak.create_technical_client',
          dependsOn: ['validate_plan'],
          maxAttempts: 3,
          timeoutMs: 120_000,
        },
        {
          key: 'verify_topology',
          type: 'HANDLER',
          handlerKey: 'keycloak.verify_topology',
          dependsOn: ['create_client'],
          maxAttempts: 3,
          timeoutMs: 120_000,
        },
      ],
    },
  },
} as const;

export type KeycloakWorkflowKind = keyof typeof KEYCLOAK_WORKFLOW_DEFINITIONS;

export function kindForWorkflowType(workflowType: string): KeycloakWorkflowKind {
  if (workflowType === 'keycloak.topology.reconcile') return 'reconcile';
  if (workflowType === 'keycloak.topology.deprovision') return 'deprovision';
  if (workflowType === 'keycloak.topology.declare_client') return 'declare_client';
  return 'provision';
}

const WORKFLOW_RETRY_DEFAULTS = {
  maxAttempts: 3,
  initialDelayMs: 500,
  maxDelayMs: 15_000,
  multiplier: 2,
  jitterRatio: 0.2,
};

/**
 * Ensure a P7.7 workflow definition exists and is PUBLISHED (idempotent).
 * Mirrors Create/Validate/Publish definition use cases inside ONE outbox
 * transaction (no nested transactions).
 */
export async function ensureKeycloakDefinition(
  repo: WorkflowRepositoryPort,
  outbox: ControlPlaneOutboxTransactionService,
  audit: AuditEventRepositoryPort,
  actorId: string,
  kind: KeycloakWorkflowKind = 'provision',
): Promise<{ id: string }> {
  const def = KEYCLOAK_WORKFLOW_DEFINITIONS[kind];
  const code = def.code;
  const existing = await repo.getDefinitionByCode(code);
  if (existing && existing.definitionStatus === WorkflowDefinitionStatus.PUBLISHED) {
    return existing;
  }
  const snapshot = {
    steps: def.snapshot.steps.map((s) => ({
      ...s,
      // `as const` makes dependsOn a readonly tuple — copy to mutable string[].
      dependsOn:
        'dependsOn' in s && s.dependsOn ? [...(s.dependsOn as readonly string[])] : undefined,
    })),
    retryDefaults: WORKFLOW_RETRY_DEFAULTS,
    timeoutDefaultsMs: 600_000,
  };
  validateDefinition(snapshot);

  return outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client) => {
    const publishExisting = async (def: { id: string; version: number; definitionStatus: string }) => {
      if (def.definitionStatus === WorkflowDefinitionStatus.PUBLISHED) return def;
      const latest = await repo.getLatestDefinitionVersion(def.id);
      if (!latest) {
        throw new DomainError(ErrorCode.DEPENDENCY_UNAVAILABLE, 'Workflow definition version missing');
      }
      let currentVersion = def.version;
      if (def.definitionStatus === WorkflowDefinitionStatus.DRAFT) {
        const validated = await repo.setDefinitionStatus(
          def.id,
          WorkflowDefinitionStatus.VALIDATED,
          currentVersion,
          {},
          client,
        );
        currentVersion = validated.version;
      }
      if (def.definitionStatus !== WorkflowDefinitionStatus.VALIDATED) {
        const latestNow = await repo.getLatestDefinitionVersion(def.id);
        await repo.publishDefinitionVersion(
          def.id,
          latestNow?.versionNumber ?? latest.versionNumber,
          latest.snapshot,
          client,
        );
      }
      return repo.setDefinitionStatus(
        def.id,
        WorkflowDefinitionStatus.PUBLISHED,
        currentVersion,
        { approvedBy: actorId, publishedAt: new Date() },
        client,
      );
    };

    const again = await repo.getDefinitionByCode(code);
    if (again) return publishExisting(again);

    const created = await repo.createDefinition(
      {
        code,
        name: 'P7.7 Keycloak Topology Provisioning',
        description: 'Keycloak realm/organization/OIDC provisioning for Okapi Edge tenants',
        domain: 'keycloak',
        definitionStatus: WorkflowDefinitionStatus.DRAFT,
        securityClassification: 'INTERNAL',
        createdBy: actorId,
        approvedBy: null,
        publishedAt: null,
        draftSnapshot: snapshot,
      },
      client,
    );
    const version = await repo.getLatestDefinitionVersion(created.definition.id);
    if (!version) {
      throw new DomainError(ErrorCode.DEPENDENCY_UNAVAILABLE, 'Workflow definition version missing');
    }
    await repo.publishDefinitionVersion(created.definition.id, version.versionNumber, version.snapshot, client);
    const validated = await repo.setDefinitionStatus(
      created.definition.id,
      WorkflowDefinitionStatus.VALIDATED,
      created.definition.version,
      {},
      client,
    );
    void validated;
    // DRAFT → VALIDATED was applied before publish; re-publish semantics require
    // a DRAFT status first, so publish from VALIDATED using the current version.
    return repo.setDefinitionStatus(
      created.definition.id,
      WorkflowDefinitionStatus.PUBLISHED,
      created.definition.version + 1,
      { approvedBy: actorId, publishedAt: new Date() },
      client,
    );
  });
}

/**
 * Launch a P7.4 workflow on an EXISTING topology (reconcile / deprovision /
 * declare-client), revalidating the bound P7.1 authorization fail-closed.
 */
export class LaunchTopologyWorkflowUseCase {
  constructor(
    private readonly repo: KeycloakRepositoryPort,
    private readonly wfRepo: WorkflowRepositoryPort,
    private readonly auth: WorkflowAuthorizationPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
    private readonly createInstance: {
      execute(input: {
        actorId: string;
        idempotencyKey: string;
        definitionId: string;
        workflowType: string;
        inputSnapshot?: Record<string, unknown>;
        provisioningRequestId?: string | null;
        placementDecisionId?: string | null;
        businessReference?: string | null;
      }): Promise<{ id: string; state: string }>;
    },
    private readonly startWorkflow: { execute(input: { actorId: string; workflowId: string }): Promise<{ id: string; state: string }> },
  ) {}

  async execute(input: {
    actorId: string;
    correlationId: string;
    idempotencyKey: string;
    definitionCode: string;
    workflowType: string;
    topologyId: string;
    snapshot: Record<string, unknown>;
    provisioningRequestId?: string | null;
    /** Destructive operations require explicit authorization flags in snapshot. */
    destructive?: boolean;
    authorized?: boolean;
    confirmed?: boolean;
  }) {
    const wfExisting = await this.wfRepo.getInstanceByIdempotencyKey(input.idempotencyKey);
    if (wfExisting) return { workflow: wfExisting, topology: await this.repo.getTopology(input.topologyId) };

    const topology = await this.repo.getTopology(input.topologyId);
    if (!topology) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Keycloak topology not found', [
        { code: KeycloakErrorCode.VALIDATION },
      ]);
    }

    // P7.1 fail-closed: revalidate the ORIGINAL bound authorization.
    if (topology.authorizationId || input.provisioningRequestId) {
      const result = topology.authorizationId && topology.authorizationVersion
        ? await revalidateAuthorization(this.auth, {
            workflowId: '',
            authorizationId: topology.authorizationId,
            authorizationVersion: topology.authorizationVersion,
            provisioningRequestId: input.provisioningRequestId ?? null,
          })
        : await (async () => {
            const view =
              input.provisioningRequestId
                ? await this.auth.getWorkflowReadyRequest(input.provisioningRequestId)
                : null;
            return { ok: Boolean(view), reason: view ? 'OK' : 'AUTHORIZATION_REVOKED' };
          })();
      if (!result.ok) {
        throw new DomainError(
          ErrorCode.FORBIDDEN,
          `P7.1 authorization not valid: ${result.reason}`,
          [{ code: KeycloakErrorCode.AUTHORIZATION_FAILED, reason: result.reason }],
        );
      }
    } else {
      throw new DomainError(
        ErrorCode.FORBIDDEN,
        'Topology has no bound P7.1 authorization (fail-closed)',
        [{ code: KeycloakErrorCode.AUTHORIZATION_FAILED }],
      );
    }

    // Destructive ops: refuse to even create the workflow without both flags.
    if (input.destructive && (!input.authorized || !input.confirmed)) {
      throw new DomainError(
        ErrorCode.FORBIDDEN,
        'Deprovisioning requires explicit authorization AND confirmation',
        [{ code: KeycloakErrorCode.DEPROVISION_FORBIDDEN }],
      );
    }
    if (input.destructive && topology.deletionProtection !== true) {
      // allowed only through explicit flags (already checked) — deletionProtection
      // default TRUE simply forces the approval step in the deprovision handler.
    }

    const definition = await ensureKeycloakDefinition(
      this.wfRepo,
      this.outbox,
      this.audit,
      input.actorId,
      kindForWorkflowType(input.workflowType),
    );

    const instance = await this.createInstance.execute({
      actorId: input.actorId,
      idempotencyKey: input.idempotencyKey,
      definitionId: definition.id,
      workflowType: input.workflowType,
      provisioningRequestId: input.provisioningRequestId ?? null,
      businessReference: topology.id,
      inputSnapshot: {
        topologyId: topology.id,
        tenantId: topology.tenantId,
        productId: topology.productId,
        providerId: topology.providerId,
        serverId: topology.serverId,
        topologyType: topology.topologyType,
        actorId: input.actorId,
        correlationId: input.correlationId,
        ...input.snapshot,
      },
    });

    await this.outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client) =>
      this.repo.appendHistory(
        {
          resourceType: 'KEYCLOAK_TOPOLOGY',
          resourceId: topology.id,
          topologyId: topology.id,
          workflowId: instance.id,
          fromStatus: String(topology.status),
          toStatus: String(topology.status),
          action: `LAUNCH_${input.workflowType.toUpperCase()}`,
          reason: null,
          actorId: input.actorId,
          details: { workflowType: input.workflowType },
        },
        client,
      ),
    );

    const started = await this.startWorkflow.execute({
      actorId: input.actorId,
      workflowId: instance.id,
    });
    return { workflow: started, topology };
  }
}

// ---------------------------------------------------------------------------
// Realm / organization / client / OIDC provisioning (invoked by live executor)
// ---------------------------------------------------------------------------

export class ProvisionKeycloakRealmUseCase {
  constructor(
    private readonly repo: KeycloakRepositoryPort,
    private readonly provider: KeycloakProviderPort,
    private readonly secrets?: SecretsProviderPort,
  ) {}

  /** Resolve admin connection for the topology's registered server. */
  async connectionFor(serverId: string): Promise<KeycloakAdminConnection> {
    const server = await this.repo.getServerById(serverId);
    if (!server) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Keycloak server not found', [
        { code: KeycloakErrorCode.SERVER_UNAVAILABLE },
      ]);
    }
    if (!server.adminCredentialRef) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Server credential reference missing', [
        { code: KeycloakErrorCode.VALIDATION },
      ]);
    }
    return {
      baseUrl: server.baseUrl,
      adminRealm: server.adminRealm,
      adminClientId: server.adminClientId,
      adminCredentialRef: server.adminCredentialRef,
      tlsMode: server.tlsMode === 'REQUIRED' ? 'REQUIRED' : 'OPTIONAL_INSECURE_LOCAL',
      allowPrivateNetwork: server.allowPrivateNetwork,
    };
  }
}

export class ProvidedReconciliationAssessment {
  /** Drift classification for reconciliation runs. */
  static classify(observed: { realmExists: boolean; fingerprintMismatch: boolean; orgExists: boolean; clientExists: boolean }):
    | 'NONE'
    | 'REALM_MISSING'
    | 'REALM_MODIFIED'
    | 'ORG_MISSING'
    | 'CLIENT_MISSING'
    | 'CRITICAL' {
    if (!observed.realmExists) return 'REALM_MISSING';
    if (observed.fingerprintMismatch) return 'REALM_MODIFIED';
    if (!observed.orgExists) return 'ORG_MISSING';
    if (!observed.clientExists) return 'CLIENT_MISSING';
    return 'NONE';
  }
}