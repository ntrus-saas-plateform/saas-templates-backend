import { randomUUID } from 'node:crypto';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import type {
  CreateKeycloakTopologyUseCase,
  DiscoverKeycloakCapabilitiesUseCase,
} from '../../application/keycloak-topology/keycloak.use-cases.js';
import type { KeycloakLiveExecutor } from '../../domain/keycloak-topology/keycloak-handlers.js';
import type {
  KeycloakAdminConnection,
  KeycloakProviderPort,
  KeycloakTopologyTarget,
} from '../../domain/keycloak-topology/keycloak-provider.port.js';
import type { KeycloakRepositoryPort } from '../../domain/keycloak-topology/keycloak-repository.port.js';
import {
  KeycloakClientKind,
  KeycloakErrorCode,
  KeycloakTopologyStatus,
  KeycloakTopologyType,
  type KeycloakHandlerKey,
  type KeycloakTopologyRecord,
} from '../../domain/keycloak-topology/keycloak.types.js';
import type {
  WorkflowHandlerInput,
  WorkflowHandlerOutcome,
} from '../../domain/workflow/workflow-handler.port.js';
import type { SecretsProviderPort } from '../../domain/infrastructure-provisioning/secrets-provider.port.js';
import type {
  WorkflowAuthorizationPort,
  WorkflowReadyAuthorizationView,
} from '../../domain/workflow/workflow-authorization.port.js';
import type {
  LeaseValidationResult,
  WorkflowLeasePort,
} from '../../domain/workflow/workflow-lease.port.js';
import { validateRedirectUris, validateWebOrigins, deriveOrgAlias } from '../../domain/keycloak-topology/keycloak-plan.js';
import { redactSecrets } from '../../application/keycloak-topology/keycloak.use-cases.js';
import { redactSensitive } from './keycloak-admin.adapter.js';

/** P7.1 revalidation must answer fast — a hung service fails CLOSED. */
const AUTHORIZATION_TIMEOUT_MS = 5_000;

function snap(input: WorkflowHandlerInput): Record<string, unknown> {
  return { ...input.workflowInput, ...input.inputSnapshot, ...input.executionContext };
}
function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v : undefined;
}

function ok(output: Record<string, unknown> = {}): WorkflowHandlerOutcome {
  return { status: 'SUCCEEDED', outputSnapshot: output };
}
function fail(
  code: KeycloakErrorCode | string,
  message: string,
  retryable = false,
): WorkflowHandlerOutcome {
  const safe = redactSensitive(message);
  return {
    status: 'FAILED',
    errorClass: code,
    message: safe,
    retryable:
      retryable ||
      code === KeycloakErrorCode.TIMEOUT ||
      code === KeycloakErrorCode.SERVER_UNAVAILABLE ||
      code === KeycloakErrorCode.DEPENDENCY_UNAVAILABLE,
    diagnostics: { handler: 'p7.7', message: safe },
  };
}

/**
 * Snapshot denial flags are honored as DENIALS only — they can never grant
 * authorization (P7.7 mandate §1.11). Absent fields are not "valid" either:
 * they simply carry no signal, and the canonical P7.1 revalidation decides.
 * Both boolean and string representations are accepted (mandate §1 test list).
 */
function isTrueFlag(value: unknown): boolean {
  if (value === true) return true;
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    return v === 'true' || v === '1';
  }
  return false;
}
function isFalseFlag(value: unknown): boolean {
  if (value === false) return true;
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    return v === 'false' || v === '0';
  }
  return false;
}

function snapshotAuthorizationDenial(s: Record<string, unknown>): string | null {
  if (isFalseFlag(s.authorizationValid)) return 'SNAPSHOT_DECLARED_NOT_VALID';
  if (isTrueFlag(s.authorizationRevoked)) return 'SNAPSHOT_DECLARED_REVOKED';
  if (isTrueFlag(s.authorizationExpired)) return 'SNAPSHOT_DECLARED_EXPIRED';
  return null;
}

function intOf(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value)) return value;
  if (typeof value === 'string' && value.trim() && Number.isInteger(Number(value))) {
    return Number(value);
  }
  return null;
}

/** Rejects a P7.1 service that does not answer within the budget (fail-closed). */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err instanceof Error ? err : new Error(String(err)));
      },
    );
  });
}

type AuthorizationDecision =
  | { allowed: true; view: WorkflowReadyAuthorizationView; rowId: string; version: number }
  | { allowed: false; reason: string; rowId?: string | null; version?: number | null };

/** Redacted, durable description of the authorization decision (evidence field). */
function authorizationEvidence(
  decision: AuthorizationDecision,
  context: { tenantId: string; productId: string; provisioningRequestId: string | null },
): Record<string, unknown> {
  return {
    p71AuthorizationDecision: decision.allowed ? 'ALLOW' : 'DENY',
    p71AuthorizationReason: decision.allowed ? 'REVALIDATED' : decision.reason,
    p71AuthorizationRowId: decision.rowId ?? null,
    p71AuthorizationVersion: decision.version ?? null,
    p71ProvisioningRequestId: context.provisioningRequestId,
    tenantId: context.tenantId,
    productId: context.productId,
    decidedAt: new Date().toISOString(),
  };
}

/**
 * Bridges P7.4 workflow handlers → P7.7 use cases + REAL Keycloak adapters.
 *
 * Security invariants (P7.7 remediation):
 *  - P7.1 authorization is REVALIDATED against the canonical service from the
 *    persisted provisioning identity immediately before every sensitive
 *    Keycloak operation. Snapshot flags are never proof of authorization.
 *  - P7.4 fencing is validated against the AUTHORITATIVE lease state (never a
 *    token compared with itself) before every mutation and before compensation.
 *  - Every decision — allow or deny — is written to durable, redacted evidence.
 */
export function createLiveKeycloakExecutor(deps: {
  repo: KeycloakRepositoryPort;
  provider: KeycloakProviderPort;
  secrets: SecretsProviderPort;
  discoverCapabilities: DiscoverKeycloakCapabilitiesUseCase;
  createTopology: CreateKeycloakTopologyUseCase;
  /** Canonical P7.1 authorization service (fail-closed when absent). */
  authorization: WorkflowAuthorizationPort;
  /** Authoritative P7.4 lease/fencing state (fail-closed when absent). */
  lease: WorkflowLeasePort;
}): KeycloakLiveExecutor {
  const connectionFor = async (serverId: string): Promise<KeycloakAdminConnection> => {
    const server = await deps.repo.getServerById(serverId);
    if (!server) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Keycloak server not found');
    if (!server.adminCredentialRef) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Server credential reference missing');
    }
    return {
      baseUrl: server.baseUrl,
      adminRealm: server.adminRealm,
      adminClientId: server.adminClientId,
      adminCredentialRef: server.adminCredentialRef,
      tlsMode: server.tlsMode === 'REQUIRED' ? 'REQUIRED' : 'OPTIONAL_INSECURE_LOCAL',
      allowPrivateNetwork: server.allowPrivateNetwork,
    };
  };

  const recordEvidence = async (
    topologyId: string,
    tenantId: string,
    input: WorkflowHandlerInput,
    operation: string,
    outcome: 'SUCCEEDED' | 'FAILED' | 'SKIPPED',
    evidence: Record<string, unknown>,
    startedAt: number,
    error?: { code: string; message: string },
  ) => {
    try {
      await deps.repo.createEvidence({
        topologyId,
        tenantId,
        workflowId: input.workflowId ?? null,
        stepKey: input.stepKey ?? null,
        operation,
        outcome,
        evidence: redactSecrets(evidence),
        errorCode: error?.code ?? null,
        errorMessage: error ? redactSensitive(error.message) : null,
        durationMs: Date.now() - startedAt,
        performedBy: input.workerId ?? null,
      });
    } catch (err) {
      // Evidence is mandatory for a mutation; surface the failure loudly.
      throw new DomainError(
        ErrorCode.DEPENDENCY_UNAVAILABLE,
        'Keycloak operation evidence could not be persisted',
        [{ operation }],
        err instanceof Error ? err : undefined,
      );
    }
  };

  const loadTopologyContext = async (s: Record<string, unknown>) => {
    const topologyId = str(s.topologyId);
    if (!topologyId) return null;
    const topology = await deps.repo.getTopology(topologyId);
    if (!topology) return null;
    const realm = await deps.repo.getRealmByTopology(topology.id);
    const org = await deps.repo.getOrganizationByTopology(topology.id);
    const caps = await deps.repo.getCapabilities(topology.serverId);
    const server = await deps.repo.getServerById(topology.serverId);
    return { topology, realm, org, caps, server };
  };

  // -------------------------------------------------------------------------
  // P7.4 — authoritative lease/fencing validation.
  // The supplied token is ALWAYS compared against the persisted lease state;
  // a token is never used as its own expected value.
  // -------------------------------------------------------------------------
  const validateLease = async (input: WorkflowHandlerInput): Promise<LeaseValidationResult> => {
    if (!deps.lease) {
      return { valid: false, reason: 'DEPENDENCY_UNAVAILABLE', detail: 'lease port not wired' };
    }
    if (!Number.isInteger(input.fencingToken) || input.fencingToken < 1) {
      return {
        valid: false,
        reason: 'MISSING_TOKEN',
        detail: 'fencingToken must be a positive integer issued by the engine',
      };
    }
    if (!input.workflowId || !input.stepId || !input.workerId) {
      return { valid: false, reason: 'STEP_NOT_FOUND', detail: 'claim identity incomplete' };
    }
    try {
      return await deps.lease.validateLease({
        workflowId: input.workflowId,
        stepId: input.stepId,
        workerId: input.workerId,
        fencingToken: input.fencingToken,
      });
    } catch {
      return { valid: false, reason: 'DEPENDENCY_UNAVAILABLE', detail: 'lease validation failed' };
    }
  };

  // -------------------------------------------------------------------------
  // P7.1 — independent revalidation from the PERSISTED provisioning identity.
  // Never reads `authorizationValid`/`Expired`/`Revoked` as proof of anything:
  // those flags can only DENY, and an absent flag grants nothing.
  // -------------------------------------------------------------------------
  const decideAuthorization = async (
    s: Record<string, unknown>,
    topology: KeycloakTopologyRecord | null,
    context: { tenantId: string; productId: string },
  ): Promise<AuthorizationDecision> => {
    const ctx = {
      tenantId: context.tenantId,
      productId: context.productId,
      provisioningRequestId: str(s.provisioningRequestId) ?? null,
    };

    const snapshotDenial = snapshotAuthorizationDenial(s);
    if (snapshotDenial) return { allowed: false, reason: snapshotDenial };

    if (!topology) {
      return { allowed: false, reason: 'TOPOLOGY_CONTEXT_MISSING' };
    }
    if (!deps.authorization) {
      return { allowed: false, reason: 'AUTHORIZATION_SERVICE_UNAVAILABLE' };
    }

    // Canonical identity: workflow execution context and persisted topology must
    // agree; either alone is acceptable, disagreement is fail-closed.
    const contextRowId = str(s.authorizationRowId) ?? str(s.authorizationId) ?? null;
    const contextVersion = intOf(s.authorizationVersion);
    const topologyRowId = topology.authorizationId ?? null;
    const topologyVersion = topology.authorizationVersion ?? null;

    if (!contextRowId && !topologyRowId) {
      return { allowed: false, reason: 'AUTHORIZATION_REFERENCE_MISSING' };
    }
    if (contextRowId && topologyRowId && contextRowId !== topologyRowId) {
      return { allowed: false, reason: 'AUTHORIZATION_REFERENCE_MISMATCH' };
    }
    if (contextVersion != null && topologyVersion != null && contextVersion !== topologyVersion) {
      return { allowed: false, reason: 'AUTHORIZATION_VERSION_MISMATCH' };
    }

    const rowId = contextRowId ?? topologyRowId;
    const version = contextVersion ?? topologyVersion;
    if (!rowId) return { allowed: false, reason: 'AUTHORIZATION_REFERENCE_MISSING' };
    if (version == null || !Number.isInteger(version) || version < 1) {
      return { allowed: false, reason: 'AUTHORIZATION_VERSION_MISSING', rowId };
    }

    let view: WorkflowReadyAuthorizationView | null;
    try {
      view = await withTimeout(
        deps.authorization.revalidateBoundAuthorization({
          authorizationRowId: rowId,
          authorizationVersion: version,
          provisioningRequestId: ctx.provisioningRequestId,
        }),
        AUTHORIZATION_TIMEOUT_MS,
        'P7.1 authorization revalidation',
      );
    } catch {
      // Timeout / unavailable dependency → fail closed (never assume valid).
      return { allowed: false, reason: 'AUTHORIZATION_SERVICE_UNAVAILABLE', rowId, version };
    }
    if (!view) {
      // Revoked, expired, superseded version, missing record or unbound request.
      return { allowed: false, reason: 'AUTHORIZATION_NOT_VALID', rowId, version };
    }

    // Bind the canonical view to THIS tenant / product / provisioning request.
    if (view.authorizationRowId !== rowId) {
      return { allowed: false, reason: 'AUTHORIZATION_REFERENCE_MISMATCH', rowId, version };
    }
    if (view.authorizationVersion !== version) {
      return { allowed: false, reason: 'AUTHORIZATION_VERSION_MISMATCH', rowId, version };
    }
    if (view.productId && context.productId && view.productId !== context.productId) {
      return { allowed: false, reason: 'AUTHORIZATION_PRODUCT_MISMATCH', rowId, version };
    }
    if (view.productTenantId && view.productTenantId !== context.tenantId) {
      return { allowed: false, reason: 'AUTHORIZATION_TENANT_MISMATCH', rowId, version };
    }
    if (
      ctx.provisioningRequestId &&
      view.requestId &&
      view.requestId !== ctx.provisioningRequestId
    ) {
      return { allowed: false, reason: 'AUTHORIZATION_REQUEST_MISMATCH', rowId, version };
    }

    return { allowed: true, view, rowId, version };
  };

  /**
   * Revalidate P7.1 and persist the (redacted) decision BEFORE the operation.
   * Returns `null` when authorization holds, otherwise a FAILED outcome — the
   * caller must not touch Keycloak in that case.
   */
  const guardAuthorization = async (params: {
    input: WorkflowHandlerInput;
    s: Record<string, unknown>;
    topology: KeycloakTopologyRecord | null;
    tenantId: string;
    productId: string;
    topologyId: string;
    operation: string;
    startedAt: number;
  }): Promise<WorkflowHandlerOutcome | null> => {
    const decision = await decideAuthorization(params.s, params.topology, {
      tenantId: params.tenantId,
      productId: params.productId,
    });
    const evidence = authorizationEvidence(decision, {
      tenantId: params.tenantId,
      productId: params.productId,
      provisioningRequestId: str(params.s.provisioningRequestId) ?? null,
    });

    if (decision.allowed) {
      if (params.topologyId) {
        await recordEvidence(
          params.topologyId,
          params.tenantId,
          params.input,
          `${params.operation}:authorization_check`,
          'SUCCEEDED',
          evidence,
          params.startedAt,
        );
      }
      return null;
    }

    if (params.topologyId) {
      await recordEvidence(
        params.topologyId,
        params.tenantId,
        params.input,
        `${params.operation}:authorization_check`,
        'FAILED',
        evidence,
        params.startedAt,
        { code: KeycloakErrorCode.AUTHORIZATION_FAILED, message: `P7.1 denied: ${decision.reason}` },
      );
    }
    return fail(
      KeycloakErrorCode.AUTHORIZATION_FAILED,
      `P7.1 authorization denied: ${decision.reason}`,
      false,
    );
  };

  /** P7.4 guard: authoritative lease check + durable denial evidence. */
  const leaseGuard = async (
    input: WorkflowHandlerInput,
    topologyId: string,
    tenantId: string,
    operation: string,
    startedAt: number,
  ): Promise<WorkflowHandlerOutcome | null> => {
    const leaseCheck = await validateLease(input);
    if (leaseCheck.valid) return null;
    if (topologyId) {
      await deps.repo
        .createEvidence({
          topologyId,
          tenantId,
          workflowId: input.workflowId ?? null,
          stepKey: input.stepKey ?? null,
          operation: `${operation}:fencing_denied`,
          outcome: 'FAILED',
          evidence: redactSecrets({
            fencingDenialReason: leaseCheck.reason,
            fencingDenialDetail: leaseCheck.detail ?? null,
            suppliedFencingToken: Number.isInteger(input.fencingToken) ? input.fencingToken : null,
            // Audit value (non-secret): which sequence the rejected worker presented.
            presentedFencingSequence: Number.isInteger(input.fencingToken)
              ? input.fencingToken
              : null,
            workerId: input.workerId,
            decidedAt: new Date().toISOString(),
          }),
          errorCode: KeycloakErrorCode.CONFLICT,
          errorMessage: redactSensitive(
            `P7.4 lease rejected: ${leaseCheck.reason}${leaseCheck.detail ? ` (${leaseCheck.detail})` : ''}`,
          ),
          durationMs: Date.now() - startedAt,
          performedBy: input.workerId ?? null,
        })
        .catch(() => undefined);
    }
    return fail(
      KeycloakErrorCode.CONFLICT,
      `P7.4 fencing/lease rejected: ${leaseCheck.reason}${leaseCheck.detail ? ` (${leaseCheck.detail})` : ''}`,
      false,
    );
  };

  /**
   * Executed immediately before EVERY external Keycloak mutation (and before
   * compensation): fresh lease validation + fresh P7.1 revalidation. Returns
   * `null` when both hold; otherwise the caller must abort without calling the
   * provider.
   */
  const beforeMutation = async (params: {
    input: WorkflowHandlerInput;
    s: Record<string, unknown>;
    topology: KeycloakTopologyRecord | null;
    tenantId: string;
    topologyId: string;
    operation: string;
    startedAt: number;
  }): Promise<WorkflowHandlerOutcome | null> => {
    const denied = await leaseGuard(
      params.input,
      params.topologyId,
      params.tenantId,
      params.operation,
      params.startedAt,
    );
    if (denied) return denied;
    return guardAuthorization({
      input: params.input,
      s: params.s,
      topology: params.topology,
      tenantId: params.tenantId,
      productId: params.topology?.productId ?? '',
      topologyId: params.topologyId,
      operation: params.operation,
      startedAt: params.startedAt,
    });
  };

  return async (input, key: KeycloakHandlerKey): Promise<WorkflowHandlerOutcome> => {
    const s = snap(input);
    const actorId = str(s.actorId) ?? input.workerId;
    const tenantId = str(s.tenantId) ?? '';
    const topologyId = str(s.topologyId) ?? '';
    const startedAt = Date.now();

    // P7.4 — authoritative lease check BEFORE any work (execute AND compensate).
    const leaseDenied = await leaseGuard(input, topologyId, tenantId, key, startedAt);
    if (leaseDenied) return leaseDenied;

    if (!topologyId && key !== 'keycloak.validate_plan') {
      return fail(KeycloakErrorCode.VALIDATION, 'topologyId required in workflow input');
    }

    try {
      switch (key) {
        // -----------------------------------------------------------------
        // 1) Re-validate all P7.x gates on the persisted desired state.
        // -----------------------------------------------------------------
        case 'keycloak.validate_plan': {
          const ctx = await loadTopologyContext(s);
          if (!ctx) return fail(KeycloakErrorCode.VALIDATION, 'Topology not found (fail-closed)');
          const { topology, server, caps } = ctx;

          // P7.1 — independent canonical revalidation (fail-closed). The
          // snapshot flags below are only ever consulted as DENIALS inside
          // decideAuthorization(); they can never substitute for this check.
          const authzDenied = await guardAuthorization({
            input,
            s,
            topology,
            tenantId,
            productId: topology.productId,
            topologyId,
            operation: 'validate_plan',
            startedAt,
          });
          if (authzDenied) return authzDenied;

          const issues: string[] = [];
          if (!server) issues.push('server unregistered');
          if (server && server.operationalStatus !== 'ACTIVE') issues.push('server not ACTIVE');
          if (server && server.lastConnectivityStatus === 'FAILED') issues.push('server connectivity failed');
          if (topology.desiredConfigVersion < 1) issues.push('invalid desired config version');
          if (
            topology.topologyType === KeycloakTopologyType.SHARED_REALM_ORGANIZATIONS &&
            !caps?.organizationsSupported
          ) {
            issues.push('organizations capability not verified on server');
          }
          if (issues.length) {
            await recordEvidence(topologyId, tenantId, input, 'validate_plan', 'FAILED', { issues }, startedAt, {
              code: KeycloakErrorCode.AUTHORIZATION_FAILED,
              message: issues.join('; '),
            });
            return fail(KeycloakErrorCode.AUTHORIZATION_FAILED, `Validation failed: ${issues.join('; ')}`);
          }
          await recordEvidence(topologyId, tenantId, input, 'validate_plan', 'SUCCEEDED', { issues: [] }, startedAt);
          return ok({ topologyId, topologyType: topology.topologyType, state: topology.status });
        }

        // -----------------------------------------------------------------
        // 2) Discover + persist real server capabilities.
        // -----------------------------------------------------------------
        case 'keycloak.discover_capabilities': {
          const capabilities = await deps.discoverCapabilities.execute({
            actorId,
            serverId: String(
              s.serverId ?? (await loadTopologyContext(s))?.topology.serverId ?? '',
            ),
            correlationId: input.correlationId,
          });
          await recordEvidence(
            topologyId,
            tenantId,
            input,
            'discover_capabilities',
            'SUCCEEDED',
            {
              keycloakVersion: capabilities.keycloakVersion,
              organizationsSupported: capabilities.organizationsSupported,
            },
            startedAt,
          );
          return ok({
            keycloakVersion: capabilities.keycloakVersion,
            organizationsSupported: capabilities.organizationsSupported,
          });
        }

        // -----------------------------------------------------------------
        // 3) Realm/organization provisioning (Model A/B) + status transitions.
        // -----------------------------------------------------------------
        case 'keycloak.provision_realm':
        case 'keycloak.provision_organization': {
          const ctx = await loadTopologyContext(s);
          if (!ctx?.topology) return fail(KeycloakErrorCode.VALIDATION, 'Topology not found');
          const { topology } = ctx;
          if (!ctx.server) return fail(KeycloakErrorCode.SERVER_UNAVAILABLE, 'Server not registered');
          const conn = await connectionFor(topology.serverId);
          const realmName = str((topology.metadata as Record<string, unknown>).resolvedRealmName) ?? '';
          if (!realmName) return fail(KeycloakErrorCode.VALIDATION, 'Resolved realm name missing');

          // P7.1 + P7.4 before touching ANY state (write or provider call).
          const entryDenied = await beforeMutation({
            input,
            s,
            topology,
            tenantId,
            topologyId,
            operation: `${key}:precheck`,
            startedAt,
          });
          if (entryDenied) return entryDenied;

          // Status: PROVISIONING (idempotent transition guard applied by repo version).
          await deps.repo.updateTopology(
            topology.id,
            { status: KeycloakTopologyStatus.PROVISIONING, statusReason: null },
            topology.version,
            actorId,
          ).catch(() => undefined); // concurrent worker may already have advanced

          if (key === 'keycloak.provision_realm') {
            if (topology.topologyType === KeycloakTopologyType.EXTERNAL_SPECIFIC) {
              await recordEvidence(
                topologyId,
                tenantId,
                input,
                'provision_realm',
                'SKIPPED',
                { reason: 'EXTERNAL_SPECIFIC topology handled by certified adapter contract' },
                startedAt,
              );
              return ok({ skipped: true, topologyType: topology.topologyType });
            }
            const existingRealm = await deps.repo.getRealmByTopology(topology.id);
            const settings = {
              ...(existingRealm
                ? {
                    sslRequired: existingRealm.sslRequired,
                    ssoSessionIdle: existingRealm.ssoSessionIdleSeconds,
                    ssoSessionMax: existingRealm.ssoSessionMaxSeconds,
                    accessTokenLifespan: existingRealm.accessTokenLifespanSeconds,
                    passwordPolicy: existingRealm.passwordPolicy,
                    revokeRefreshToken: existingRealm.revokeRefreshToken,
                    refreshTokenMaxReuse: existingRealm.refreshTokenMaxReuse,
                  }
                : {}),
              ...(typeof (topology.metadata as Record<string, unknown>).realmSettings === 'object'
                ? ((topology.metadata as Record<string, unknown>).realmSettings as Record<string, unknown>)
                : {}),
            };
            const target: KeycloakTopologyTarget = {
              topologyId: topology.id,
              tenantId: topology.tenantId,
              topologyType: String(topology.topologyType),
              realmName,
              realmSettings: settings,
              expectedFingerprint: topology.resourceFingerprint ?? '',
            };
            // Fresh P7.1 + P7.4 validation IMMEDIATELY before the external call.
            const realmDenied = await beforeMutation({
              input,
              s,
              topology,
              tenantId,
              topologyId,
              operation: 'provision_realm',
              startedAt,
            });
            if (realmDenied) return realmDenied;
            // REAL Keycloak call — idempotent (reconciles before create).
            const observation = await deps.provider.createRealm(conn, target);

            const realmRow =
              existingRealm ??
              (await deps.repo.createRealm({
                id: randomUUID(),
                topologyId: topology.id,
                tenantId: topology.tenantId,
                realmName,
                externalRealmId: observation.externalId,
                managedByEdge: true,
                sslRequired: String(settings.sslRequired ?? 'external'),
                ssoSessionIdleSeconds: Number(settings.ssoSessionIdle ?? 1800),
                ssoSessionMaxSeconds: Number(settings.ssoSessionMax ?? 36000),
                accessTokenLifespanSeconds: Number(settings.accessTokenLifespan ?? 300),
                passwordPolicy: typeof settings.passwordPolicy === 'string' ? settings.passwordPolicy : null,
                revokeRefreshToken: settings.revokeRefreshToken === undefined ? true : Boolean(settings.revokeRefreshToken),
                refreshTokenMaxReuse: Number(settings.refreshTokenMaxReuse ?? 0),
                desiredFingerprint: topology.resourceFingerprint,
                appliedFingerprint: observation.fingerprint,
                status: observation.exists ? 'READY' : 'PROVISIONING',
                workflowId: input.workflowId ?? null,
                evidence: { observedOnCreate: observation.exists },
              }));

            if (observation.exists && realmRow.externalRealmId !== observation.externalId) {
              await deps.repo.updateRealm(
                realmRow.id,
                { externalRealmId: observation.externalId, appliedFingerprint: observation.fingerprint },
                realmRow.version,
              );
            }

            // Apply authorized technical settings (only when realm already existed and settings changed).
            if (observation.exists && observation.fingerprint !== (topology.resourceFingerprint ?? null)) {
              const settingsDenied = await beforeMutation({
                input,
                s,
                topology,
                tenantId,
                topologyId,
                operation: 'provision_realm:settings',
                startedAt,
              });
              if (settingsDenied) return settingsDenied;
              await deps.provider.updateRealmSettings(conn, realmName, settings);
            }

            await deps.repo.createResourceReference({
              topologyId: topology.id,
              tenantId: topology.tenantId,
              resourceKind: 'REALM',
              internalRef: realmRow.id,
              externalId: observation.externalId ?? realmName,
              externalKind: 'KEYCLOAK',
              verified: observation.exists,
              verifiedAt: observation.exists ? new Date() : null,
            }).catch(() => undefined); // unique constraint → already bound

            await deps.repo.updateTopology(
              topology.id,
              {
                realmRef: realmRow.id,
                externalRealmId: observation.externalId,
                status: KeycloakTopologyStatus.CONFIGURING,
              },
              (await deps.repo.getTopology(topology.id))?.version ?? topology.version + 1,
              actorId,
            ).catch(() => undefined);

            await recordEvidence(
              topologyId,
              tenantId,
              input,
              'provision_realm',
              'SUCCEEDED',
              {
                realmName,
                externalRealmId: observation.externalId,
                preexisting: observation.exists,
              },
              startedAt,
            );
            return ok({ realmId: realmRow.id, realmName, externalRealmId: observation.externalId });
          }

          // --- Organization (Model B only) ----------------------------------
          if (topology.topologyType !== KeycloakTopologyType.SHARED_REALM_ORGANIZATIONS) {
            await recordEvidence(
              topologyId,
              tenantId,
              input,
              'provision_organization',
              'SKIPPED',
              { reason: `topology ${topology.topologyType} does not use organizations` },
              startedAt,
            );
            return ok({ skipped: true, topologyType: topology.topologyType });
          }
          if (!ctx.caps?.organizationsSupported) {
            await recordEvidence(
              topologyId,
              tenantId,
              input,
              'provision_organization',
              'FAILED',
              { reason: 'organizations capability not verified' },
              startedAt,
              { code: KeycloakErrorCode.CAPABILITY_UNSUPPORTED, message: 'Organizations unsupported' },
            );
            return fail(
              KeycloakErrorCode.CAPABILITY_UNSUPPORTED,
              'Keycloak Organizations not verified on this server (no silent compatibility)',
            );
          }
          const existingOrg = await deps.repo.getOrganizationByTopology(topology.id);
          const alias =
            str((topology.metadata as Record<string, unknown>).resolvedOrgAlias) ??
            deriveOrgAlias(topology.tenantId);
          // Fresh P7.1 + P7.4 validation IMMEDIATELY before the external call.
          const orgDenied = await beforeMutation({
            input,
            s,
            topology,
            tenantId,
            topologyId,
            operation: 'provision_organization',
            startedAt,
          });
          if (orgDenied) return orgDenied;
          const observation = await deps.provider.createOrganization(
            conn,
            realmName,
            alias,
            `tenant ${topology.tenantId} (technical)`,
          );
          const orgRow =
            existingOrg ??
            (await deps.repo.createOrganization({
              id: randomUUID(),
              topologyId: topology.id,
              realmId: ctx.realm?.id ?? '',
              tenantId: topology.tenantId,
              orgAlias: alias,
              orgName: `tenant ${topology.tenantId} (technical)`,
              externalOrganizationId: observation.externalId,
              technicalPurpose: 'tenant-identity-infrastructure',
              status: 'READY',
              workflowId: input.workflowId ?? null,
              evidence: { preexisting: observation.exists },
            }));
          await deps.repo.createResourceReference({
            topologyId: topology.id,
            tenantId: topology.tenantId,
            resourceKind: 'ORGANIZATION',
            internalRef: orgRow.id,
            externalId: observation.externalId ?? alias,
            externalKind: 'KEYCLOAK',
            verified: observation.exists,
            verifiedAt: observation.exists ? new Date() : null,
          }).catch(() => undefined);
          await deps.repo
            .updateTopology(
              topology.id,
              { organizationRef: orgRow.id, externalOrganizationId: observation.externalId },
              (await deps.repo.getTopology(topology.id))?.version ?? 0,
              actorId,
            )
            .catch(() => undefined);
          await recordEvidence(
            topologyId,
            tenantId,
            input,
            'provision_organization',
            'SUCCEEDED',
            { alias, externalOrganizationId: observation.externalId, preexisting: observation.exists },
            startedAt,
          );
          return ok({ organizationId: orgRow.id, alias, externalOrganizationId: observation.externalId });
        }

        // -----------------------------------------------------------------
        // 4) OIDC discovery + validation (SSRF-guarded against registered origin)
        // -----------------------------------------------------------------
        case 'keycloak.configure_oidc': {
          const ctx = await loadTopologyContext(s);
          if (!ctx?.topology || !ctx.realm) return fail(KeycloakErrorCode.VALIDATION, 'Realm not provisioned');
          const oidcDenied = await beforeMutation({
            input,
            s,
            topology: ctx.topology,
            tenantId,
            topologyId,
            operation: 'configure_oidc',
            startedAt,
          });
          if (oidcDenied) return oidcDenied;
          const conn = await connectionFor(ctx.topology.serverId);
          const doc = await deps.provider.getOpenidConfiguration(conn, ctx.realm.realmName);
          const issuer = str(doc.issuer);
          const tokenEndpoint = str(doc.token_endpoint);
          const jwksUri = str(doc.jwks_uri);
          if (!issuer || !tokenEndpoint || !jwksUri) {
            await recordEvidence(
              topologyId, tenantId, input, 'configure_oidc', 'FAILED',
              { missing: ['issuer', 'token_endpoint', 'jwks_uri'].filter((f) => !doc[f]) },
              startedAt,
              { code: KeycloakErrorCode.DISCOVERY_INVALID, message: 'Discovery document incomplete' },
            );
            return fail(KeycloakErrorCode.DISCOVERY_INVALID, 'OIDC discovery document incomplete');
          }
          // Issuer coherence with registered origin (anti-SSRF / anti-redirect).
          const expectedPrefix = conn.baseUrl.replace(/\/$/, '');
          if (!issuer.startsWith(`${expectedPrefix}/realms/`)) {
            return fail(
              KeycloakErrorCode.DISCOVERY_INVALID,
              `OIDC issuer "${issuer}" does not belong to the registered server`,
            );
          }
          // AUD-P1-01: reject discovery JWKS/token endpoints outside registered origin.
          try {
            const expectedOrigin = new URL(conn.baseUrl).origin;
            if (new URL(jwksUri).origin !== expectedOrigin || new URL(tokenEndpoint).origin !== expectedOrigin) {
              return fail(
                KeycloakErrorCode.DISCOVERY_INVALID,
                'OIDC jwks_uri/token_endpoint must share the registered Keycloak origin',
              );
            }
          } catch {
            return fail(KeycloakErrorCode.DISCOVERY_INVALID, 'OIDC discovery URLs malformed');
          }

          const existing = await deps.repo.getOidcConfiguration(ctx.topology.id);
          const oidc =
            existing ??
            (await deps.repo.createOidcConfiguration({
              id: randomUUID(),
              topologyId: ctx.topology.id,
              realmId: ctx.realm.id,
              tenantId: ctx.topology.tenantId,
              issuer,
              authorizationEndpoint: str(doc.authorization_endpoint) ?? null,
              tokenEndpoint,
              jwksUri,
              userinfoEndpoint: str(doc.userinfo_endpoint) ?? null,
              endSessionEndpoint: str(doc.end_session_endpoint) ?? null,
              supportedScopes: Array.isArray(doc.scopes_supported) ? doc.scopes_supported.map(String) : [],
              supportedResponseTypes: Array.isArray(doc.response_types_supported)
                ? doc.response_types_supported.map(String)
                : [],
              supportedSigningAlgs: Array.isArray(doc.id_token_signing_alg_values_supported)
                ? doc.id_token_signing_alg_values_supported.map(String)
                : [],
              discoveryDocument: redactSecrets(doc),
              discoveryValidated: true,
              jwksValidated: false,
              validatedAt: new Date(),
              status: 'VERIFYING',
            }));
          if (existing) {
            const updated = await deps.repo.updateOidcConfiguration(existing.id, {
              discoveryDocument: redactSecrets(doc),
              discoveryValidated: true,
              validatedAt: new Date(),
              status: 'VERIFYING',
              authorizationEndpoint: str(doc.authorization_endpoint) ?? null,
              tokenEndpoint,
              jwksUri,
            });
            await deps.repo.updateTopology(
              ctx.topology.id,
              { oidcConfigurationRef: updated.id },
              (await deps.repo.getTopology(ctx.topology.id))?.version ?? 0,
              actorId,
            ).catch(() => undefined);
          } else {
            await deps.repo
              .updateTopology(
                ctx.topology.id,
                { oidcConfigurationRef: oidc.id },
                (await deps.repo.getTopology(ctx.topology.id))?.version ?? 0,
                actorId,
              )
              .catch(() => undefined);
          }
          await recordEvidence(
            topologyId, tenantId, input, 'configure_oidc', 'SUCCEEDED',
            { issuer, discoveryValidated: true, scopes: doc.scopes_supported },
            startedAt,
          );
          return ok({ issuer, oidcConfigurationId: oidc.id, discoveryValidated: true });
        }

        // -----------------------------------------------------------------
        // 5) Technical client (contract-driven, strict redirect/origin policy)
        // -----------------------------------------------------------------
        case 'keycloak.create_technical_client': {
          const ctx = await loadTopologyContext(s);
          if (!ctx?.topology || !ctx.realm) return fail(KeycloakErrorCode.VALIDATION, 'Realm not provisioned');
          if (ctx.topology.topologyType === KeycloakTopologyType.EXTERNAL_SPECIFIC) {
            await recordEvidence(
              topologyId, tenantId, input, 'create_technical_client', 'SKIPPED',
              { reason: 'EXTERNAL_SPECIFIC topology — client contract handled by certified adapter' },
              startedAt,
            );
            return ok({ skipped: true, topologyType: ctx.topology.topologyType });
          }
          const meta = (ctx.topology.metadata ?? {}) as Record<string, unknown>;
          const profileOptions = (meta.profileOptions ?? {}) as Record<string, unknown>;
          const declared = Array.isArray(profileOptions.clientSpecs)
            ? (profileOptions.clientSpecs as Record<string, unknown>[])
            : [];
          if (declared.length === 0) {
            // No declared client in the contract → create none (mandate §9: no arbitrary clients).
            await recordEvidence(
              topologyId, tenantId, input, 'create_technical_client', 'SKIPPED',
              { reason: 'no technical client declared by deployment contract' },
              startedAt,
            );
            return ok({ skipped: true, reason: 'no-declared-client' });
          }

          const conn = await connectionFor(ctx.topology.serverId);
          // P7.1 + P7.4 before any client work (state writes + provider calls).
          const clientEntryDenied = await beforeMutation({
            input,
            s,
            topology: ctx.topology,
            tenantId,
            topologyId,
            operation: 'create_technical_client',
            startedAt,
          });
          if (clientEntryDenied) return clientEntryDenied;
          const created: Array<{ clientId: string; externalId: string; secretRef: string | null }> = [];
          for (const spec of declared) {
            const clientId = str(spec.clientId);
            const kind = (str(spec.clientKind) ?? 'CONFIDENTIAL') as
              | 'CONFIDENTIAL'
              | 'PUBLIC'
              | 'SERVICE_ACCOUNT';
            const redirectUris = Array.isArray(spec.redirectUris) ? spec.redirectUris.map(String) : [];
            const webOrigins = Array.isArray(spec.webOrigins) ? spec.webOrigins.map(String) : [];
            const issues = [
              ...validateRedirectUris(redirectUris),
              ...validateWebOrigins(webOrigins),
            ];
            if (!clientId) issues.push('clientId missing');
            if (issues.length) {
              await recordEvidence(
                topologyId, tenantId, input, 'create_technical_client', 'FAILED',
                { clientId, issues }, startedAt,
                { code: KeycloakErrorCode.VALIDATION, message: issues.join('; ') },
              );
              return fail(KeycloakErrorCode.VALIDATION, `Client policy violation: ${issues.join('; ')}`);
            }
            if (!Object.values(KeycloakClientKind).includes(kind as KeycloakClientKind)) {
              return fail(KeycloakErrorCode.VALIDATION, `Unknown client kind ${kind}`);
            }
            if (!clientId) {
              // Narrowing guard (clientId checked above via issues, made explicit for TS).
              return fail(KeycloakErrorCode.VALIDATION, 'clientId missing');
            }

            const existing = (await deps.repo.listClients(ctx.topology.id)).find(
              (c) => c.clientId === clientId,
            );
            if (existing?.complianceStatus === 'NON_COMPLIANT') {
              return fail(KeycloakErrorCode.VALIDATION, `Client ${clientId} is NON_COMPLIANT`);
            }

            // Fresh P7.1 + P7.4 validation IMMEDIATELY before the external call.
            const clientDenied = await beforeMutation({
              input,
              s,
              topology: ctx.topology,
              tenantId,
              topologyId,
              operation: 'create_technical_client',
              startedAt,
            });
            if (clientDenied) return clientDenied;
            // REAL Keycloak create (idempotent).
            const res = await deps.provider.createTechnicalClient(conn, ctx.realm.realmName, {
              clientId,
              clientKind: kind,
              ownerFunction: String(spec.ownerFunction ?? 'technical'),
              redirectUris,
              webOrigins,
              scopes: Array.isArray(spec.scopes) ? spec.scopes.map(String) : [],
            });

            // Secret → external vault ONLY (never PostgreSQL plaintext).
            let secretRef: string | null = existing?.secretCredentialRef ?? null;
            if (res.clientSecret && !secretRef) {
              const stored = await deps.secrets.put({
                kind: 'keycloak-client-secret',
                material: { value: res.clientSecret },
              });
              secretRef = stored.credentialRef;
            }

            const row =
              existing ??
              (await deps.repo.createClient({
                id: randomUUID(),
                topologyId: ctx.topology.id,
                realmId: ctx.realm.id,
                tenantId: ctx.topology.tenantId,
                clientId,
                clientUuid: res.observation.externalId,
                clientKind: kind,
                ownerFunction: String(spec.ownerFunction ?? 'technical'),
                documentedUsage: String(spec.usage ?? 'declared in P7.2 deployment contract'),
                redirectUris,
                webOrigins,
                scopes: Array.isArray(spec.scopes) ? spec.scopes.map(String) : [],
                secretCredentialRef: secretRef,
                secretRotatedAt: new Date(),
                standardFlowEnabled: true,
                directAccessGrantsEnabled: false,
                serviceAccountsEnabled: kind === 'SERVICE_ACCOUNT' || kind === 'CONFIDENTIAL',
                pkceRequired: true,
                complianceStatus: 'COMPLIANT',
                status: 'READY',
                workflowId: input.workflowId ?? null,
                evidence: { preexisting: res.observation.exists },
              }));
            if (existing && secretRef && existing.secretCredentialRef !== secretRef) {
              await deps.repo.updateClient(
                row.id,
                { secretCredentialRef: secretRef, secretRotatedAt: new Date() },
                row.version,
              );
            }

            created.push({ clientId, externalId: res.observation.externalId ?? '', secretRef });
          }
          await recordEvidence(
            topologyId, tenantId, input, 'create_technical_client', 'SUCCEEDED',
            { clients: created.map((c) => ({ clientId: c.clientId, externalId: c.externalId })) },
            startedAt,
          );
          return ok({ clients: created });
        }

        // -----------------------------------------------------------------
        // 6) Verification of what REALLY exists
        // -----------------------------------------------------------------
        case 'keycloak.verify_topology': {
          const ctx = await loadTopologyContext(s);
          if (!ctx?.topology || !ctx.realm) return fail(KeycloakErrorCode.VALIDATION, 'Realm not provisioned');
          const verifyDenied = await beforeMutation({
            input,
            s,
            topology: ctx.topology,
            tenantId,
            topologyId,
            operation: 'verify_topology',
            startedAt,
          });
          if (verifyDenied) return verifyDenied;
          const conn = await connectionFor(ctx.topology.serverId);
          const observedRealm = await deps.provider.realmExists(conn, ctx.realm.realmName);

          if (!observedRealm.exists) {
            await recordEvidence(
              topologyId, tenantId, input, 'verify_topology', 'FAILED',
              { realmExists: false },
              startedAt,
              { code: KeycloakErrorCode.RESOURCE_MISSING, message: 'Realm missing on server' },
            );
            await deps.repo.updateTopology(
              ctx.topology.id,
              { status: KeycloakTopologyStatus.FAILED, statusReason: 'realm-missing-verification' },
              (await deps.repo.getTopology(ctx.topology.id))?.version ?? 0,
              actorId,
            ).catch(() => undefined);
            return fail(KeycloakErrorCode.RESOURCE_MISSING, 'Realm does not exist on the server');
          }

          const clients = await deps.repo.listClients(ctx.topology.id);
          const oidc = await deps.repo.getOidcConfiguration(ctx.topology.id);
          let jwksValidated = false;
          if (oidc && oidc.jwksUri) {
            try {
              // AUD-P1-01: JWKS fetch must stay on the registered Keycloak origin (anti-SSRF).
              const expectedOrigin = new URL(conn.baseUrl).origin;
              const jwksOrigin = new URL(oidc.jwksUri).origin;
              if (jwksOrigin !== expectedOrigin) {
                jwksValidated = false;
              } else {
                const res = await fetch(oidc.jwksUri);
                if (res.ok) {
                  const jwks = (await res.json()) as { keys?: unknown[] };
                  jwksValidated = Array.isArray(jwks.keys) && jwks.keys.length > 0;
                }
              }
            } catch {
              jwksValidated = false;
            }
          }
          if (oidc) {
            await deps.repo.updateOidcConfiguration(oidc.id, {
              jwksValidated,
              status: jwksValidated && oracleValid(oidc) ? 'READY' : 'DEGRADED',
              validatedAt: new Date(),
            });
          }

          // Success = realm + verified discovery/JWKS (declared clients remain unchanged).
          const ready = Boolean(observedRealm.exists && jwksValidated);
          const current = (await deps.repo.getTopology(ctx.topology.id)) ?? ctx.topology;
          await deps.repo.updateTopology(
            ctx.topology.id,
            ready
              ? {
                  status: KeycloakTopologyStatus.READY,
                  statusReason: null,
                  appliedConfigVersion: current.desiredConfigVersion,
                  resourceFingerprint: observedRealm.fingerprint ?? current.resourceFingerprint,
                  lastHealthCheckAt: new Date(),
                }
              : { status: KeycloakTopologyStatus.DEGRADED, statusReason: 'jwks-unverified' },
            current.version,
            actorId,
          );

          await recordEvidence(
            topologyId, tenantId, input, 'verify_topology',
            ready ? 'SUCCEEDED' : 'FAILED',
            {
              realmExists: true,
              jwksValidated,
              discoveryValidated: oidc?.discoveryValidated ?? false,
              declaredClients: clients.length,
            },
            startedAt,
            ready ? undefined : { code: KeycloakErrorCode.RESOURCE_MISSING, message: 'JWKS unverified' },
          );
          if (!ready) return fail(KeycloakErrorCode.RESOURCE_MISSING, 'Topology verification failed (JWKS)');
          return ok({ realmExists: true, jwksValidated, clients: clients.length });
        }

        // -----------------------------------------------------------------
        // 7) Reconciliation (drift detection, never blind deletion)
        // -----------------------------------------------------------------
        case 'keycloak.reconcile_topology': {
          const ctx = await loadTopologyContext(s);
          if (!ctx?.topology || !ctx.realm) return fail(KeycloakErrorCode.VALIDATION, 'Realm not provisioned');

          // Reconciliation is a protected boundary: fresh lease + P7.1 first.
          const reconcileEntryDenied = await beforeMutation({
            input,
            s,
            topology: ctx.topology,
            tenantId,
            topologyId,
            operation: 'reconcile',
            startedAt,
          });
          if (reconcileEntryDenied) return reconcileEntryDenied;

          const conn = await connectionFor(ctx.topology.serverId);
          const observedRealm = await deps.provider.realmExists(conn, ctx.realm.realmName);
          const clients = await deps.repo.listClients(ctx.topology.id);
          const observedClients: Array<{ clientId: string; exists: boolean }> = [];
          for (const c of clients) {
            const o = await deps.provider.clientExists(conn, ctx.realm.realmName, c.clientId);
            observedClients.push({ clientId: c.clientId, exists: o.exists });
          }
          const allClientsExist = observedClients.every((c) => c.exists);
          const orgNeeded = ctx.topology.topologyType === KeycloakTopologyType.SHARED_REALM_ORGANIZATIONS;
          const observedOrg =
            orgNeeded && ctx.org
              ? existsOrg(await deps.provider.organizationExists(conn, ctx.realm.realmName, ctx.org.orgAlias))
              : true;

          // ALLOWED-settings drift (external modification of a managed setting).
          const desiredSettings = desiredRealmSettings(ctx.realm, ctx.topology.metadata);
          const settingsDrift = observedRealm.exists
            ? diffRealmSettings(desiredSettings, observedRealm.settings ?? {})
            : [];

          const driftDetails: Array<Record<string, unknown>> = [];
          if (!observedRealm.exists) {
            driftDetails.push({ kind: 'REALM_MISSING', expected: ctx.realm.realmName });
          }
          if (!allClientsExist) {
            driftDetails.push({ kind: 'CLIENTS_MISSING', missing: observedClients.filter((c) => !c.exists) });
          }
          if (!observedOrg) driftDetails.push({ kind: 'ORGANIZATION_MISSING' });
          if (settingsDrift.length) {
            driftDetails.push({ kind: 'REALM_SETTINGS_DRIFT', fields: settingsDrift });
          }
          const driftDetected = driftDetails.length > 0;
          const classification = !observedRealm.exists
            ? 'CRITICAL'
            : driftDetected
              ? 'CONFIGURATION'
              : 'NONE';

          const run = await deps.repo.createReconciliationRun({
            topologyId: ctx.topology.id,
            tenantId: ctx.topology.tenantId,
            workflowId: input.workflowId ?? null,
            trigger: 'WORKFLOW',
            observedState: {
              realmExists: observedRealm.exists,
              realmFingerprint: observedRealm.fingerprint,
              clients: observedClients,
              organizationsEnabled: observedOrg,
              observedSettings: observedRealm.settings ?? null,
              desiredSettings,
              settingsDrift,
            },
            driftDetected,
            driftClassification: driftDetected ? classification : null,
            driftDetails,
            actionTaken: driftDetected ? 'QUARANTINE_OR_SCHEDULE' : 'NONE',
            outcome: 'PENDING',
          });

          const current = (await deps.repo.getTopology(ctx.topology.id)) ?? ctx.topology;
          if (driftDetected && !observedRealm.exists) {
            // Realm deleted outside Edge → QUARANTINE (never auto-recreate/delete).
            await deps.repo.updateTopology(
              ctx.topology.id,
              {
                status: KeycloakTopologyStatus.QUARANTINED,
                statusReason: 'realm-missing-outside-edge',
                lastReconciliationAt: new Date(),
              },
              current.version + 1,
              actorId,
            );
            await deps.repo.completeReconciliationRun(run.id, {
              outcome: 'QUARANTINED',
              completedAt: new Date(),
            });
            await recordEvidence(
              topologyId, tenantId, input, 'reconcile', 'FAILED',
              { driftDetails },
              startedAt,
              { code: KeycloakErrorCode.DRIFT_DETECTED, message: 'realm missing outside Edge' },
            );
            return fail(KeycloakErrorCode.DRIFT_DETECTED, 'Realm deleted outside Edge — quarantined', false);
          }

          // Remediation of ALLOWED settings drift only — guarded immediately
          // before the external write, and NEVER a recreate/delete of the realm.
          let remediatedSettings: Array<{ field: string; desired: unknown; observed: unknown }> = [];
          if (settingsDrift.length) {
            const remediateDenied = await beforeMutation({
              input,
              s,
              topology: ctx.topology,
              tenantId,
              topologyId,
              operation: 'reconcile:remediate_settings',
              startedAt,
            });
            if (remediateDenied) return remediateDenied;
            try {
              await deps.provider.updateRealmSettings(conn, ctx.realm.realmName, desiredSettings);
            } catch (err) {
              const message = err instanceof Error ? err.message : String(err);
              await deps.repo.completeReconciliationRun(run.id, {
                outcome: 'FAILED',
                completedAt: new Date(),
              });
              await recordEvidence(
                topologyId, tenantId, input, 'reconcile', 'FAILED',
                { driftDetails, remediation: 'settings', error: message },
                startedAt,
                { code: KeycloakErrorCode.DRIFT_DETECTED, message: 'settings remediation failed' },
              );
              return fail(KeycloakErrorCode.DRIFT_DETECTED, `Settings remediation failed: ${message}`, true);
            }
            const reobserved = await deps.provider.realmExists(conn, ctx.realm.realmName);
            remediatedSettings = diffRealmSettings(desiredSettings, reobserved.settings ?? {});
          }

          const residualDrift = [
            ...(observedRealm.exists ? [] : [{ kind: 'REALM_MISSING' }]),
            ...(allClientsExist ? [] : [{ kind: 'CLIENTS_MISSING' }]),
            ...(observedOrg ? [] : [{ kind: 'ORGANIZATION_MISSING' }]),
            ...(remediatedSettings.length
              ? [{ kind: 'REALM_SETTINGS_DRIFT', fields: remediatedSettings }]
              : []),
          ];
          const cleanAfterRemediation = residualDrift.length === 0;

          if (settingsDrift.length && cleanAfterRemediation) {
            const after = (await deps.repo.getTopology(ctx.topology.id)) ?? current;
            await deps.repo.updateTopology(
              ctx.topology.id,
              {
                status:
                  after.status === KeycloakTopologyStatus.RECONCILIATION_REQUIRED ||
                  after.status === KeycloakTopologyStatus.DEGRADED
                    ? KeycloakTopologyStatus.READY
                    : after.status,
                statusReason: null,
                lastReconciliationAt: new Date(),
              },
              after.version,
              actorId,
            );
            await deps.repo.completeReconciliationRun(run.id, {
              outcome: 'REMEDIATED',
              actionTaken: 'REMEDIATE_SETTINGS',
              completedAt: new Date(),
            });
            await recordEvidence(
              topologyId, tenantId, input, 'reconcile', 'SUCCEEDED',
              { driftDetected: true, classification, driftDetails, remediated: true, settingsDrift },
              startedAt,
            );
            return ok({
              driftDetected: true,
              remediated: true,
              settingsDrift: settingsDrift.map((d) => d.field),
              reconciliationId: run.id,
            });
          }

          if (driftDetected) {
            const after = (await deps.repo.getTopology(ctx.topology.id)) ?? current;
            await deps.repo.updateTopology(
              ctx.topology.id,
              { status: KeycloakTopologyStatus.RECONCILIATION_REQUIRED, statusReason: classification, lastReconciliationAt: new Date() },
              after.version,
              actorId,
            );
            await deps.repo.completeReconciliationRun(run.id, {
              outcome: 'FAILED',
              completedAt: new Date(),
            });
          } else {
            const after = (await deps.repo.getTopology(ctx.topology.id)) ?? current;
            if (after.status === KeycloakTopologyStatus.DEGRADED) {
              await deps.repo.updateTopology(
                ctx.topology.id,
                { status: KeycloakTopologyStatus.READY, statusReason: null, lastReconciliationAt: new Date() },
                after.version,
                actorId,
              );
            } else {
              await deps.repo.updateTopology(
                ctx.topology.id,
                { lastReconciliationAt: new Date() },
                after.version,
                actorId,
              );
            }
            await deps.repo.completeReconciliationRun(run.id, {
              outcome: 'NO_DRIFT',
              completedAt: new Date(),
            });
          }
          await recordEvidence(
            topologyId, tenantId, input, 'reconcile', driftDetected ? 'FAILED' : 'SUCCEEDED',
            { driftDetected, classification, driftDetails },
            startedAt,
            driftDetected
              ? { code: KeycloakErrorCode.DRIFT_DETECTED, message: classification }
              : undefined,
          );
          if (driftDetected && !observedRealm.exists) return fail(KeycloakErrorCode.DRIFT_DETECTED, 'drift');
          if (driftDetected) return fail(KeycloakErrorCode.DRIFT_DETECTED, 'drift detected', true);
          return ok({ driftDetected: false, reconciliationId: run.id });
        }

        // -----------------------------------------------------------------
        // 8) Deprovision (destructive, approval-gated via WAITING_APPROVAL)
        // -----------------------------------------------------------------
        case 'keycloak.deprovision_topology': {
          const ctx = await loadTopologyContext(s);
          if (!ctx?.topology) return fail(KeycloakErrorCode.VALIDATION, 'Topology not found');
          const authorized = s.deprovisionAuthorized === true && s.deprovisionConfirmed === true;
          if (!authorized) {
            return {
              status: 'WAITING_APPROVAL',
              instructions:
                'Deprovisioning requires explicit authorization + confirmation (ownership check + retention policy)',
              requiredPermission: 'platform:keycloak:deprovision',
            };
          }
          if (ctx.topology.deletionProtection && !authorized) {
            return fail(KeycloakErrorCode.DEPROVISION_FORBIDDEN, 'Deletion protection active');
          }
          // Compensation boundary: repeat the P7.4 lease + P7.1 checks before
          // any state transition triggered by a compensation.
          const depDenied = await beforeMutation({
            input,
            s,
            topology: ctx.topology,
            tenantId,
            topologyId,
            operation: 'deprovision',
            startedAt,
          });
          if (depDenied) return depDenied;
          await recordEvidence(
            topologyId, tenantId, input, 'deprovision', 'SKIPPED',
            { note: 'deprovisioning authorized; realm deletion deferred to retention policy' },
            startedAt,
          );
          const current = (await deps.repo.getTopology(ctx.topology.id)) ?? ctx.topology;
          await deps.repo.updateTopology(
            ctx.topology.id,
            { status: KeycloakTopologyStatus.DEPROVISIONING_PENDING },
            current.version,
            actorId,
          );
          return ok({ topologyId: ctx.topology.id, state: 'DEPROVISIONING_PENDING' });
        }

        default:
          return fail(
            KeycloakErrorCode.OPERATION_NOT_IMPLEMENTED,
            `Unhandled Keycloak handler ${key}`,
          );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // Record failure evidence when we know the topology (idempotent, best-effort).
      if (topologyId) {
        await deps.repo
          .createEvidence({
            topologyId,
            tenantId,
            workflowId: input.workflowId ?? null,
            stepKey: input.stepKey ?? null,
            operation: key,
            outcome: 'FAILED',
            evidence: {},
            errorCode: KeycloakErrorCode.DEPENDENCY_UNAVAILABLE,
            errorMessage: redactSensitive(message),
            durationMs: Date.now() - startedAt,
            performedBy: input.workerId ?? null,
          })
          .catch(() => undefined);
      }
      const classified =
        message.includes('timeout') || message.includes('Timeout')
          ? KeycloakErrorCode.TIMEOUT
          : message.includes('SSRF') || message.includes('escapes registered')
            ? KeycloakErrorCode.SSRF_BLOCKED
            : KeycloakErrorCode.DEPENDENCY_UNAVAILABLE;
      return fail(classified, message, true);
    }
  };
}

function oracleValid(oidc: { discoveryValidated: boolean; jwksValidated: boolean }): boolean {
  return oidc.discoveryValidated;
}
function existsOrg(o: { exists: boolean }): boolean {
  return o.exists;
}

/**
 * Desired realm settings = persisted realm row (what Edge believes is applied)
 * overridden by the authorized deployment-contract settings. Used by
 * reconciliation to detect EXTERNAL drift on ALLOWED settings only.
 */
function desiredRealmSettings(
  realm: {
    sslRequired: string;
    ssoSessionIdleSeconds: number;
    ssoSessionMaxSeconds: number;
    accessTokenLifespanSeconds: number;
    passwordPolicy: string | null;
    revokeRefreshToken: boolean;
    refreshTokenMaxReuse: number;
  },
  metadata: Record<string, unknown>,
): Record<string, unknown> {
  const meta = (
    typeof metadata.realmSettings === 'object' && metadata.realmSettings
      ? metadata.realmSettings
      : {}
  ) as Record<string, unknown>;
  const pick = (...candidates: unknown[]): unknown =>
    candidates.find((c) => c !== undefined && c !== null);
  return {
    sslRequired: String(pick(meta.sslRequired, realm.sslRequired)),
    ssoSessionIdleTimeout: Number(
      pick(meta.ssoSessionIdleTimeout, meta.ssoSessionIdle, realm.ssoSessionIdleSeconds),
    ),
    ssoSessionMaxLifespan: Number(
      pick(meta.ssoSessionMaxLifespan, meta.ssoSessionMax, realm.ssoSessionMaxSeconds),
    ),
    accessTokenLifespan: Number(pick(meta.accessTokenLifespan, realm.accessTokenLifespanSeconds)),
    passwordPolicy: pick(meta.passwordPolicy, realm.passwordPolicy) ?? null,
    revokeRefreshToken: Boolean(pick(meta.revokeRefreshToken, realm.revokeRefreshToken)),
    refreshTokenMaxReuse: Number(pick(meta.refreshTokenMaxReuse, realm.refreshTokenMaxReuse)),
  };
}

function settingsEqual(field: string, want: unknown, got: unknown): boolean {
  if (field === 'passwordPolicy') {
    const norm = (v: unknown) => (typeof v === 'string' && v.trim() ? v : null);
    return norm(want) === norm(got);
  }
  if (typeof want === 'number') return Number(want) === Number(got);
  if (typeof want === 'boolean') return Boolean(got) === want;
  return String(want) === String(got);
}

/**
 * Compare desired vs observed settings. Fields the server does not expose
 * (`undefined`) are not comparable and never produce false drift.
 */
function diffRealmSettings(
  desired: Record<string, unknown>,
  observed: Record<string, unknown>,
): Array<{ field: string; desired: unknown; observed: unknown }> {
  const drift: Array<{ field: string; desired: unknown; observed: unknown }> = [];
  for (const [field, want] of Object.entries(desired)) {
    const got = observed[field];
    if (want === undefined || got === undefined) continue;
    if (!settingsEqual(field, want, got)) drift.push({ field, desired: want, observed: got });
  }
  return drift;
}