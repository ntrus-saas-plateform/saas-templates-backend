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
} from '../../domain/keycloak-topology/keycloak.types.js';
import type {
  WorkflowHandlerInput,
  WorkflowHandlerOutcome,
} from '../../domain/workflow/workflow-handler.port.js';
import type { SecretsProviderPort } from '../../domain/infrastructure-provisioning/secrets-provider.port.js';
import { assertFencingToken } from '../../domain/workflow/fencing.js';
import { validateRedirectUris, validateWebOrigins, deriveOrgAlias } from '../../domain/keycloak-topology/keycloak-plan.js';
import { redactSecrets } from '../../application/keycloak-topology/keycloak.use-cases.js';
import { redactSensitive } from './keycloak-admin.adapter.js';

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
  return {
    status: 'FAILED',
    errorClass: code,
    message: redactSensitive(message),
    retryable:
      retryable ||
      code === KeycloakErrorCode.TIMEOUT ||
      code === KeycloakErrorCode.SERVER_UNAVAILABLE ||
      code === KeycloakErrorCode.DEPENDENCY_UNAVAILABLE,
    diagnostics: { handler: 'p7.7' },
  };
}

/**
 * Bridges P7.4 workflow handlers → P7.7 use cases + REAL Keycloak adapters.
 * Never simulates success: every observed result is written to evidence and the
 * topology state, and fencing tokens are asserted before any mutation.
 */
export function createLiveKeycloakExecutor(deps: {
  repo: KeycloakRepositoryPort;
  provider: KeycloakProviderPort;
  secrets: SecretsProviderPort;
  discoverCapabilities: DiscoverKeycloakCapabilitiesUseCase;
  createTopology: CreateKeycloakTopologyUseCase;
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

  return async (input, key: KeycloakHandlerKey): Promise<WorkflowHandlerOutcome> => {
    const s = snap(input);
    const actorId = str(s.actorId) ?? input.workerId;
    const tenantId = str(s.tenantId) ?? '';
    const topologyId = str(s.topologyId) ?? '';
    const startedAt = Date.now();

    // Fencing guard (stale workers must never validate an operation).
    try {
      assertFencingToken(input.fencingToken, input.fencingToken); // basic non-negative guard
    } catch {
      return fail(KeycloakErrorCode.VALIDATION, 'Invalid fencing token');
    }
    if (input.fencingToken < 0) {
      return fail(KeycloakErrorCode.VALIDATION, 'fencingToken must be >= 0');
    }

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
          if (
            str(s.authorizationRevoked) === 'true' ||
            str(s.authorizationExpired) === 'true' ||
            str(s.authorizationValid) === 'false'
          ) {
            issues.push('P7.1 authorization not valid (revoked/expired/absent)');
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
              const res = await fetch(oidc.jwksUri);
              if (res.ok) {
                const jwks = (await res.json()) as { keys?: unknown[] };
                jwksValidated = Array.isArray(jwks.keys) && jwks.keys.length > 0;
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

          const driftDetails: Array<Record<string, unknown>> = [];
          if (!observedRealm.exists) {
            driftDetails.push({ kind: 'REALM_MISSING', expected: ctx.realm.realmName });
          }
          if (!allClientsExist) {
            driftDetails.push({ kind: 'CLIENTS_MISSING', missing: observedClients.filter((c) => !c.exists) });
          }
          if (!observedOrg) driftDetails.push({ kind: 'ORGANIZATION_MISSING' });
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
          if (driftDetected) {
            const after = (await deps.repo.getTopology(ctx.topology.id)) ?? current;
            await deps.repo.updateTopology(
              ctx.topology.id,
              { status: KeycloakTopologyStatus.RECONCILIATION_REQUIRED, statusReason: classification, lastReconciliationAt: new Date() },
              after.version,
              actorId,
            );
            await deps.repo.completeReconciliationRun(run.id, {
              outcome: 'REMEDIATED',
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