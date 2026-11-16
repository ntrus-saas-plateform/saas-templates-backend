import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import type { ControlPlaneOutboxTransactionService } from '../../../../shared/messaging/control-plane-outbox-transaction.service.js';
import type { AuditEventRepositoryPort } from '../../domain/ports/audit-event-repository.port.js';
import { EDGE_P7_OUTBOX_TENANT } from '../../domain/provisioning/provisioning.events.js';
import type { ConfigurationRepositoryPort } from '../../domain/configuration-entitlement/configuration-repository.port.js';
import {
  assertNoEntitlementExpansion,
  checksumPayload,
  validateAgainstSchema,
} from '../../domain/configuration-entitlement/configuration-schema.engine.js';
import {
  AssignmentStatus,
  ConfigurationBundleStatus,
  ConfigurationDriftStatus,
  ConfigurationErrorCode,
  ConfigurationSchemaStatus,
  ConfigurationTemplateStatus,
  DeploymentStrategy,
  VersionRecordStatus,
} from '../../domain/configuration-entitlement/configuration.types.js';
import type { WorkflowAuthorizationPort } from '../../domain/workflow/workflow-authorization.port.js';
import type { WorkflowRepositoryPort } from '../../domain/workflow/workflow-repository.port.js';
import { WorkflowDefinitionStatus } from '../../domain/workflow/workflow.types.js';
import { validateDefinition } from '../../domain/workflow/workflow-definition.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string | null | undefined): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
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
      'Durable audit required for configuration mutation',
      [{ eventType: input.eventType }],
      err instanceof Error ? err : undefined,
    );
  }
}

/** Strip accidental secret-bearing fields before persistence / API output. */
export function redactConfigurationSecrets<T>(value: T): T {
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

type EntitlementMaps = {
  capabilities?: Record<string, unknown>;
  featureFlags?: Record<string, unknown>;
  quotas?: Record<string, unknown>;
  limits?: Record<string, unknown>;
};

function extractEntitlements(config: Record<string, unknown>): EntitlementMaps {
  const nested =
    config.entitlements && typeof config.entitlements === 'object'
      ? (config.entitlements as Record<string, unknown>)
      : config;
  return {
    capabilities:
      nested.capabilities && typeof nested.capabilities === 'object'
        ? (nested.capabilities as Record<string, unknown>)
        : {},
    featureFlags:
      nested.featureFlags && typeof nested.featureFlags === 'object'
        ? (nested.featureFlags as Record<string, unknown>)
        : {},
    quotas:
      nested.quotas && typeof nested.quotas === 'object'
        ? (nested.quotas as Record<string, unknown>)
        : {},
    limits:
      nested.limits && typeof nested.limits === 'object'
        ? (nested.limits as Record<string, unknown>)
        : {},
  };
}

// ---------------------------------------------------------------------------
// Workflow definitions (P7.8)
// ---------------------------------------------------------------------------

export const CONFIGURATION_WORKFLOW_DEFINITIONS = {
  deploy: {
    code: 'p78.configuration.deploy',
    name: 'P7.8 Configuration & Entitlement Deployment',
    description: 'Validate, deploy bundle, apply entitlements, verify deployment',
    snapshot: {
      steps: [
        {
          key: 'validate_bundle',
          type: 'HANDLER',
          handlerKey: 'configuration.validate_bundle',
          maxAttempts: 3,
          timeoutMs: 60_000,
        },
        {
          key: 'deploy_bundle',
          type: 'HANDLER',
          handlerKey: 'configuration.deploy_bundle',
          dependsOn: ['validate_bundle'],
          maxAttempts: 3,
          timeoutMs: 300_000,
          compensationHandlerKey: 'configuration.rollback_bundle',
        },
        {
          key: 'apply_entitlements',
          type: 'HANDLER',
          handlerKey: 'configuration.apply_entitlements',
          dependsOn: ['deploy_bundle'],
          maxAttempts: 3,
          timeoutMs: 120_000,
        },
        {
          key: 'verify_deployment',
          type: 'HANDLER',
          handlerKey: 'configuration.verify_deployment',
          dependsOn: ['apply_entitlements'],
          maxAttempts: 3,
          timeoutMs: 60_000,
        },
      ],
    },
  },
  rollback: {
    code: 'p78.configuration.rollback',
    name: 'P7.8 Configuration Rollback',
    description: 'Controlled rollback of a configuration deployment',
    snapshot: {
      steps: [
        {
          key: 'rollback_bundle',
          type: 'HANDLER',
          handlerKey: 'configuration.rollback_bundle',
          maxAttempts: 1,
          timeoutMs: 300_000,
        },
        {
          key: 'reconcile_entitlements',
          type: 'HANDLER',
          handlerKey: 'configuration.reconcile_entitlements',
          dependsOn: ['rollback_bundle'],
          maxAttempts: 3,
          timeoutMs: 120_000,
        },
      ],
    },
  },
  reconcile: {
    code: 'p78.configuration.reconcile',
    name: 'P7.8 Entitlement Reconciliation',
    description: 'Compare applied vs desired entitlements/config and record drift',
    snapshot: {
      steps: [
        {
          key: 'reconcile_entitlements',
          type: 'HANDLER',
          handlerKey: 'configuration.reconcile_entitlements',
          maxAttempts: 3,
          timeoutMs: 120_000,
        },
      ],
    },
  },
} as const;

export type ConfigurationWorkflowKind = keyof typeof CONFIGURATION_WORKFLOW_DEFINITIONS;

const WORKFLOW_RETRY_DEFAULTS = {
  maxAttempts: 3,
  initialDelayMs: 500,
  maxDelayMs: 15_000,
  multiplier: 2,
  jitterRatio: 0.2,
};

/**
 * Ensure a P7.8 workflow definition exists and is PUBLISHED (idempotent).
 * Exported for tests.
 */
export async function ensureConfigurationDefinition(
  repo: WorkflowRepositoryPort,
  outbox: ControlPlaneOutboxTransactionService,
  _audit: AuditEventRepositoryPort,
  actorId: string,
  kind: ConfigurationWorkflowKind = 'deploy',
): Promise<{ id: string }> {
  const def = CONFIGURATION_WORKFLOW_DEFINITIONS[kind];
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
    const publishExisting = async (d: { id: string; version: number; definitionStatus: string }) => {
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
        domain: 'configuration',
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

export class ListConfigurationUseCase {
  constructor(private readonly repo: ConfigurationRepositoryPort) {}

  schemas(filter: { limit?: number; offset?: number; status?: string; q?: string }) {
    return this.repo.listSchemas(filter);
  }
  schema(id: string) {
    return this.repo.getSchema(id);
  }
  templates(filter: { limit?: number; offset?: number; status?: string; q?: string }) {
    return this.repo.listTemplates(filter);
  }
  template(id: string) {
    return this.repo.getTemplate(id);
  }
  bundles(filter: { limit?: number; offset?: number; status?: string; q?: string }) {
    return this.repo.listBundles(filter);
  }
  bundle(id: string) {
    return this.repo.getBundle(id);
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
  entitlements(assignmentId: string, limit?: number) {
    return this.repo.listEntitlementDeployments(assignmentId, limit);
  }
}

// ---------------------------------------------------------------------------
// Schema / template / bundle registry
// ---------------------------------------------------------------------------

export class CreateConfigurationSchemaUseCase {
  constructor(
    private readonly repo: ConfigurationRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    code: string;
    name: string;
    description?: string | null;
    productId?: string | null;
    schemaVersion?: number;
    jsonSchema: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  }) {
    if (!input.jsonSchema || typeof input.jsonSchema !== 'object') {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'jsonSchema required', [
        { code: ConfigurationErrorCode.SCHEMA_INVALID },
      ]);
    }
    const checksum = checksumPayload(input.jsonSchema);
    return this.outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client) => {
      const created = await this.repo.createSchema(
        {
          code: input.code.trim().toLowerCase(),
          name: input.name.trim(),
          description: input.description ?? null,
          productId: input.productId ?? null,
          schemaVersion: input.schemaVersion ?? 1,
          jsonSchema: input.jsonSchema,
          checksum,
          status: ConfigurationSchemaStatus.ACTIVE,
          metadata: input.metadata ?? {},
          createdBy: input.actorId,
        },
        client,
      );
      await this.repo.appendHistory(
        {
          resourceType: 'CONFIGURATION_SCHEMA',
          resourceId: created.id,
          action: 'CREATE',
          actorId: input.actorId,
          toStatus: created.status,
          details: { code: created.code, schemaVersion: created.schemaVersion },
        },
        client,
      );
      await requireAudit(
        this.audit,
        {
          eventType: 'p7.configuration.schema.created',
          actorId: input.actorId,
          subjectType: 'CONFIGURATION_SCHEMA',
          subjectId: created.id,
          details: { code: created.code },
        },
        client,
      );
      return created;
    });
  }
}

export class CreateConfigurationTemplateUseCase {
  constructor(
    private readonly repo: ConfigurationRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    code: string;
    name: string;
    description?: string | null;
    productId?: string | null;
    schemaId: string;
    runtimeProfileCode?: string | null;
    deploymentProfileCode?: string | null;
    draftPayload: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  }) {
    const schema = await this.repo.getSchema(input.schemaId);
    if (!schema) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Configuration schema not found', [
        { code: ConfigurationErrorCode.SCHEMA_INVALID },
      ]);
    }
    const validation = validateAgainstSchema(schema.jsonSchema, input.draftPayload);
    if (!validation.ok) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Template payload failed schema validation', [
        { code: ConfigurationErrorCode.SCHEMA_INVALID, issues: validation.issues },
      ]);
    }
    const checksum = checksumPayload(input.draftPayload);
    return this.outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client) => {
      const created = await this.repo.createTemplate(
        {
          code: input.code.trim().toLowerCase(),
          name: input.name.trim(),
          description: input.description ?? null,
          productId: input.productId ?? null,
          schemaId: input.schemaId,
          runtimeProfileCode: input.runtimeProfileCode ?? null,
          deploymentProfileCode: input.deploymentProfileCode ?? null,
          templateStatus: ConfigurationTemplateStatus.DRAFT,
          metadata: input.metadata ?? {},
          createdBy: input.actorId,
          updatedBy: input.actorId,
          draftPayload: input.draftPayload,
          checksum,
        },
        client,
      );
      await this.repo.appendHistory(
        {
          resourceType: 'CONFIGURATION_TEMPLATE',
          resourceId: created.template.id,
          action: 'CREATE',
          actorId: input.actorId,
          toStatus: created.template.templateStatus,
          details: { code: created.template.code, versionNumber: created.version.versionNumber },
        },
        client,
      );
      await requireAudit(
        this.audit,
        {
          eventType: 'p7.configuration.template.created',
          actorId: input.actorId,
          subjectType: 'CONFIGURATION_TEMPLATE',
          subjectId: created.template.id,
          details: { code: created.template.code },
        },
        client,
      );
      return created;
    });
  }
}

export class PublishConfigurationTemplateUseCase {
  constructor(
    private readonly repo: ConfigurationRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    templateId: string;
    versionNumber: number;
    expectedVersion: number;
  }) {
    const template = await this.repo.getTemplate(input.templateId);
    if (!template) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Configuration template not found');
    }
    const version = await this.repo.getTemplateVersion(input.templateId, input.versionNumber);
    if (!version) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Template version not found');
    }
    return this.outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client) => {
      const published = await this.repo.publishTemplateVersion(
        input.templateId,
        input.versionNumber,
        input.expectedVersion,
        input.actorId,
        client,
      );
      await this.repo.appendHistory(
        {
          resourceType: 'CONFIGURATION_TEMPLATE',
          resourceId: published.id,
          action: 'PUBLISH',
          actorId: input.actorId,
          fromStatus: template.templateStatus,
          toStatus: published.templateStatus,
          details: { versionNumber: input.versionNumber },
        },
        client,
      );
      await requireAudit(
        this.audit,
        {
          eventType: 'p7.configuration.template.published',
          actorId: input.actorId,
          subjectType: 'CONFIGURATION_TEMPLATE',
          subjectId: published.id,
          details: { versionNumber: input.versionNumber },
        },
        client,
      );
      return published;
    });
  }
}

export class CreateConfigurationBundleUseCase {
  constructor(
    private readonly repo: ConfigurationRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    code: string;
    name: string;
    description?: string | null;
    productId?: string | null;
    templateRefs: Array<{ templateId: string; versionNumber: number }>;
    dependencyRefs?: string[];
    payload?: Record<string, unknown>;
    rolloutPolicy?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  }) {
    if (!input.templateRefs?.length) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'templateRefs required', [
        { code: ConfigurationErrorCode.DEPENDENCY_MISSING },
      ]);
    }
    for (const ref of input.templateRefs) {
      const tv = await this.repo.getTemplateVersion(ref.templateId, ref.versionNumber);
      if (!tv) {
        throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Template version missing', [
          { code: ConfigurationErrorCode.DEPENDENCY_MISSING, templateId: ref.templateId },
        ]);
      }
    }
    const payload = input.payload ?? {};
    const draft = {
      templateRefs: input.templateRefs,
      dependencyRefs: input.dependencyRefs ?? [],
      payload,
      checksum: checksumPayload({ templateRefs: input.templateRefs, payload }),
      rolloutPolicy: input.rolloutPolicy ?? { strategy: 'ATOMIC' },
    };
    return this.outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client) => {
      const created = await this.repo.createBundle(
        {
          code: input.code.trim().toLowerCase(),
          name: input.name.trim(),
          description: input.description ?? null,
          productId: input.productId ?? null,
          bundleStatus: ConfigurationBundleStatus.DRAFT,
          metadata: input.metadata ?? {},
          createdBy: input.actorId,
          updatedBy: input.actorId,
          draft,
        },
        client,
      );
      await this.repo.appendHistory(
        {
          resourceType: 'CONFIGURATION_BUNDLE',
          resourceId: created.bundle.id,
          action: 'CREATE',
          actorId: input.actorId,
          toStatus: created.bundle.bundleStatus,
          details: { code: created.bundle.code, checksum: draft.checksum },
        },
        client,
      );
      await requireAudit(
        this.audit,
        {
          eventType: 'p7.configuration.bundle.created',
          actorId: input.actorId,
          subjectType: 'CONFIGURATION_BUNDLE',
          subjectId: created.bundle.id,
          details: { code: created.bundle.code },
        },
        client,
      );
      return created;
    });
  }
}

export class PublishConfigurationBundleUseCase {
  constructor(
    private readonly repo: ConfigurationRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    bundleId: string;
    versionNumber: number;
    expectedVersion: number;
  }) {
    const bundle = await this.repo.getBundle(input.bundleId);
    if (!bundle) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Configuration bundle not found');
    }
    const version = await this.repo.getBundleVersion(input.bundleId, input.versionNumber);
    if (!version) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Bundle version not found');
    }
    for (const ref of version.templateRefs) {
      const tv = await this.repo.getTemplateVersion(ref.templateId, ref.versionNumber);
      if (!tv || tv.status !== VersionRecordStatus.PUBLISHED) {
        throw new DomainError(
          ErrorCode.VALIDATION_ERROR,
          'All template refs must be PUBLISHED before bundle publish',
          [{ code: ConfigurationErrorCode.BUNDLE_NOT_PUBLISHED, templateId: ref.templateId }],
        );
      }
    }
    const expectedChecksum = checksumPayload({
      templateRefs: version.templateRefs,
      payload: version.payload,
    });
    if (expectedChecksum !== version.checksum) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Bundle checksum mismatch', [
        { code: ConfigurationErrorCode.CHECKSUM_MISMATCH },
      ]);
    }

    return this.outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client) => {
      const published = await this.repo.publishBundleVersion(
        input.bundleId,
        input.versionNumber,
        input.expectedVersion,
        input.actorId,
        client,
      );
      await this.repo.appendHistory(
        {
          resourceType: 'CONFIGURATION_BUNDLE',
          resourceId: published.id,
          action: 'PUBLISH',
          actorId: input.actorId,
          fromStatus: bundle.bundleStatus,
          toStatus: published.bundleStatus,
          details: { versionNumber: input.versionNumber, checksum: version.checksum },
        },
        client,
      );
      await requireAudit(
        this.audit,
        {
          eventType: 'p7.configuration.bundle.published',
          actorId: input.actorId,
          subjectType: 'CONFIGURATION_BUNDLE',
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
// Tenant assignment + deploy / rollback workflows
// ---------------------------------------------------------------------------

export class AssignTenantConfigurationUseCase {
  constructor(
    private readonly repo: ConfigurationRepositoryPort,
    private readonly auth: WorkflowAuthorizationPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    tenantId: string;
    productId: string;
    provisioningRequestId: string;
    bundleId: string;
    bundleVersion: number;
    desiredConfig: Record<string, unknown>;
    /** P5 granted snapshot — required for expansion check (fail-closed). */
    grantedEntitlements: EntitlementMaps;
    subscriptionId?: string | null;
    accountId?: string | null;
    entitlementSnapshotRef?: string | null;
    entitlementVersion?: string | null;
    deploymentStrategy?: string;
    metadata?: Record<string, unknown>;
  }) {
    if (!input.provisioningRequestId?.trim()) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'provisioningRequestId required', [
        { code: ConfigurationErrorCode.AUTHORIZATION_FAILED },
      ]);
    }

    const ready = await this.auth.getWorkflowReadyRequest(input.provisioningRequestId);
    if (!ready) {
      throw new DomainError(
        ErrorCode.FORBIDDEN,
        'P7.1 authorization not ready for configuration assignment',
        [{ code: ConfigurationErrorCode.AUTHORIZATION_FAILED }],
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
        [{ code: ConfigurationErrorCode.AUTHORIZATION_FAILED }],
      );
    }

    const bundle = await this.repo.getBundle(input.bundleId);
    if (!bundle || bundle.bundleStatus !== ConfigurationBundleStatus.PUBLISHED) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Bundle must be PUBLISHED', [
        { code: ConfigurationErrorCode.BUNDLE_NOT_PUBLISHED },
      ]);
    }
    const bv = await this.repo.getBundleVersion(input.bundleId, input.bundleVersion);
    if (!bv || bv.status !== VersionRecordStatus.PUBLISHED) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Bundle version must be PUBLISHED', [
        { code: ConfigurationErrorCode.BUNDLE_NOT_PUBLISHED },
      ]);
    }

    const desiredEntitlements = extractEntitlements(input.desiredConfig);
    const expansion = assertNoEntitlementExpansion({
      granted: input.grantedEntitlements,
      desired: desiredEntitlements,
    });
    if (!expansion.ok) {
      throw new DomainError(
        ErrorCode.FORBIDDEN,
        'Desired entitlements expand beyond P5 granted snapshot',
        [{ code: ConfigurationErrorCode.ENTITLEMENT_EXPANSION, issues: expansion.issues }],
      );
    }

    return this.outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client) => {
      const assignment = await this.repo.createAssignment(
        {
          tenantId: input.tenantId,
          productId: input.productId,
          subscriptionId: input.subscriptionId ?? revalidated.subscriptionId ?? null,
          accountId: input.accountId ?? revalidated.accountId ?? null,
          bundleId: input.bundleId,
          bundleVersion: input.bundleVersion,
          bundleChecksum: bv.checksum,
          assignmentStatus: AssignmentStatus.ASSIGNED,
          desiredConfig: redactConfigurationSecrets(input.desiredConfig),
          appliedConfig: {},
          appliedChecksum: null,
          entitlementSnapshotRef: input.entitlementSnapshotRef ?? null,
          entitlementVersion: input.entitlementVersion ?? null,
          authorizationRowId: revalidated.authorizationRowId,
          authorizationVersion: revalidated.authorizationVersion,
          provisioningRequestId: input.provisioningRequestId,
          workflowId: null,
          deploymentStrategy: input.deploymentStrategy ?? DeploymentStrategy.ATOMIC,
          driftStatus: ConfigurationDriftStatus.NONE,
          lastDeployedAt: null,
          lastReconciledAt: null,
          metadata: input.metadata ?? {},
          createdBy: input.actorId,
          updatedBy: input.actorId,
        },
        client,
      );
      await this.repo.appendHistory(
        {
          resourceType: 'TENANT_CONFIGURATION_ASSIGNMENT',
          resourceId: assignment.id,
          tenantId: assignment.tenantId,
          action: 'ASSIGN',
          actorId: input.actorId,
          toStatus: assignment.assignmentStatus,
          details: {
            bundleId: assignment.bundleId,
            bundleVersion: assignment.bundleVersion,
            provisioningRequestId: input.provisioningRequestId,
          },
        },
        client,
      );
      await requireAudit(
        this.audit,
        {
          eventType: 'p7.configuration.assignment.created',
          actorId: input.actorId,
          subjectType: 'TENANT_CONFIGURATION_ASSIGNMENT',
          subjectId: assignment.id,
          details: { tenantId: assignment.tenantId, productId: assignment.productId },
        },
        client,
      );
      return assignment;
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

export class RequestConfigurationDeploymentUseCase {
  constructor(
    private readonly repo: ConfigurationRepositoryPort,
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
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Configuration assignment not found');
    }

    const provisioningRequestId =
      input.provisioningRequestId ?? assignment.provisioningRequestId ?? null;
    if (!assignment.authorizationRowId || assignment.authorizationVersion == null) {
      throw new DomainError(
        ErrorCode.FORBIDDEN,
        'Assignment has no bound P7.1 authorization (fail-closed)',
        [{ code: ConfigurationErrorCode.AUTHORIZATION_FAILED }],
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
        'P7.1 authorization not valid for deployment',
        [{ code: ConfigurationErrorCode.AUTHORIZATION_FAILED }],
      );
    }

    const definition = await ensureConfigurationDefinition(
      this.wfRepo,
      this.outbox,
      this.audit,
      input.actorId,
      'deploy',
    );

    const instance = await this.createInstance.execute({
      actorId: input.actorId,
      idempotencyKey: input.idempotencyKey,
      definitionId: definition.id,
      workflowType: 'configuration.deploy',
      provisioningRequestId,
      businessReference: assignment.id,
      inputSnapshot: {
        assignmentId: assignment.id,
        tenantId: assignment.tenantId,
        productId: assignment.productId,
        bundleId: assignment.bundleId,
        bundleVersion: assignment.bundleVersion,
        bundleChecksum: assignment.bundleChecksum,
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
          assignmentStatus: AssignmentStatus.DEPLOYING,
        },
        assignment.version,
        input.actorId,
        client,
      );
      await this.repo.appendHistory(
        {
          resourceType: 'TENANT_CONFIGURATION_ASSIGNMENT',
          resourceId: assignment.id,
          tenantId: assignment.tenantId,
          fromStatus: String(assignment.assignmentStatus),
          toStatus: AssignmentStatus.DEPLOYING,
          action: 'LAUNCH_DEPLOY',
          actorId: input.actorId,
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

export class RequestConfigurationRollbackUseCase {
  constructor(
    private readonly repo: ConfigurationRepositoryPort,
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
    reason?: string | null;
  }) {
    const wfExisting = await this.wfRepo.getInstanceByIdempotencyKey(input.idempotencyKey);
    if (wfExisting) {
      return { workflow: wfExisting, assignment: await this.repo.getAssignment(input.assignmentId) };
    }

    const assignment = await this.repo.getAssignment(input.assignmentId);
    if (!assignment) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Configuration assignment not found');
    }

    // Reject rollback that would restore revoked rights — auth must still be valid.
    if (!assignment.authorizationRowId || assignment.authorizationVersion == null) {
      throw new DomainError(
        ErrorCode.FORBIDDEN,
        'Cannot rollback without bound authorization (fail-closed)',
        [{ code: ConfigurationErrorCode.ROLLBACK_FORBIDDEN }],
      );
    }
    const revalidated = await this.auth.revalidateBoundAuthorization({
      authorizationRowId: assignment.authorizationRowId,
      authorizationVersion: assignment.authorizationVersion,
      provisioningRequestId: assignment.provisioningRequestId,
    });
    if (!revalidated) {
      throw new DomainError(
        ErrorCode.FORBIDDEN,
        'Rollback rejected: entitlement/authorization no longer valid (would restore revoked rights)',
        [{ code: ConfigurationErrorCode.ENTITLEMENT_REVOKED }],
      );
    }

    const definition = await ensureConfigurationDefinition(
      this.wfRepo,
      this.outbox,
      this.audit,
      input.actorId,
      'rollback',
    );

    const instance = await this.createInstance.execute({
      actorId: input.actorId,
      idempotencyKey: input.idempotencyKey,
      definitionId: definition.id,
      workflowType: 'configuration.rollback',
      provisioningRequestId: assignment.provisioningRequestId,
      businessReference: assignment.id,
      inputSnapshot: {
        assignmentId: assignment.id,
        tenantId: assignment.tenantId,
        productId: assignment.productId,
        authorizationRowId: assignment.authorizationRowId,
        authorizationVersion: assignment.authorizationVersion,
        provisioningRequestId: assignment.provisioningRequestId,
        actorId: input.actorId,
        correlationId: input.correlationId,
        reason: input.reason ?? null,
        operation: 'rollback',
      },
    });

    await this.outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client) => {
      await this.repo.updateAssignment(
        assignment.id,
        {
          workflowId: instance.id,
          assignmentStatus: AssignmentStatus.ROLLBACK_PENDING,
        },
        assignment.version,
        input.actorId,
        client,
      );
      await this.repo.appendHistory(
        {
          resourceType: 'TENANT_CONFIGURATION_ASSIGNMENT',
          resourceId: assignment.id,
          tenantId: assignment.tenantId,
          fromStatus: String(assignment.assignmentStatus),
          toStatus: AssignmentStatus.ROLLBACK_PENDING,
          action: 'LAUNCH_ROLLBACK',
          reason: input.reason ?? null,
          actorId: input.actorId,
          details: { workflowId: instance.id },
        },
        client,
      );
      await requireAudit(
        this.audit,
        {
          eventType: 'p7.configuration.rollback.requested',
          actorId: input.actorId,
          subjectType: 'TENANT_CONFIGURATION_ASSIGNMENT',
          subjectId: assignment.id,
          details: { workflowId: instance.id, reason: input.reason ?? null },
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

export class RequestConfigurationReconcileUseCase {
  constructor(
    private readonly repo: ConfigurationRepositoryPort,
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
  }) {
    const wfExisting = await this.wfRepo.getInstanceByIdempotencyKey(input.idempotencyKey);
    if (wfExisting) {
      return { workflow: wfExisting, assignment: await this.repo.getAssignment(input.assignmentId) };
    }

    const assignment = await this.repo.getAssignment(input.assignmentId);
    if (!assignment) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Configuration assignment not found');
    }
    if (!assignment.authorizationRowId || assignment.authorizationVersion == null) {
      throw new DomainError(
        ErrorCode.FORBIDDEN,
        'Assignment has no bound P7.1 authorization (fail-closed)',
        [{ code: ConfigurationErrorCode.AUTHORIZATION_FAILED }],
      );
    }
    const revalidated = await this.auth.revalidateBoundAuthorization({
      authorizationRowId: assignment.authorizationRowId,
      authorizationVersion: assignment.authorizationVersion,
      provisioningRequestId: assignment.provisioningRequestId,
    });
    if (!revalidated) {
      throw new DomainError(
        ErrorCode.FORBIDDEN,
        'P7.1 authorization not valid for entitlement reconciliation',
        [{ code: ConfigurationErrorCode.AUTHORIZATION_FAILED }],
      );
    }

    const definition = await ensureConfigurationDefinition(
      this.wfRepo,
      this.outbox,
      this.audit,
      input.actorId,
      'reconcile',
    );

    const instance = await this.createInstance.execute({
      actorId: input.actorId,
      idempotencyKey: input.idempotencyKey,
      definitionId: definition.id,
      workflowType: 'configuration.reconcile',
      provisioningRequestId: assignment.provisioningRequestId,
      businessReference: assignment.id,
      inputSnapshot: {
        assignmentId: assignment.id,
        tenantId: assignment.tenantId,
        productId: assignment.productId,
        authorizationRowId: assignment.authorizationRowId,
        authorizationVersion: assignment.authorizationVersion,
        provisioningRequestId: assignment.provisioningRequestId,
        actorId: input.actorId,
        correlationId: input.correlationId,
        operation: 'reconcile',
      },
    });

    await this.outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client) => {
      await this.repo.appendHistory(
        {
          resourceType: 'TENANT_CONFIGURATION_ASSIGNMENT',
          resourceId: assignment.id,
          tenantId: assignment.tenantId,
          fromStatus: String(assignment.assignmentStatus),
          toStatus: String(assignment.assignmentStatus),
          action: 'LAUNCH_RECONCILE',
          actorId: input.actorId,
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
