import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import type { ExperienceLiveExecutor } from '../../domain/product-experience/experience-handlers.js';
import type { ExperienceRepositoryPort } from '../../domain/product-experience/experience-repository.port.js';
import {
  assertRedirectsBoundToDomains,
  checksumManifest,
  issueOwnershipToken,
  validateHostname,
  validateRedirectUris,
  validateWebOrigins,
} from '../../domain/product-experience/experience-access.policy.js';
import {
  ApplicationBindingStatus,
  ApplicationStatus,
  ClientRegistrationStatus,
  DnsStatus,
  DomainBindingStatus,
  DomainKind,
  DomainOwnershipStatus,
  ExperienceAssignmentStatus,
  ExperienceErrorCode,
  ExperienceProfileStatus,
  ExperienceVersionStatus,
  RouteStatus,
  TlsStatus,
  type ExperienceHandlerKey,
  type TenantExperienceAssignmentRecord,
} from '../../domain/product-experience/experience.types.js';
import type { SecretsProviderPort } from '../../domain/infrastructure-provisioning/secrets-provider.port.js';
import type {
  WorkflowAuthorizationPort,
  WorkflowReadyAuthorizationView,
} from '../../domain/workflow/workflow-authorization.port.js';
import type {
  LeaseValidationResult,
  WorkflowLeasePort,
} from '../../domain/workflow/workflow-lease.port.js';
import type {
  WorkflowHandlerInput,
  WorkflowHandlerOutcome,
} from '../../domain/workflow/workflow-handler.port.js';

const AUTHORIZATION_TIMEOUT_MS = 5_000;

const PLAINTEXT_SECRET_KEYS = [
  'secret',
  'password',
  'token',
  'clientSecret',
  'client_secret',
  'apiKey',
  'api_key',
  'privateKey',
  'private_key',
  'credential',
  'adminCredential',
];

/** Strip accidental secret-bearing fields; keep opaque credential_ref handles. */
function redactExperienceSecrets<T>(value: T): T {
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, raw] of Object.entries(v as Record<string, unknown>)) {
        const lower = k.toLowerCase();
        if (lower === 'credentialref' || lower === 'credential_ref' || lower === 'certificateref' || lower === 'certificate_ref') {
          out[k] = raw;
          continue;
        }
        if (PLAINTEXT_SECRET_KEYS.some((s) => lower.includes(s.toLowerCase()))) {
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

function hasPlaintextSecretFields(obj: Record<string, unknown>): boolean {
  for (const key of Object.keys(obj)) {
    const lower = key.toLowerCase();
    if (lower === 'credentialref' || lower === 'credential_ref') continue;
    if (PLAINTEXT_SECRET_KEYS.some((s) => lower === s.toLowerCase() || lower.includes(s.toLowerCase()))) {
      const val = obj[key];
      if (val != null && val !== '') return true;
    }
  }
  return false;
}

function snap(input: WorkflowHandlerInput): Record<string, unknown> {
  return { ...input.workflowInput, ...input.inputSnapshot, ...(input.executionContext ?? {}) };
}
function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v : undefined;
}
function intOf(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value)) return value;
  if (typeof value === 'string' && value.trim() && Number.isInteger(Number(value))) {
    return Number(value);
  }
  return null;
}

function ok(output: Record<string, unknown> = {}): WorkflowHandlerOutcome {
  return { status: 'SUCCEEDED', outputSnapshot: output };
}
function fail(
  code: ExperienceErrorCode | string,
  message: string,
  retryable = false,
): WorkflowHandlerOutcome {
  return {
    status: 'FAILED',
    errorClass: code,
    message,
    retryable,
    diagnostics: { handler: 'p7.9', message },
  };
}

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

type ManifestApp = { applicationId: string; applicationVersion: number };
type ManifestClient = {
  clientId: string;
  clientKind: string;
  redirectUris?: string[];
  webOrigins?: string[];
  scopes?: string[];
  audiences?: string[];
  postLogoutRedirectUris?: string[];
  credentialRef?: string | null;
  applicationBindingId?: string | null;
  [key: string]: unknown;
};
type ManifestDomain = {
  hostname: string;
  domainKind: string;
  platformAttested?: boolean;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
};

/**
 * Bridges P7.4 workflow handlers → P7.9 local experience registry apply.
 *
 * Security invariants:
 *  - P7.1 authorization is REVALIDATED fail-closed before every mutation.
 *  - P7.4 fencing/lease is validated when a lease port is wired.
 *  - Evidence is durable and redacted (credential_ref only, never plaintext).
 *  - Technical OIDC client registry only — NO business IAM.
 */
export function createLiveExperienceExecutor(deps: {
  repo: ExperienceRepositoryPort;
  authorization: WorkflowAuthorizationPort;
  lease?: WorkflowLeasePort | null;
  secrets?: SecretsProviderPort | null;
}): ExperienceLiveExecutor {
  void deps.secrets;

  const validateLease = async (input: WorkflowHandlerInput): Promise<LeaseValidationResult | null> => {
    // AUD-P1-04: lease is mandatory — missing port fails closed.
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
    return deps.lease.validateLease({
      workflowId: input.workflowId,
      stepId: input.stepId,
      workerId: input.workerId,
      fencingToken: input.fencingToken,
    });
  };

  const revalidateAuthorization = async (
    s: Record<string, unknown>,
    assignment: TenantExperienceAssignmentRecord,
  ): Promise<AuthorizationDecision> => {
    if (!deps.authorization) {
      return { allowed: false, reason: 'AUTHORIZATION_PORT_MISSING' };
    }
    const rowId =
      str(s.authorizationRowId) ??
      str(s.authorizationId) ??
      assignment.authorizationRowId ??
      null;
    const version = intOf(s.authorizationVersion) ?? assignment.authorizationVersion ?? null;
    const provisioningRequestId =
      str(s.provisioningRequestId) ?? assignment.provisioningRequestId ?? null;

    if (!rowId || version == null) {
      return { allowed: false, reason: 'AUTHORIZATION_MISSING', rowId, version };
    }

    let view: WorkflowReadyAuthorizationView | null;
    try {
      view = await withTimeout(
        deps.authorization.revalidateBoundAuthorization({
          authorizationRowId: rowId,
          authorizationVersion: version,
          provisioningRequestId,
        }),
        AUTHORIZATION_TIMEOUT_MS,
        'P7.1 authorization revalidation',
      );
    } catch {
      return { allowed: false, reason: 'AUTHORIZATION_TIMEOUT', rowId, version };
    }
    if (!view) {
      return { allowed: false, reason: 'AUTHORIZATION_INVALID', rowId, version };
    }
    if (view.authorizationRowId !== rowId || view.authorizationVersion !== version) {
      return { allowed: false, reason: 'AUTHORIZATION_IDENTITY_MISMATCH', rowId, version };
    }
    return { allowed: true, view, rowId, version };
  };

  const recordEvidence = async (
    assignmentId: string,
    tenantId: string,
    input: WorkflowHandlerInput,
    operation: string,
    outcome: 'SUCCEEDED' | 'FAILED' | 'SKIPPED' | 'PARTIAL',
    evidence: Record<string, unknown>,
    startedAt: number,
    error?: { code: string; message: string },
  ) => {
    try {
      await deps.repo.createEvidence({
        assignmentId,
        tenantId,
        workflowId: input.workflowId ?? null,
        stepKey: input.stepKey ?? null,
        operation,
        outcome,
        evidence: redactExperienceSecrets(evidence),
        errorCode: error?.code ?? null,
        errorMessage: error?.message ?? null,
        durationMs: Date.now() - startedAt,
        performedBy: input.workerId ?? null,
      });
    } catch (err) {
      throw new DomainError(
        ErrorCode.DEPENDENCY_UNAVAILABLE,
        'Experience operation evidence could not be persisted',
        [{ operation }],
        err instanceof Error ? err : undefined,
      );
    }
  };

  const gateMutation = async (
    input: WorkflowHandlerInput,
    assignment: TenantExperienceAssignmentRecord,
    operation: string,
  ): Promise<WorkflowHandlerOutcome | null> => {
    const startedAt = Date.now();
    const s = snap(input);

    {
      const leaseCheck = await validateLease(input);
      if (leaseCheck && !leaseCheck.valid) {
        await recordEvidence(
          assignment.id,
          assignment.tenantId,
          input,
          `${operation}:lease_check`,
          'FAILED',
          { leaseReason: leaseCheck.reason, detail: leaseCheck.detail ?? null },
          startedAt,
          { code: ExperienceErrorCode.AUTHORIZATION_FAILED, message: leaseCheck.reason },
        );
        return fail(
          ExperienceErrorCode.AUTHORIZATION_FAILED,
          `Lease validation failed: ${leaseCheck.reason}`,
        );
      }
    }

    const decision = await revalidateAuthorization(s, assignment);
    const evidence = authorizationEvidence(decision, {
      tenantId: assignment.tenantId,
      productId: assignment.productId,
      provisioningRequestId: assignment.provisioningRequestId,
    });
    await recordEvidence(
      assignment.id,
      assignment.tenantId,
      input,
      `${operation}:authorization_check`,
      decision.allowed ? 'SUCCEEDED' : 'FAILED',
      evidence,
      startedAt,
      decision.allowed
        ? undefined
        : { code: ExperienceErrorCode.AUTHORIZATION_FAILED, message: decision.reason },
    );
    if (!decision.allowed) {
      return fail(
        ExperienceErrorCode.AUTHORIZATION_FAILED,
        `P7.1 authorization denied: ${decision.reason}`,
      );
    }
    return null;
  };

  return async (input, key: ExperienceHandlerKey): Promise<WorkflowHandlerOutcome> => {
    const s = snap(input);
    const startedAt = Date.now();
    const assignmentId = str(s.assignmentId);
    if (!assignmentId) {
      return fail(ExperienceErrorCode.VALIDATION, 'assignmentId required in workflow input');
    }
    const assignment = await deps.repo.getAssignment(assignmentId);
    if (!assignment) {
      return fail(ExperienceErrorCode.VALIDATION, 'Assignment not found (fail-closed)');
    }
    const actorId = str(s.actorId) ?? input.workerId ?? 'workflow-worker';

    try {
      switch (key) {
        case 'experience.validate_plan': {
          const denied = await gateMutation(input, assignment, key);
          if (denied) return denied;

          if (assignment.experienceProfileId) {
            const profile = await deps.repo.getProfile(assignment.experienceProfileId);
            if (!profile || profile.profileStatus !== ExperienceProfileStatus.PUBLISHED) {
              await recordEvidence(
                assignment.id,
                assignment.tenantId,
                input,
                key,
                'FAILED',
                { experienceProfileId: assignment.experienceProfileId },
                startedAt,
                {
                  code: ExperienceErrorCode.PROFILE_NOT_PUBLISHED,
                  message: 'Experience profile is not PUBLISHED',
                },
              );
              return fail(
                ExperienceErrorCode.PROFILE_NOT_PUBLISHED,
                'Experience profile is not PUBLISHED',
              );
            }
          }

          const manifest = assignment.desiredManifest ?? {};
          const appsRaw = manifest.applications;
          if (!Array.isArray(appsRaw)) {
            return fail(
              ExperienceErrorCode.VALIDATION,
              'desiredManifest.applications must be an array',
            );
          }
          for (let i = 0; i < appsRaw.length; i++) {
            const app = appsRaw[i] as Record<string, unknown>;
            if (!str(app?.applicationId) || intOf(app?.applicationVersion) == null) {
              return fail(
                ExperienceErrorCode.VALIDATION,
                `desiredManifest.applications[${i}] requires applicationId and applicationVersion`,
              );
            }
          }

          const expectedChecksum =
            typeof manifest.checksum === 'string'
              ? manifest.checksum
              : typeof assignment.metadata?.desiredChecksum === 'string'
                ? (assignment.metadata.desiredChecksum as string)
                : null;
          const { checksum: _omit, ...manifestWithoutChecksum } = manifest as Record<
            string,
            unknown
          > & { checksum?: unknown };
          void _omit;
          const computed = checksumManifest(
            expectedChecksum != null && 'checksum' in manifest
              ? manifestWithoutChecksum
              : manifest,
          );
          if (expectedChecksum != null && expectedChecksum !== computed) {
            await recordEvidence(
              assignment.id,
              assignment.tenantId,
              input,
              key,
              'FAILED',
              { expected: expectedChecksum, actual: computed },
              startedAt,
              {
                code: ExperienceErrorCode.COMPATIBILITY_MISMATCH,
                message: 'desiredManifest checksum mismatch',
              },
            );
            return fail(
              ExperienceErrorCode.COMPATIBILITY_MISMATCH,
              'desiredManifest checksum mismatch',
            );
          }

          await recordEvidence(
            assignment.id,
            assignment.tenantId,
            input,
            key,
            'SUCCEEDED',
            { applicationCount: appsRaw.length, checksum: computed },
            startedAt,
          );
          return ok({
            assignmentId,
            checksum: computed,
            validated: true,
            applicationCount: appsRaw.length,
          });
        }

        case 'experience.bind_applications': {
          const denied = await gateMutation(input, assignment, key);
          if (denied) return denied;

          const current = await deps.repo.getAssignment(assignment.id);
          if (!current) {
            return fail(ExperienceErrorCode.VALIDATION, 'Assignment missing');
          }

          const apps = Array.isArray(current.desiredManifest.applications)
            ? (current.desiredManifest.applications as ManifestApp[])
            : [];
          const existing = await deps.repo.listApplicationBindings(current.id);
          const byAppId = new Map(existing.map((b) => [b.applicationId, b]));
          const bound: string[] = [];

          for (const entry of apps) {
            const applicationId = str(entry.applicationId);
            const applicationVersion = intOf(entry.applicationVersion);
            if (!applicationId || applicationVersion == null) {
              return fail(
                ExperienceErrorCode.VALIDATION,
                'application binding requires applicationId and applicationVersion',
              );
            }
            const app = await deps.repo.getApplication(applicationId);
            if (!app || app.applicationStatus !== ApplicationStatus.PUBLISHED) {
              return fail(
                ExperienceErrorCode.APPLICATION_NOT_PUBLISHED,
                `Application ${applicationId} is not PUBLISHED`,
              );
            }
            const ver = await deps.repo.getApplicationVersion(applicationId, applicationVersion);
            if (!ver || ver.status !== ExperienceVersionStatus.PUBLISHED) {
              return fail(
                ExperienceErrorCode.APPLICATION_NOT_PUBLISHED,
                `Application version ${applicationId}@${applicationVersion} is not PUBLISHED`,
              );
            }

            const prior = byAppId.get(applicationId);
            if (prior) {
              await deps.repo.updateApplicationBinding(prior.id, {
                applicationVersion,
                bindingStatus: ApplicationBindingStatus.ACTIVE,
              });
              bound.push(prior.id);
            } else {
              const created = await deps.repo.createApplicationBinding({
                assignmentId: current.id,
                tenantId: current.tenantId,
                applicationId,
                applicationVersion,
                bindingStatus: ApplicationBindingStatus.ACTIVE,
                clientRegistrationId: null,
                metadata: {},
              });
              bound.push(created.id);
            }
          }

          if (current.assignmentStatus === ExperienceAssignmentStatus.ASSIGNED) {
            await deps.repo.updateAssignment(
              current.id,
              { assignmentStatus: ExperienceAssignmentStatus.PROVISIONING },
              current.version,
              actorId,
            );
          }

          await recordEvidence(
            current.id,
            current.tenantId,
            input,
            key,
            'SUCCEEDED',
            { boundCount: bound.length, bindingIds: bound },
            startedAt,
          );
          return ok({ assignmentId: current.id, boundCount: bound.length, bindingIds: bound });
        }

        case 'experience.register_clients': {
          const denied = await gateMutation(input, assignment, key);
          if (denied) return denied;

          const current = await deps.repo.getAssignment(assignment.id);
          if (!current) {
            return fail(ExperienceErrorCode.VALIDATION, 'Assignment missing');
          }

          const clients = Array.isArray(current.desiredManifest.clients)
            ? (current.desiredManifest.clients as ManifestClient[])
            : [];
          const domains = await deps.repo.listDomainBindings(current.id);
          const verifiedHosts = domains
            .filter((d) => d.ownershipStatus === DomainOwnershipStatus.VERIFIED)
            .map((d) => d.hostname);
          const existing = await deps.repo.listClientRegistrations(current.id);
          const byClientId = new Map(existing.map((c) => [c.clientId, c]));
          const registered: string[] = [];

          for (const entry of clients) {
            if (hasPlaintextSecretFields(entry as Record<string, unknown>)) {
              return fail(
                ExperienceErrorCode.SECRET_PLAINTEXT_FORBIDDEN,
                'Plaintext secrets forbidden — use credentialRef only',
              );
            }

            const clientId = str(entry.clientId);
            if (!clientId) {
              return fail(ExperienceErrorCode.VALIDATION, 'clientId required');
            }
            const clientKind = str(entry.clientKind) ?? 'PUBLIC';
            const redirectUris = Array.isArray(entry.redirectUris)
              ? entry.redirectUris.map(String)
              : [];
            const webOrigins = Array.isArray(entry.webOrigins)
              ? entry.webOrigins.map(String)
              : [];
            const scopes = Array.isArray(entry.scopes) ? entry.scopes.map(String) : [];
            const audiences = Array.isArray(entry.audiences) ? entry.audiences.map(String) : [];
            const postLogoutRedirectUris = Array.isArray(entry.postLogoutRedirectUris)
              ? entry.postLogoutRedirectUris.map(String)
              : [];
            const credentialRef =
              typeof entry.credentialRef === 'string' && entry.credentialRef.trim()
                ? entry.credentialRef.trim()
                : null;

            const redirectCheck = validateRedirectUris(redirectUris);
            if (!redirectCheck.ok) {
              return fail(
                ExperienceErrorCode.REDIRECT_URI_INVALID,
                redirectCheck.issues[0]?.message ?? 'Invalid redirect URI',
              );
            }
            const originCheck = validateWebOrigins(webOrigins);
            if (!originCheck.ok) {
              return fail(
                ExperienceErrorCode.WEB_ORIGIN_INVALID,
                originCheck.issues[0]?.message ?? 'Invalid web origin',
              );
            }
            // AUD-P1-05: fail-closed — redirects require at least one verified domain binding.
            if (redirectUris.length > 0 && verifiedHosts.length === 0) {
              return fail(
                ExperienceErrorCode.DOMAIN_OWNERSHIP_UNVERIFIED,
                'Cannot register redirect URIs before verified domain bindings exist',
              );
            }
            if (verifiedHosts.length > 0) {
              const bound = assertRedirectsBoundToDomains(redirectUris, verifiedHosts);
              if (!bound.ok) {
                return fail(
                  ExperienceErrorCode.CROSS_TENANT_ROUTING,
                  bound.issues[0]?.message ?? 'Redirect host not bound to verified domain',
                );
              }
            }

            const keycloakClientRef = `local://${current.tenantId}/${clientId}`;
            const prior = byClientId.get(clientId);
            if (prior) {
              const updated = await deps.repo.updateClientRegistration(
                prior.id,
                {
                  clientKind,
                  redirectUris,
                  webOrigins,
                  scopes,
                  audiences,
                  postLogoutRedirectUris,
                  credentialRef,
                  keycloakClientRef,
                  registrationStatus: ClientRegistrationStatus.ACTIVE,
                },
                prior.version,
              );
              registered.push(updated.id);
            } else {
              const created = await deps.repo.createClientRegistration({
                assignmentId: current.id,
                tenantId: current.tenantId,
                applicationBindingId:
                  typeof entry.applicationBindingId === 'string'
                    ? entry.applicationBindingId
                    : null,
                clientId,
                clientKind,
                keycloakTopologyId: null,
                keycloakClientRef,
                redirectUris,
                postLogoutRedirectUris,
                webOrigins,
                audiences,
                scopes,
                credentialRef,
                registrationStatus: ClientRegistrationStatus.ACTIVE,
                metadata: {},
                createdBy: actorId,
              });
              registered.push(created.id);
            }
          }

          await deps.repo.createDeploymentRun({
            assignmentId: current.id,
            tenantId: current.tenantId,
            productId: current.productId,
            operation: 'REGISTER_CLIENT',
            workflowId: input.workflowId ?? null,
            outcome: 'SUCCEEDED',
            errorCode: null,
            errorMessage: null,
            observedState: { registeredCount: registered.length },
            evidence: redactExperienceSecrets({ registered }),
            startedAt: new Date(startedAt),
            finishedAt: new Date(),
            performedBy: actorId,
            correlationId: input.correlationId ?? null,
          });

          await recordEvidence(
            current.id,
            current.tenantId,
            input,
            key,
            'SUCCEEDED',
            { registeredCount: registered.length, clientRegistrationIds: registered },
            startedAt,
          );
          return ok({
            assignmentId: current.id,
            registeredCount: registered.length,
            clientRegistrationIds: registered,
          });
        }

        case 'experience.bind_domains': {
          const denied = await gateMutation(input, assignment, key);
          if (denied) return denied;

          const current = await deps.repo.getAssignment(assignment.id);
          if (!current) {
            return fail(ExperienceErrorCode.VALIDATION, 'Assignment missing');
          }

          const domains = Array.isArray(current.desiredManifest.domains)
            ? (current.desiredManifest.domains as ManifestDomain[])
            : [];
          const existing = await deps.repo.listDomainBindings(current.id);
          const byHost = new Map(existing.map((d) => [d.hostname.toLowerCase(), d]));
          const bound: string[] = [];

          for (const entry of domains) {
            const hostname = str(entry.hostname)?.toLowerCase();
            if (!hostname) {
              return fail(ExperienceErrorCode.VALIDATION, 'hostname required');
            }
            const hostCheck = validateHostname(hostname);
            if (!hostCheck.ok) {
              return fail(
                hostCheck.issues[0]?.code ?? ExperienceErrorCode.VALIDATION,
                hostCheck.issues[0]?.message ?? 'Invalid hostname',
              );
            }

            const domainKind = str(entry.domainKind) ?? DomainKind.SUBDOMAIN;
            const platformAttested =
              entry.platformAttested === true ||
              (entry.metadata && entry.metadata.platformAttested === true);

            const prior = byHost.get(hostname);
            if (prior) {
              if (prior.assignmentId !== current.id || prior.tenantId !== current.tenantId) {
                return fail(
                  ExperienceErrorCode.HOSTNAME_CONFLICT,
                  `Hostname ${hostname} is already bound`,
                );
              }
              const patch: Partial<typeof prior> = {
                domainKind,
              };
              if (
                domainKind === DomainKind.SUBDOMAIN &&
                platformAttested
              ) {
                patch.dnsStatus = DnsStatus.NOT_REQUIRED;
                patch.ownershipStatus = DomainOwnershipStatus.VERIFIED;
              }
              const updated = await deps.repo.updateDomainBinding(
                prior.id,
                patch,
                prior.version,
                actorId,
              );
              bound.push(updated.id);
            } else {
              const foreign = await deps.repo.getDomainByHostname(hostname);
              if (foreign && foreign.assignmentId !== current.id) {
                return fail(
                  ExperienceErrorCode.HOSTNAME_CONFLICT,
                  `Hostname ${hostname} is already bound`,
                );
              }

              const ownershipToken = issueOwnershipToken();
              const isAttestedSubdomain =
                domainKind === DomainKind.SUBDOMAIN && platformAttested === true;
              const created = await deps.repo.createDomainBinding({
                assignmentId: current.id,
                tenantId: current.tenantId,
                hostname,
                domainKind,
                ownershipStatus: isAttestedSubdomain
                  ? DomainOwnershipStatus.VERIFIED
                  : DomainOwnershipStatus.PENDING,
                ownershipToken,
                dnsStatus: isAttestedSubdomain ? DnsStatus.NOT_REQUIRED : DnsStatus.PENDING,
                tlsStatus: TlsStatus.PENDING,
                certificateRef: null,
                routeStatus: RouteStatus.PENDING,
                bindingStatus: DomainBindingStatus.PENDING,
                metadata: {
                  ...(entry.metadata ?? {}),
                  platformAttested: platformAttested === true,
                },
                createdBy: actorId,
                updatedBy: actorId,
              });
              bound.push(created.id);
            }
          }

          await deps.repo.createDeploymentRun({
            assignmentId: current.id,
            tenantId: current.tenantId,
            productId: current.productId,
            operation: 'BIND_DOMAIN',
            workflowId: input.workflowId ?? null,
            outcome: 'SUCCEEDED',
            errorCode: null,
            errorMessage: null,
            observedState: { boundCount: bound.length },
            evidence: redactExperienceSecrets({ domainBindingIds: bound }),
            startedAt: new Date(startedAt),
            finishedAt: new Date(),
            performedBy: actorId,
            correlationId: input.correlationId ?? null,
          });

          await recordEvidence(
            current.id,
            current.tenantId,
            input,
            key,
            'SUCCEEDED',
            { boundCount: bound.length, domainBindingIds: bound },
            startedAt,
          );
          return ok({
            assignmentId: current.id,
            boundCount: bound.length,
            domainBindingIds: bound,
          });
        }

        case 'experience.provision_tls': {
          const denied = await gateMutation(input, assignment, key);
          if (denied) return denied;

          const current = await deps.repo.getAssignment(assignment.id);
          if (!current) {
            return fail(ExperienceErrorCode.VALIDATION, 'Assignment missing');
          }

          const domains = await deps.repo.listDomainBindings(current.id);
          const verified = domains.filter(
            (d) => d.ownershipStatus === DomainOwnershipStatus.VERIFIED,
          );
          const provisioned: string[] = [];

          for (const domain of verified) {
            if (domain.tlsStatus === TlsStatus.ACTIVE && domain.certificateRef) {
              provisioned.push(domain.id);
              continue;
            }
            const certificateRef = `vault:experience-tls/${domain.hostname}`;

            let working = domain;
            if (working.tlsStatus !== TlsStatus.PROVISIONING) {
              working = await deps.repo.updateDomainBinding(
                working.id,
                { tlsStatus: TlsStatus.PROVISIONING },
                working.version,
                actorId,
              );
            }

            await deps.repo.createCertificate({
              domainBindingId: working.id,
              tenantId: current.tenantId,
              certificateRef,
              issuer: 'experience-local-ca',
              notBefore: new Date(),
              notAfter: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
              fingerprintSha256: null,
              certificateStatus: 'ACTIVE',
              metadata: { source: 'p7.9', noPem: true },
            });

            const activated = await deps.repo.updateDomainBinding(
              working.id,
              {
                tlsStatus: TlsStatus.ACTIVE,
                certificateRef,
                routeStatus: RouteStatus.ACTIVE,
                bindingStatus: DomainBindingStatus.ACTIVE,
              },
              working.version,
              actorId,
            );
            provisioned.push(activated.id);
          }

          await deps.repo.createDeploymentRun({
            assignmentId: current.id,
            tenantId: current.tenantId,
            productId: current.productId,
            operation: 'PROVISION_TLS',
            workflowId: input.workflowId ?? null,
            outcome: 'SUCCEEDED',
            errorCode: null,
            errorMessage: null,
            observedState: { provisionedCount: provisioned.length },
            evidence: redactExperienceSecrets({ domainBindingIds: provisioned }),
            startedAt: new Date(startedAt),
            finishedAt: new Date(),
            performedBy: actorId,
            correlationId: input.correlationId ?? null,
          });

          await recordEvidence(
            current.id,
            current.tenantId,
            input,
            key,
            'SUCCEEDED',
            { provisionedCount: provisioned.length, domainBindingIds: provisioned },
            startedAt,
          );
          return ok({
            assignmentId: current.id,
            provisionedCount: provisioned.length,
            domainBindingIds: provisioned,
          });
        }

        case 'experience.verify_experience': {
          const denied = await gateMutation(input, assignment, key);
          if (denied) return denied;

          const current = await deps.repo.getAssignment(assignment.id);
          if (!current) {
            return fail(ExperienceErrorCode.VALIDATION, 'Assignment missing');
          }

          const appsDesired = Array.isArray(current.desiredManifest.applications)
            ? (current.desiredManifest.applications as ManifestApp[])
            : [];
          const clientsDesired = Array.isArray(current.desiredManifest.clients)
            ? (current.desiredManifest.clients as ManifestClient[])
            : [];
          const bindings = await deps.repo.listApplicationBindings(current.id);
          const clients = await deps.repo.listClientRegistrations(current.id);
          const domains = await deps.repo.listDomainBindings(current.id);

          for (const app of appsDesired) {
            const binding = bindings.find((b) => b.applicationId === app.applicationId);
            if (!binding || binding.bindingStatus !== ApplicationBindingStatus.ACTIVE) {
              return fail(
                ExperienceErrorCode.VALIDATION,
                `Application binding not ACTIVE for ${app.applicationId}`,
              );
            }
          }

          for (const c of clientsDesired) {
            const reg = clients.find((r) => r.clientId === c.clientId);
            if (!reg || reg.registrationStatus !== ClientRegistrationStatus.ACTIVE) {
              return fail(
                ExperienceErrorCode.VALIDATION,
                `Client registration not ACTIVE for ${c.clientId}`,
              );
            }
          }

          const customDomains = domains.filter((d) => d.domainKind === DomainKind.CUSTOM);
          if (customDomains.length > 0) {
            for (const d of customDomains) {
              if (
                d.tlsStatus !== TlsStatus.ACTIVE ||
                d.routeStatus !== RouteStatus.ACTIVE ||
                d.bindingStatus !== DomainBindingStatus.ACTIVE
              ) {
                return fail(
                  ExperienceErrorCode.DOMAIN_OWNERSHIP_UNVERIFIED,
                  `Custom domain ${d.hostname} lacks ACTIVE tls/route/binding`,
                );
              }
            }
          }

          const appliedChecksum = checksumManifest(current.desiredManifest);
          const updated = await deps.repo.updateAssignment(
            current.id,
            {
              assignmentStatus: ExperienceAssignmentStatus.READY,
              appliedManifest: current.desiredManifest,
              appliedChecksum,
              lastDeployedAt: new Date(),
            },
            current.version,
            actorId,
          );

          await deps.repo.createDeploymentRun({
            assignmentId: current.id,
            tenantId: current.tenantId,
            productId: current.productId,
            operation: 'DEPLOY',
            workflowId: input.workflowId ?? null,
            outcome: 'SUCCEEDED',
            errorCode: null,
            errorMessage: null,
            observedState: {
              appliedChecksum,
              status: ExperienceAssignmentStatus.READY,
            },
            evidence: redactExperienceSecrets({ verified: true }),
            startedAt: new Date(startedAt),
            finishedAt: new Date(),
            performedBy: actorId,
            correlationId: input.correlationId ?? null,
          });

          await recordEvidence(
            current.id,
            current.tenantId,
            input,
            key,
            'SUCCEEDED',
            {
              status: ExperienceAssignmentStatus.READY,
              appliedChecksum,
              assignmentVersion: updated.version,
            },
            startedAt,
          );
          return ok({
            assignmentId: current.id,
            status: ExperienceAssignmentStatus.READY,
            appliedChecksum,
          });
        }

        case 'experience.deactivate': {
          const denied = await gateMutation(input, assignment, key);
          if (denied) return denied;

          const current = await deps.repo.getAssignment(assignment.id);
          if (!current) {
            return fail(ExperienceErrorCode.VALIDATION, 'Assignment missing');
          }

          const clients = await deps.repo.listClientRegistrations(current.id);
          for (const c of clients) {
            if (c.registrationStatus !== ClientRegistrationStatus.REVOKED) {
              await deps.repo.updateClientRegistration(
                c.id,
                { registrationStatus: ClientRegistrationStatus.REVOKED },
                c.version,
              );
            }
          }

          const domains = await deps.repo.listDomainBindings(current.id);
          for (const d of domains) {
            if (d.bindingStatus !== DomainBindingStatus.DEACTIVATED) {
              await deps.repo.updateDomainBinding(
                d.id,
                {
                  bindingStatus: DomainBindingStatus.DEACTIVATED,
                  routeStatus: RouteStatus.DEACTIVATED,
                  tlsStatus:
                    d.tlsStatus === TlsStatus.ACTIVE ? TlsStatus.REVOKED : d.tlsStatus,
                  ownershipStatus:
                    d.ownershipStatus === DomainOwnershipStatus.VERIFIED
                      ? DomainOwnershipStatus.REVOKED
                      : d.ownershipStatus,
                },
                d.version,
                actorId,
              );
            }
          }

          const bindings = await deps.repo.listApplicationBindings(current.id);
          for (const b of bindings) {
            if (b.bindingStatus !== ApplicationBindingStatus.REVOKED) {
              await deps.repo.updateApplicationBinding(b.id, {
                bindingStatus: ApplicationBindingStatus.REVOKED,
              });
            }
          }

          const updated = await deps.repo.updateAssignment(
            current.id,
            { assignmentStatus: ExperienceAssignmentStatus.DEACTIVATED },
            current.version,
            actorId,
          );

          await deps.repo.createDeploymentRun({
            assignmentId: current.id,
            tenantId: current.tenantId,
            productId: current.productId,
            operation: 'DEACTIVATE',
            workflowId: input.workflowId ?? null,
            outcome: 'SUCCEEDED',
            errorCode: null,
            errorMessage: null,
            observedState: { status: ExperienceAssignmentStatus.DEACTIVATED },
            evidence: redactExperienceSecrets({
              revokedClients: clients.length,
              deactivatedDomains: domains.length,
            }),
            startedAt: new Date(startedAt),
            finishedAt: new Date(),
            performedBy: actorId,
            correlationId: input.correlationId ?? null,
          });

          await recordEvidence(
            current.id,
            current.tenantId,
            input,
            key,
            'SUCCEEDED',
            {
              status: ExperienceAssignmentStatus.DEACTIVATED,
              assignmentVersion: updated.version,
            },
            startedAt,
          );
          return ok({
            assignmentId: current.id,
            status: ExperienceAssignmentStatus.DEACTIVATED,
          });
        }

        default:
          return fail(ExperienceErrorCode.VALIDATION, `Unknown handler key: ${key as string}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const detailCode =
        err instanceof DomainError &&
        Array.isArray(err.details) &&
        err.details[0] &&
        typeof (err.details[0] as { code?: unknown }).code === 'string'
          ? String((err.details[0] as { code: string }).code)
          : ExperienceErrorCode.PROVIDER_UNAVAILABLE;
      try {
        await recordEvidence(
          assignment.id,
          assignment.tenantId,
          input,
          key,
          'FAILED',
          { error: message },
          startedAt,
          { code: detailCode, message },
        );
      } catch {
        // evidence failure already surfaced below
      }
      if (detailCode === ExperienceErrorCode.HOSTNAME_CONFLICT) {
        return fail(ExperienceErrorCode.HOSTNAME_CONFLICT, message);
      }
      return fail(ExperienceErrorCode.PROVIDER_UNAVAILABLE, message, true);
    }
  };
}
