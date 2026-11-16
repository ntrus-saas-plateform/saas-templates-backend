import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import type { ControlPlaneOutboxTransactionService } from '../../../../shared/messaging/control-plane-outbox-transaction.service.js';
import type { AuditEventRepositoryPort } from '../../domain/ports/audit-event-repository.port.js';
import { EDGE_P7_OUTBOX_TENANT } from '../../domain/provisioning/provisioning.events.js';
import type { ExperienceRepositoryPort } from '../../domain/product-experience/experience-repository.port.js';
import {
  checksumManifest,
  issueOwnershipToken,
  validateHostname,
  validateRedirectUris,
  validateWebOrigins,
} from '../../domain/product-experience/experience-access.policy.js';
import {
  ApplicationKind,
  ApplicationStatus,
  DomainBindingStatus,
  DomainKind,
  DomainOwnershipStatus,
  DnsStatus,
  ExperienceAssignmentStatus,
  ExperienceDriftStatus,
  ExperienceErrorCode,
  ExperienceProfileStatus,
  RouteStatus,
  TlsStatus,
} from '../../domain/product-experience/experience.types.js';
import type { WorkflowAuthorizationPort } from '../../domain/workflow/workflow-authorization.port.js';
import type { WorkflowRepositoryPort } from '../../domain/workflow/workflow-repository.port.js';
import { WorkflowDefinitionStatus } from '../../domain/workflow/workflow.types.js';
import { validateDefinition } from '../../domain/workflow/workflow-definition.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SECRET_KEY_PATTERN =
  /(secret|password|token|credential|api[_-]?key|private[_-]?key|client[_-]?secret)/i;

function isUuid(value: string | null | undefined): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

function isVaultRef(value: string): boolean {
  return /^sec_[A-Za-z0-9_-]+$/.test(value) || value.startsWith('vault:');
}

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
  const details: Record<string, unknown> = { ...input.details };
  const actorId = isUuid(input.actorId) ? input.actorId : null;
  if (actorId === null && input.actorId) details.actorRef = input.actorId;
  const subjectId = isUuid(input.subjectId) ? input.subjectId : null;
  if (subjectId === null && input.subjectId) details.subjectRef = input.subjectId;
  try {
    await audit.create({ ...input, actorId, subjectId, details }, client);
  } catch (err) {
    throw new DomainError(
      ErrorCode.DEPENDENCY_UNAVAILABLE,
      'Durable audit required for experience mutation',
      [{ eventType: input.eventType }],
      err instanceof Error ? err : undefined,
    );
  }
}

/** Strip accidental secret-bearing fields before persistence / API output. */
export function redactExperienceSecrets<T>(value: T): T {
  const secretKeys = [
    'secret',
    'password',
    'token',
    'credential',
    'apiKey',
    'api_key',
    'clientSecret',
    'client_secret',
    'privateKey',
    'private_key',
  ];
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, raw] of Object.entries(v as Record<string, unknown>)) {
        const lower = k.toLowerCase();
        // Opaque vault / cert handles must survive redaction.
        if (
          lower === 'credentialref' ||
          lower === 'credential_ref' ||
          lower === 'certificateref' ||
          lower === 'certificate_ref'
        ) {
          out[k] = raw;
          continue;
        }
        if (secretKeys.some((s) => lower.includes(s.toLowerCase()))) {
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

function assertNoPlaintextSecrets(value: unknown, path = '$'): void {
  if (Array.isArray(value)) {
    value.forEach((v, i) => assertNoPlaintextSecrets(v, `${path}[${i}]`));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const child = `${path}.${k}`;
      if (SECRET_KEY_PATTERN.test(k) && typeof v === 'string' && v.trim() && !isVaultRef(v)) {
        throw new DomainError(
          ErrorCode.VALIDATION_ERROR,
          `Plaintext secret-like field "${k}" is forbidden; use a vault reference`,
          [{ code: ExperienceErrorCode.SECRET_PLAINTEXT_FORBIDDEN, path: child }],
        );
      }
      // credentialRef / ownershipToken keys may look secret-like but vault refs are OK —
      // the check above already allows vault refs; non-string secret-like values are redacted later.
      assertNoPlaintextSecrets(v, child);
    }
  }
}

type DesiredClient = {
  clientId: string;
  clientKind?: string;
  redirectUris?: string[];
  postLogoutRedirectUris?: string[];
  webOrigins?: string[];
  audiences?: string[];
  scopes?: string[];
  credentialRef?: string;
  applicationId?: string;
};

type DesiredDomain = {
  hostname: string;
  domainKind?: 'SUBDOMAIN' | 'CUSTOM' | string;
  platformAttested?: boolean;
};

type DesiredManifest = {
  applications?: Array<{ applicationId: string; applicationVersion: number }>;
  clients?: DesiredClient[];
  domains?: DesiredDomain[];
};

function validateDesiredManifest(manifest: Record<string, unknown>): DesiredManifest {
  assertNoPlaintextSecrets(manifest);
  const issues: Array<{ path: string; code: string; message: string }> = [];

  const clients = Array.isArray(manifest.clients) ? (manifest.clients as DesiredClient[]) : [];
  for (let i = 0; i < clients.length; i++) {
    const client = clients[i]!;
    if (!client?.clientId || typeof client.clientId !== 'string') {
      issues.push({
        path: `$.clients[${i}].clientId`,
        code: ExperienceErrorCode.VALIDATION,
        message: 'clientId required',
      });
      continue;
    }
    if (client.redirectUris?.length) {
      const r = validateRedirectUris(client.redirectUris);
      for (const issue of r.issues) {
        issues.push({
          path: `$.clients[${i}].${issue.path.replace(/^\$\./, '')}`,
          code: String(issue.code),
          message: issue.message,
        });
      }
    }
    if (client.postLogoutRedirectUris?.length) {
      const r = validateRedirectUris(client.postLogoutRedirectUris);
      for (const issue of r.issues) {
        issues.push({
          path: `$.clients[${i}].postLogoutRedirectUris${issue.path.replace(/^\$\.redirectUris/, '')}`,
          code: String(issue.code),
          message: issue.message,
        });
      }
    }
    if (client.webOrigins?.length) {
      const r = validateWebOrigins(client.webOrigins);
      for (const issue of r.issues) {
        issues.push({
          path: `$.clients[${i}].${issue.path.replace(/^\$\./, '')}`,
          code: String(issue.code),
          message: issue.message,
        });
      }
    }
    if (
      client.credentialRef != null &&
      typeof client.credentialRef === 'string' &&
      client.credentialRef.trim() &&
      !isVaultRef(client.credentialRef)
    ) {
      issues.push({
        path: `$.clients[${i}].credentialRef`,
        code: ExperienceErrorCode.SECRET_PLAINTEXT_FORBIDDEN,
        message: 'credentialRef must be a vault reference',
      });
    }
  }

  const domains = Array.isArray(manifest.domains) ? (manifest.domains as DesiredDomain[]) : [];
  for (let i = 0; i < domains.length; i++) {
    const domain = domains[i]!;
    if (!domain?.hostname) {
      issues.push({
        path: `$.domains[${i}].hostname`,
        code: ExperienceErrorCode.VALIDATION,
        message: 'hostname required',
      });
      continue;
    }
    const h = validateHostname(domain.hostname);
    for (const issue of h.issues) {
      issues.push({
        path: `$.domains[${i}].hostname`,
        code: String(issue.code),
        message: issue.message,
      });
    }
  }

  const applications = Array.isArray(manifest.applications)
    ? (manifest.applications as Array<{ applicationId: string; applicationVersion: number }>)
    : [];
  for (let i = 0; i < applications.length; i++) {
    const app = applications[i]!;
    if (!app?.applicationId || typeof app.applicationVersion !== 'number') {
      issues.push({
        path: `$.applications[${i}]`,
        code: ExperienceErrorCode.VALIDATION,
        message: 'applicationId and applicationVersion required',
      });
    }
  }

  if (issues.length > 0) {
    throw new DomainError(ErrorCode.VALIDATION_ERROR, 'desiredManifest validation failed', issues);
  }

  return {
    applications,
    clients,
    domains,
  };
}

// ---------------------------------------------------------------------------
// Workflow definitions (P7.9)
// ---------------------------------------------------------------------------

export const EXPERIENCE_WORKFLOW_DEFINITIONS = {
  provision: {
    code: 'p79.experience.provision',
    name: 'P7.9 Product Experience Provisioning',
    description:
      'Validate plan, bind applications, register clients, bind domains, provision TLS, verify',
    snapshot: {
      steps: [
        {
          key: 'validate_plan',
          type: 'HANDLER',
          handlerKey: 'experience.validate_plan',
          maxAttempts: 3,
          timeoutMs: 60_000,
        },
        {
          key: 'bind_applications',
          type: 'HANDLER',
          handlerKey: 'experience.bind_applications',
          dependsOn: ['validate_plan'],
          maxAttempts: 3,
          timeoutMs: 180_000,
        },
        {
          key: 'register_clients',
          type: 'HANDLER',
          handlerKey: 'experience.register_clients',
          dependsOn: ['bind_applications'],
          maxAttempts: 3,
          timeoutMs: 180_000,
        },
        {
          key: 'bind_domains',
          type: 'HANDLER',
          handlerKey: 'experience.bind_domains',
          dependsOn: ['register_clients'],
          maxAttempts: 3,
          timeoutMs: 180_000,
        },
        {
          key: 'provision_tls',
          type: 'HANDLER',
          handlerKey: 'experience.provision_tls',
          dependsOn: ['bind_domains'],
          maxAttempts: 3,
          timeoutMs: 300_000,
        },
        {
          key: 'verify_experience',
          type: 'HANDLER',
          handlerKey: 'experience.verify_experience',
          dependsOn: ['provision_tls'],
          maxAttempts: 3,
          timeoutMs: 60_000,
          compensationHandlerKey: 'experience.deactivate',
        },
      ],
    },
  },
  deactivate: {
    code: 'p79.experience.deactivate',
    name: 'P7.9 Product Experience Deactivation',
    description: 'Deactivate tenant product experience bindings, clients and domains',
    snapshot: {
      steps: [
        {
          key: 'experience.deactivate',
          type: 'HANDLER',
          handlerKey: 'experience.deactivate',
          maxAttempts: 1,
          timeoutMs: 300_000,
        },
      ],
    },
  },
} as const;

export type ExperienceWorkflowKind = keyof typeof EXPERIENCE_WORKFLOW_DEFINITIONS;

const WORKFLOW_RETRY_DEFAULTS = {
  maxAttempts: 3,
  initialDelayMs: 500,
  maxDelayMs: 15_000,
  multiplier: 2,
  jitterRatio: 0.2,
};

/**
 * Ensure a P7.9 workflow definition exists and is PUBLISHED (idempotent).
 */
export async function ensureExperienceDefinition(
  repo: WorkflowRepositoryPort,
  outbox: ControlPlaneOutboxTransactionService,
  _audit: AuditEventRepositoryPort,
  actorId: string,
  kind: ExperienceWorkflowKind = 'provision',
): Promise<{ id: string }> {
  const def = EXPERIENCE_WORKFLOW_DEFINITIONS[kind];
  const code = def.code;
  const existing = await repo.getDefinitionByCode(code);
  if (existing && existing.definitionStatus === WorkflowDefinitionStatus.PUBLISHED) {
    return existing;
  }
  const snapshot = {
    steps: def.snapshot.steps.map((s) => ({
      ...s,
      dependsOn:
        'dependsOn' in s && s.dependsOn ? [...(s.dependsOn as readonly string[])] : undefined,
    })),
    retryDefaults: WORKFLOW_RETRY_DEFAULTS,
    timeoutDefaultsMs: 600_000,
  };
  validateDefinition(snapshot);

  return outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client) => {
    const publishExisting = async (d: {
      id: string;
      version: number;
      definitionStatus: string;
    }) => {
      if (d.definitionStatus === WorkflowDefinitionStatus.PUBLISHED) return d;
      const latest = await repo.getLatestDefinitionVersion(d.id);
      if (!latest) {
        throw new DomainError(ErrorCode.DEPENDENCY_UNAVAILABLE, 'Workflow definition version missing');
      }
      let currentVersion = d.version;
      if (d.definitionStatus === WorkflowDefinitionStatus.DRAFT) {
        const validated = await repo.setDefinitionStatus(
          d.id,
          WorkflowDefinitionStatus.VALIDATED,
          currentVersion,
          {},
          client,
        );
        currentVersion = validated.version;
      }
      if (d.definitionStatus !== WorkflowDefinitionStatus.VALIDATED) {
        const latestNow = await repo.getLatestDefinitionVersion(d.id);
        await repo.publishDefinitionVersion(
          d.id,
          latestNow?.versionNumber ?? latest.versionNumber,
          latest.snapshot,
          client,
        );
      }
      return repo.setDefinitionStatus(
        d.id,
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
        name: def.name,
        description: def.description,
        domain: 'experience',
        definitionStatus: WorkflowDefinitionStatus.DRAFT,
        securityClassification: 'INTERNAL',
        createdBy: actorId,
        approvedBy: null,
        publishedAt: null,
        draftSnapshot: snapshot,
      },
      client,
    );
    const version = created.version;
    await repo.publishDefinitionVersion(
      created.definition.id,
      version.versionNumber,
      version.snapshot,
      client,
    );
    await repo.setDefinitionStatus(
      created.definition.id,
      WorkflowDefinitionStatus.VALIDATED,
      created.definition.version,
      {},
      client,
    );
    return repo.setDefinitionStatus(
      created.definition.id,
      WorkflowDefinitionStatus.PUBLISHED,
      created.definition.version + 1,
      { approvedBy: actorId, publishedAt: new Date() },
      client,
    );
  });
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export class ListExperienceUseCase {
  constructor(private readonly repo: ExperienceRepositoryPort) {}

  profiles(filter: {
    limit?: number;
    offset?: number;
    status?: string;
    q?: string;
    productId?: string;
  }) {
    return this.repo.listProfiles(filter);
  }
  profile(id: string) {
    return this.repo.getProfile(id);
  }
  applications(filter: {
    limit?: number;
    offset?: number;
    status?: string;
    q?: string;
    productId?: string;
    experienceProfileId?: string;
  }) {
    return this.repo.listApplications(filter);
  }
  application(id: string) {
    return this.repo.getApplication(id);
  }
  assignments(filter: {
    tenantId?: string;
    productId?: string;
    limit?: number;
    offset?: number;
  }) {
    return this.repo.listAssignments(filter);
  }
  assignment(id: string) {
    return this.repo.getAssignment(id);
  }
  runs(assignmentId: string, limit?: number) {
    return this.repo.listDeploymentRuns(assignmentId, limit);
  }
  evidence(assignmentId: string, limit?: number) {
    return this.repo.listEvidence(assignmentId, limit);
  }
  domains(assignmentId: string) {
    return this.repo.listDomainBindings(assignmentId);
  }
  clients(assignmentId: string) {
    return this.repo.listClientRegistrations(assignmentId);
  }
  bindings(assignmentId: string) {
    return this.repo.listApplicationBindings(assignmentId);
  }
}

// ---------------------------------------------------------------------------
// Profile / application registry
// ---------------------------------------------------------------------------

export class CreateExperienceProfileUseCase {
  constructor(
    private readonly repo: ExperienceRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    code: string;
    name: string;
    description?: string | null;
    productId?: string | null;
    compatibleRuntimeCodes?: string[];
    compatibleDeploymentProfileCodes?: string[];
    metadata?: Record<string, unknown>;
  }) {
    return this.outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client) => {
      const created = await this.repo.createProfile(
        {
          code: input.code.trim().toLowerCase(),
          name: input.name.trim(),
          description: input.description ?? null,
          productId: input.productId ?? null,
          profileStatus: ExperienceProfileStatus.DRAFT,
          compatibleRuntimeCodes: input.compatibleRuntimeCodes ?? [],
          compatibleDeploymentProfileCodes: input.compatibleDeploymentProfileCodes ?? [],
          metadata: input.metadata ?? {},
          createdBy: input.actorId,
          updatedBy: input.actorId,
        },
        client,
      );
      await this.repo.appendHistory(
        {
          resourceType: 'EXPERIENCE_PROFILE',
          resourceId: created.id,
          action: 'CREATE',
          actorId: input.actorId,
          toStatus: String(created.profileStatus),
          details: { code: created.code },
        },
        client,
      );
      await requireAudit(
        this.audit,
        {
          eventType: 'p7.experience.profile.created',
          actorId: input.actorId,
          subjectType: 'EXPERIENCE_PROFILE',
          subjectId: created.id,
          details: { code: created.code },
        },
        client,
      );
      return created;
    });
  }
}

export class PublishExperienceProfileUseCase {
  constructor(
    private readonly repo: ExperienceRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: { actorId: string; profileId: string; expectedVersion: number }) {
    const profile = await this.repo.getProfile(input.profileId);
    if (!profile) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Experience profile not found');
    }
    return this.outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client) => {
      const published = await this.repo.publishProfile(
        input.profileId,
        input.expectedVersion,
        input.actorId,
        client,
      );
      await this.repo.appendHistory(
        {
          resourceType: 'EXPERIENCE_PROFILE',
          resourceId: published.id,
          action: 'PUBLISH',
          actorId: input.actorId,
          fromStatus: String(profile.profileStatus),
          toStatus: String(published.profileStatus),
          details: {},
        },
        client,
      );
      await requireAudit(
        this.audit,
        {
          eventType: 'p7.experience.profile.published',
          actorId: input.actorId,
          subjectType: 'EXPERIENCE_PROFILE',
          subjectId: published.id,
          details: { code: published.code },
        },
        client,
      );
      return published;
    });
  }
}

export class CreateExperienceApplicationUseCase {
  constructor(
    private readonly repo: ExperienceRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    code: string;
    name: string;
    description?: string | null;
    productId?: string | null;
    applicationKind: string;
    experienceProfileId?: string | null;
    draftManifest: Record<string, unknown>;
    productVersion?: string | null;
    runtimeVersion?: string | null;
    apiCompatibilityVersion?: string | null;
    deploymentProfileCode?: string | null;
    configurationBundleCode?: string | null;
    entitlementSnapshotVersion?: string | null;
    metadata?: Record<string, unknown>;
  }) {
    if (!input.draftManifest || typeof input.draftManifest !== 'object') {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'draftManifest required', [
        { code: ExperienceErrorCode.VALIDATION },
      ]);
    }
    assertNoPlaintextSecrets(input.draftManifest);
    const kind = Object.values(ApplicationKind).includes(input.applicationKind as ApplicationKind)
      ? (input.applicationKind as ApplicationKind)
      : input.applicationKind;
    const checksum = checksumManifest(input.draftManifest);

    return this.outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client) => {
      const created = await this.repo.createApplication(
        {
          code: input.code.trim().toLowerCase(),
          name: input.name.trim(),
          description: input.description ?? null,
          productId: input.productId ?? null,
          applicationKind: kind,
          experienceProfileId: input.experienceProfileId ?? null,
          applicationStatus: ApplicationStatus.DRAFT,
          metadata: input.metadata ?? {},
          createdBy: input.actorId,
          updatedBy: input.actorId,
          draftManifest: redactExperienceSecrets(input.draftManifest),
          checksum,
          productVersion: input.productVersion ?? null,
          runtimeVersion: input.runtimeVersion ?? null,
          apiCompatibilityVersion: input.apiCompatibilityVersion ?? null,
          deploymentProfileCode: input.deploymentProfileCode ?? null,
          configurationBundleCode: input.configurationBundleCode ?? null,
          entitlementSnapshotVersion: input.entitlementSnapshotVersion ?? null,
        },
        client,
      );
      await this.repo.appendHistory(
        {
          resourceType: 'EXPERIENCE_APPLICATION',
          resourceId: created.application.id,
          action: 'CREATE',
          actorId: input.actorId,
          toStatus: String(created.application.applicationStatus),
          details: {
            code: created.application.code,
            versionNumber: created.version.versionNumber,
            checksum,
          },
        },
        client,
      );
      await requireAudit(
        this.audit,
        {
          eventType: 'p7.experience.application.created',
          actorId: input.actorId,
          subjectType: 'EXPERIENCE_APPLICATION',
          subjectId: created.application.id,
          details: { code: created.application.code },
        },
        client,
      );
      return created;
    });
  }
}

export class PublishExperienceApplicationUseCase {
  constructor(
    private readonly repo: ExperienceRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    applicationId: string;
    versionNumber: number;
    expectedVersion: number;
  }) {
    const application = await this.repo.getApplication(input.applicationId);
    if (!application) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Experience application not found');
    }
    const version = await this.repo.getApplicationVersion(input.applicationId, input.versionNumber);
    if (!version) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Application version not found');
    }
    return this.outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client) => {
      const published = await this.repo.publishApplicationVersion(
        input.applicationId,
        input.versionNumber,
        input.expectedVersion,
        input.actorId,
        client,
      );
      await this.repo.appendHistory(
        {
          resourceType: 'EXPERIENCE_APPLICATION',
          resourceId: published.id,
          action: 'PUBLISH',
          actorId: input.actorId,
          fromStatus: String(application.applicationStatus),
          toStatus: String(published.applicationStatus),
          details: { versionNumber: input.versionNumber },
        },
        client,
      );
      await requireAudit(
        this.audit,
        {
          eventType: 'p7.experience.application.published',
          actorId: input.actorId,
          subjectType: 'EXPERIENCE_APPLICATION',
          subjectId: published.id,
          details: { versionNumber: input.versionNumber },
        },
        client,
      );
      return published;
    });
  }
}

// ---------------------------------------------------------------------------
// Tenant assignment + provision / deactivate workflows
// ---------------------------------------------------------------------------

export class AssignTenantExperienceUseCase {
  constructor(
    private readonly repo: ExperienceRepositoryPort,
    private readonly auth: WorkflowAuthorizationPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    tenantId: string;
    productId: string;
    provisioningRequestId: string;
    experienceProfileId?: string | null;
    desiredManifest: Record<string, unknown>;
    subscriptionId?: string | null;
    accountId?: string | null;
    metadata?: Record<string, unknown>;
  }) {
    if (!input.provisioningRequestId?.trim()) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'provisioningRequestId required', [
        { code: ExperienceErrorCode.AUTHORIZATION_FAILED },
      ]);
    }

    const ready = await this.auth.getWorkflowReadyRequest(input.provisioningRequestId);
    if (!ready) {
      throw new DomainError(
        ErrorCode.FORBIDDEN,
        'P7.1 authorization not ready for experience assignment',
        [{ code: ExperienceErrorCode.AUTHORIZATION_FAILED }],
      );
    }
    const revalidated = await this.auth.revalidateBoundAuthorization({
      authorizationRowId: ready.authorizationRowId,
      authorizationVersion: ready.authorizationVersion,
      provisioningRequestId: input.provisioningRequestId,
    });
    if (!revalidated) {
      throw new DomainError(
        ErrorCode.FORBIDDEN,
        'P7.1 bound authorization revalidation failed (fail-closed)',
        [{ code: ExperienceErrorCode.AUTHORIZATION_FAILED }],
      );
    }

    if (input.experienceProfileId) {
      const profile = await this.repo.getProfile(input.experienceProfileId);
      if (!profile || profile.profileStatus !== ExperienceProfileStatus.PUBLISHED) {
        throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Experience profile must be PUBLISHED', [
          { code: ExperienceErrorCode.PROFILE_NOT_PUBLISHED },
        ]);
      }
    }

    if (!input.desiredManifest || typeof input.desiredManifest !== 'object') {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'desiredManifest required', [
        { code: ExperienceErrorCode.VALIDATION },
      ]);
    }
    const validated = validateDesiredManifest(input.desiredManifest);

    return this.outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client) => {
      const assignment = await this.repo.createAssignment(
        {
          tenantId: input.tenantId,
          productId: input.productId,
          subscriptionId: input.subscriptionId ?? revalidated.subscriptionId ?? null,
          accountId: input.accountId ?? revalidated.accountId ?? null,
          experienceProfileId: input.experienceProfileId ?? null,
          assignmentStatus: ExperienceAssignmentStatus.ASSIGNED,
          authorizationRowId: revalidated.authorizationRowId,
          authorizationVersion: revalidated.authorizationVersion,
          provisioningRequestId: input.provisioningRequestId,
          workflowId: null,
          desiredManifest: redactExperienceSecrets(validated as unknown as Record<string, unknown>),
          appliedManifest: {},
          appliedChecksum: null,
          driftStatus: ExperienceDriftStatus.NONE,
          lastDeployedAt: null,
          metadata: input.metadata ?? {},
          createdBy: input.actorId,
          updatedBy: input.actorId,
        },
        client,
      );
      await this.repo.appendHistory(
        {
          resourceType: 'TENANT_EXPERIENCE_ASSIGNMENT',
          resourceId: assignment.id,
          tenantId: assignment.tenantId,
          action: 'ASSIGN',
          actorId: input.actorId,
          toStatus: String(assignment.assignmentStatus),
          details: {
            experienceProfileId: assignment.experienceProfileId,
            provisioningRequestId: input.provisioningRequestId,
          },
        },
        client,
      );
      await requireAudit(
        this.audit,
        {
          eventType: 'p7.experience.assignment.created',
          actorId: input.actorId,
          subjectType: 'TENANT_EXPERIENCE_ASSIGNMENT',
          subjectId: assignment.id,
          details: { tenantId: assignment.tenantId, productId: assignment.productId },
        },
        client,
      );
      return assignment;
    });
  }
}

export class BindExperienceDomainUseCase {
  constructor(
    private readonly repo: ExperienceRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    assignmentId: string;
    hostname: string;
    domainKind?: 'SUBDOMAIN' | 'CUSTOM' | string;
  }) {
    const assignment = await this.repo.getAssignment(input.assignmentId);
    if (!assignment) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Experience assignment not found');
    }
    const hostCheck = validateHostname(input.hostname);
    if (!hostCheck.ok) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Invalid hostname', hostCheck.issues);
    }
    const hostname = input.hostname.trim().toLowerCase();
    const existing = await this.repo.getDomainByHostname(hostname);
    if (existing && existing.assignmentId !== input.assignmentId) {
      throw new DomainError(ErrorCode.CONFLICT, 'Hostname already bound to another assignment', [
        { code: ExperienceErrorCode.HOSTNAME_CONFLICT, hostname },
      ]);
    }
    if (existing && existing.assignmentId === input.assignmentId) {
      return existing;
    }

    const ownershipToken = issueOwnershipToken();
    const domainKind =
      input.domainKind === DomainKind.CUSTOM || input.domainKind === 'CUSTOM'
        ? DomainKind.CUSTOM
        : DomainKind.SUBDOMAIN;

    return this.outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client) => {
      const created = await this.repo.createDomainBinding(
        {
          assignmentId: assignment.id,
          tenantId: assignment.tenantId,
          hostname,
          domainKind,
          ownershipStatus: DomainOwnershipStatus.PENDING,
          ownershipToken,
          dnsStatus: DnsStatus.PENDING,
          tlsStatus: TlsStatus.PENDING,
          certificateRef: null,
          routeStatus: RouteStatus.PENDING,
          bindingStatus: DomainBindingStatus.PENDING,
          metadata: {},
          createdBy: input.actorId,
          updatedBy: input.actorId,
        },
        client,
      );
      await this.repo.appendHistory(
        {
          resourceType: 'EXPERIENCE_DOMAIN_BINDING',
          resourceId: created.id,
          tenantId: assignment.tenantId,
          action: 'BIND_DOMAIN',
          actorId: input.actorId,
          toStatus: String(created.bindingStatus),
          details: { hostname, assignmentId: assignment.id },
        },
        client,
      );
      await requireAudit(
        this.audit,
        {
          eventType: 'p7.experience.domain.bound',
          actorId: input.actorId,
          subjectType: 'EXPERIENCE_DOMAIN_BINDING',
          subjectId: created.id,
          details: { hostname, assignmentId: assignment.id },
        },
        client,
      );
      return created;
    });
  }
}

type WorkflowCreateStart = {
  execute(input: {
    actorId: string;
    idempotencyKey: string;
    definitionId: string;
    workflowType: string;
    inputSnapshot?: Record<string, unknown>;
    provisioningRequestId?: string | null;
    businessReference?: string | null;
  }): Promise<{ id: string; state: string }>;
};

type WorkflowStart = {
  execute(input: { actorId: string; workflowId: string }): Promise<{ id: string; state: string }>;
};

export class RequestExperienceProvisionUseCase {
  constructor(
    private readonly repo: ExperienceRepositoryPort,
    private readonly wfRepo: WorkflowRepositoryPort,
    private readonly auth: WorkflowAuthorizationPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
    private readonly createInstance: WorkflowCreateStart,
    private readonly startWorkflow: WorkflowStart,
  ) {}

  async execute(input: {
    actorId: string;
    correlationId: string;
    idempotencyKey: string;
    assignmentId: string;
    provisioningRequestId?: string | null;
  }) {
    const wfExisting = await this.wfRepo.getInstanceByIdempotencyKey(input.idempotencyKey);
    if (wfExisting) {
      return { workflow: wfExisting, assignment: await this.repo.getAssignment(input.assignmentId) };
    }

    const assignment = await this.repo.getAssignment(input.assignmentId);
    if (!assignment) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Experience assignment not found');
    }

    const provisioningRequestId =
      input.provisioningRequestId ?? assignment.provisioningRequestId ?? null;
    if (!assignment.authorizationRowId || assignment.authorizationVersion == null) {
      throw new DomainError(
        ErrorCode.FORBIDDEN,
        'Assignment has no bound P7.1 authorization (fail-closed)',
        [{ code: ExperienceErrorCode.AUTHORIZATION_FAILED }],
      );
    }
    const revalidated = await this.auth.revalidateBoundAuthorization({
      authorizationRowId: assignment.authorizationRowId,
      authorizationVersion: assignment.authorizationVersion,
      provisioningRequestId,
    });
    if (!revalidated) {
      throw new DomainError(
        ErrorCode.FORBIDDEN,
        'P7.1 authorization not valid for experience provisioning',
        [{ code: ExperienceErrorCode.AUTHORIZATION_FAILED }],
      );
    }

    const definition = await ensureExperienceDefinition(
      this.wfRepo,
      this.outbox,
      this.audit,
      input.actorId,
      'provision',
    );

    const instance = await this.createInstance.execute({
      actorId: input.actorId,
      idempotencyKey: input.idempotencyKey,
      definitionId: definition.id,
      workflowType: 'experience.provision',
      provisioningRequestId,
      businessReference: assignment.id,
      inputSnapshot: {
        assignmentId: assignment.id,
        tenantId: assignment.tenantId,
        productId: assignment.productId,
        experienceProfileId: assignment.experienceProfileId,
        authorizationRowId: assignment.authorizationRowId,
        authorizationVersion: assignment.authorizationVersion,
        provisioningRequestId,
        actorId: input.actorId,
        correlationId: input.correlationId,
      },
    });

    await this.outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client) => {
      await this.repo.updateAssignment(
        assignment.id,
        {
          workflowId: instance.id,
          assignmentStatus: ExperienceAssignmentStatus.PROVISIONING,
        },
        assignment.version,
        input.actorId,
        client,
      );
      await this.repo.appendHistory(
        {
          resourceType: 'TENANT_EXPERIENCE_ASSIGNMENT',
          resourceId: assignment.id,
          tenantId: assignment.tenantId,
          fromStatus: String(assignment.assignmentStatus),
          toStatus: ExperienceAssignmentStatus.PROVISIONING,
          action: 'LAUNCH_PROVISION',
          actorId: input.actorId,
          details: { workflowId: instance.id },
        },
        client,
      );
      await requireAudit(
        this.audit,
        {
          eventType: 'p7.experience.provision.requested',
          actorId: input.actorId,
          subjectType: 'TENANT_EXPERIENCE_ASSIGNMENT',
          subjectId: assignment.id,
          details: { workflowId: instance.id },
        },
        client,
      );
    });

    const started = await this.startWorkflow.execute({
      actorId: input.actorId,
      workflowId: instance.id,
    });
    return {
      workflow: started,
      assignment: await this.repo.getAssignment(assignment.id),
    };
  }
}

export class RequestExperienceDeactivateUseCase {
  constructor(
    private readonly repo: ExperienceRepositoryPort,
    private readonly wfRepo: WorkflowRepositoryPort,
    private readonly auth: WorkflowAuthorizationPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
    private readonly createInstance: WorkflowCreateStart,
    private readonly startWorkflow: WorkflowStart,
  ) {}

  async execute(input: {
    actorId: string;
    correlationId: string;
    idempotencyKey: string;
    assignmentId: string;
    provisioningRequestId?: string | null;
  }) {
    const wfExisting = await this.wfRepo.getInstanceByIdempotencyKey(input.idempotencyKey);
    if (wfExisting) {
      return { workflow: wfExisting, assignment: await this.repo.getAssignment(input.assignmentId) };
    }

    const assignment = await this.repo.getAssignment(input.assignmentId);
    if (!assignment) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Experience assignment not found');
    }

    const provisioningRequestId =
      input.provisioningRequestId ?? assignment.provisioningRequestId ?? null;
    if (!assignment.authorizationRowId || assignment.authorizationVersion == null) {
      throw new DomainError(
        ErrorCode.FORBIDDEN,
        'Assignment has no bound P7.1 authorization (fail-closed)',
        [{ code: ExperienceErrorCode.AUTHORIZATION_FAILED }],
      );
    }
    const revalidated = await this.auth.revalidateBoundAuthorization({
      authorizationRowId: assignment.authorizationRowId,
      authorizationVersion: assignment.authorizationVersion,
      provisioningRequestId,
    });
    if (!revalidated) {
      throw new DomainError(
        ErrorCode.FORBIDDEN,
        'P7.1 authorization not valid for experience deactivation',
        [{ code: ExperienceErrorCode.AUTHORIZATION_FAILED }],
      );
    }

    const definition = await ensureExperienceDefinition(
      this.wfRepo,
      this.outbox,
      this.audit,
      input.actorId,
      'deactivate',
    );

    const instance = await this.createInstance.execute({
      actorId: input.actorId,
      idempotencyKey: input.idempotencyKey,
      definitionId: definition.id,
      workflowType: 'experience.deactivate',
      provisioningRequestId,
      businessReference: assignment.id,
      inputSnapshot: {
        assignmentId: assignment.id,
        tenantId: assignment.tenantId,
        productId: assignment.productId,
        authorizationRowId: assignment.authorizationRowId,
        authorizationVersion: assignment.authorizationVersion,
        provisioningRequestId,
        actorId: input.actorId,
        correlationId: input.correlationId,
        operation: 'deactivate',
      },
    });

    await this.outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client) => {
      await this.repo.updateAssignment(
        assignment.id,
        {
          workflowId: instance.id,
          assignmentStatus: ExperienceAssignmentStatus.DEACTIVATING,
        },
        assignment.version,
        input.actorId,
        client,
      );
      await this.repo.appendHistory(
        {
          resourceType: 'TENANT_EXPERIENCE_ASSIGNMENT',
          resourceId: assignment.id,
          tenantId: assignment.tenantId,
          fromStatus: String(assignment.assignmentStatus),
          toStatus: ExperienceAssignmentStatus.DEACTIVATING,
          action: 'LAUNCH_DEACTIVATE',
          actorId: input.actorId,
          details: { workflowId: instance.id },
        },
        client,
      );
      await requireAudit(
        this.audit,
        {
          eventType: 'p7.experience.deactivate.requested',
          actorId: input.actorId,
          subjectType: 'TENANT_EXPERIENCE_ASSIGNMENT',
          subjectId: assignment.id,
          details: { workflowId: instance.id },
        },
        client,
      );
    });

    const started = await this.startWorkflow.execute({
      actorId: input.actorId,
      workflowId: instance.id,
    });
    return {
      workflow: started,
      assignment: await this.repo.getAssignment(assignment.id),
    };
  }
}
