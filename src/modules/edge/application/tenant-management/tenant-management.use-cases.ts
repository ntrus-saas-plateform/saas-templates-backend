import { randomUUID } from 'node:crypto';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import type { ControlPlaneOutboxTransactionService } from '../../../../shared/messaging/control-plane-outbox-transaction.service.js';
import type { AuditEventRepositoryPort } from '../../domain/ports/audit-event-repository.port.js';
import { LifecycleStatus } from '../../domain/tenant-lifecycle/lifecycle.types.js';
import {
  assertAdministrativeTransition,
  assertJustification,
  assertNotLegalHold,
  assertSeparationOfDuties,
  canRequestLifecycle,
  isApprovableStatus,
  isDedicatedGovernanceApprovable,
  nextStatusAfterApproval,
  slugifyTenantCode,
  unavailableGovernanceCheck,
} from '../../domain/tenant-management/tenant-management-policy.js';
import {
  TENANT_MANAGEMENT_REPOSITORY_PORT,
  type TenantManagementRepositoryPort,
} from '../../domain/tenant-management/tenant-management-repository.port.js';
import {
  buildTenantManagementOutboxEvent,
  EDGE_P8_OUTBOX_TENANT,
  TenantManagementEventTypes,
} from '../../domain/tenant-management/tenant-management.events.js';
import {
  AdministrativeStatus,
  EnvironmentClassification,
  ExceptionStatus,
  ExceptionType,
  GovernanceRequestStatus,
  GovernanceStatus,
  HealthStatus,
  LifecycleRequestType,
  MigrationRequestStatus,
  MigrationType,
  RecoveryPriority,
  RecoveryRequestStatus,
  RecoveryType,
  ReconciliationFindingType,
  RiskLevel,
  TechnicalStatus,
  TenantClassification,
  TerminationRequestStatus,
  type Tenant360Overview,
  type TenantRegistryRecord,
  type TenantSearchFilter,
} from '../../domain/tenant-management/tenant-management.types.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FRESHNESS_MS = 15 * 60 * 1000;

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
      'Durable audit required for tenant management mutation',
      [{ eventType: input.eventType }],
      err instanceof Error ? err : undefined,
    );
  }
}

function computeFreshness(observedAt: Date | null): 'FRESH' | 'STALE' | 'UNKNOWN' {
  if (!observedAt) return 'UNKNOWN';
  const age = Date.now() - observedAt.getTime();
  if (age <= FRESHNESS_MS) return 'FRESH';
  return 'STALE';
}

function mapP7LifecycleToTechnical(lifecycleStatus: string | null): TechnicalStatus {
  if (!lifecycleStatus) return TechnicalStatus.UNKNOWN;
  switch (lifecycleStatus) {
    case LifecycleStatus.ACTIVE:
      return TechnicalStatus.ACTIVE;
    case LifecycleStatus.SUSPENDED:
      return TechnicalStatus.UNAVAILABLE;
    case LifecycleStatus.SUSPENDING:
      return TechnicalStatus.DEPROVISIONING;
    case LifecycleStatus.RESUMING:
      return TechnicalStatus.RECOVERING;
    case LifecycleStatus.MIGRATING:
      return TechnicalStatus.MIGRATING;
    case LifecycleStatus.ARCHIVING:
    case LifecycleStatus.DEPROVISIONING:
      return TechnicalStatus.DEPROVISIONING;
    case LifecycleStatus.ARCHIVED:
      return TechnicalStatus.UNKNOWN;
    case LifecycleStatus.RESTORING:
      return TechnicalStatus.RECOVERING;
    case LifecycleStatus.DEPROVISIONED:
    case LifecycleStatus.DATA_PURGED:
    case LifecycleStatus.FAILED:
      return TechnicalStatus.FAILED;
    default:
      return TechnicalStatus.UNKNOWN;
  }
}

function deriveTenantCode(productTenantId: string): string {
  const short = productTenantId.replace(/-/g, '').slice(0, 12);
  return `tn-${short}`;
}

export class ListTenantsUseCase {
  constructor(private readonly repo: TenantManagementRepositoryPort) {}

  async execute(filter: TenantSearchFilter) {
    return this.repo.search(filter);
  }
}

export class GetTenantUseCase {
  constructor(private readonly repo: TenantManagementRepositoryPort) {}

  async execute(id: string) {
    const tenant = await this.repo.getById(id);
    if (!tenant) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Tenant registry record not found');
    }
    return tenant;
  }
}

export class GetTenant360UseCase {
  constructor(private readonly repo: TenantManagementRepositoryPort) {}

  async execute(id: string): Promise<Tenant360Overview> {
    const registry = await this.repo.getById(id);
    if (!registry) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Tenant registry record not found');
    }
    const [tags, notes, exceptions, lifecycleRequests, findings] = await Promise.all([
      this.repo.listTags(id),
      this.repo.listNotes(id, 50),
      this.repo.listExceptions({ tenantRegistryId: id, status: ExceptionStatus.ACTIVE, limit: 1 }),
      this.repo.listLifecycleRequests({
        tenantRegistryId: id,
        status: GovernanceRequestStatus.WAITING_APPROVAL,
        limit: 1,
      }),
      this.repo.listFindings({ tenantRegistryId: id, status: 'OPEN', limit: 1 }),
    ]);

    const technicalFreshness = computeFreshness(registry.technicalObservedAt);
    const technicalStatus = String(registry.technicalStatus);

    const healthFreshness = computeFreshness(registry.healthObservedAt);
    const healthStatus =
      healthFreshness === 'STALE' ? HealthStatus.STALE : String(registry.healthStatus);

    const commercialAvailability =
      registry.accountId && registry.subscriptionId
        ? ('AVAILABLE' as const)
        : registry.accountId || registry.subscriptionId
          ? ('PARTIAL' as const)
          : ('UNAVAILABLE' as const);

    return {
      registry,
      tags,
      notes,
      commercial: {
        accountId: registry.accountId,
        subscriptionId: registry.subscriptionId,
        productId: registry.productId,
        source: 'registry_projection',
        syncedAt: registry.lastSyncedAt?.toISOString() ?? null,
        availability: commercialAvailability,
      },
      technical: {
        technicalStatus,
        lifecycleRecordId: registry.lifecycleRecordId,
        activationRecordId: registry.activationRecordId,
        provisioningRequestId: registry.provisioningRequestId,
        observedAt: registry.technicalObservedAt?.toISOString() ?? null,
        freshness: technicalFreshness,
        source: 'p7_projection',
      },
      health: {
        status: healthStatus,
        observedAt: registry.healthObservedAt?.toISOString() ?? null,
        freshness: healthFreshness,
      },
      openExceptions: exceptions.total,
      pendingLifecycleRequests: lifecycleRequests.total,
      openFindings: findings.total,
    };
  }
}

export class RegisterTenantUseCase {
  constructor(
    private readonly repo: TenantManagementRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    productTenantId: string;
    tenantCode: string;
    displayName: string;
    productId: string;
    tenantSlug?: string | null;
    productCode?: string | null;
    accountId?: string | null;
    subscriptionId?: string | null;
    classification?: string;
    region?: string | null;
    metadata?: Record<string, unknown>;
    correlationId?: string | null;
  }) {
    if (!isUuid(input.productId)) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'productId must be a valid UUID');
    }
    if (!isUuid(input.productTenantId)) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'productTenantId must be a valid UUID');
    }
    const code = input.tenantCode.trim();
    if (!code) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'tenantCode is required');
    }
    const slug = (input.tenantSlug?.trim() || slugifyTenantCode(code)) || slugifyTenantCode(code);
    const correlationId = input.correlationId?.trim() || randomUUID();

    return this.outbox.runWithOutbox(EDGE_P8_OUTBOX_TENANT, async (client, enqueue) => {
      const existing = await this.repo.getByProductTenantId(input.productTenantId);
      const now = new Date();
      const base: Omit<
        TenantRegistryRecord,
        'id' | 'createdAt' | 'updatedAt' | 'version'
      > = {
        productTenantId: input.productTenantId,
        tenantCode: code,
        tenantSlug: slug,
        displayName: input.displayName.trim(),
        legalNameRef: null,
        productId: input.productId,
        productCode: input.productCode ?? null,
        accountId: input.accountId ?? null,
        subscriptionId: input.subscriptionId ?? null,
        classification: input.classification ?? TenantClassification.STANDARD,
        segment: null,
        deploymentProfile: null,
        environmentClassification: EnvironmentClassification.PRODUCTION,
        region: input.region ?? null,
        administrativeStatus: AdministrativeStatus.PENDING_REVIEW,
        technicalStatus: TechnicalStatus.UNKNOWN,
        governanceStatus: GovernanceStatus.COMPLIANT,
        healthStatus: HealthStatus.UNKNOWN,
        riskLevel: RiskLevel.UNKNOWN,
        platformTenantRef: null,
        provisioningRequestId: null,
        activationRecordId: null,
        lifecycleRecordId: null,
        internalOwnerId: null,
        operationalTeam: null,
        supportClassification: null,
        locale: null,
        timezone: null,
        defaultLanguage: null,
        dataResidencyRef: null,
        retentionPolicyRef: null,
        securityPolicyRef: null,
        legalHold: false,
        deletionProtection: true,
        lastAdminActivityAt: now,
        lastSyncedAt: null,
        technicalObservedAt: null,
        healthObservedAt: null,
        metadata: input.metadata ?? {},
        createdBy: input.actorId,
        updatedBy: input.actorId,
      };

      const record = existing
        ? await this.repo.upsertByProductTenantId(
            { ...base, id: existing.id, version: existing.version },
            client,
          )
        : await this.repo.registerTenant(base, client);

      await enqueue(
        buildTenantManagementOutboxEvent({
          eventType: TenantManagementEventTypes.REGISTERED,
          aggregateId: record.id,
          correlationId,
          payload: {
            productTenantId: record.productTenantId,
            tenantCode: record.tenantCode,
            productId: record.productId,
            actorId: input.actorId,
          },
        }),
      );

      await this.repo.appendActivity(
        {
          tenantRegistryId: record.id,
          productTenantId: record.productTenantId,
          eventType: 'TENANT_REGISTERED',
          action: existing ? 'UPSERT' : 'REGISTER',
          actorId: input.actorId,
          actorType: 'ADMIN',
          source: 'p8.tenant_management',
          outcome: 'SUCCESS',
          reason: null,
          correlationId,
          causationId: null,
          beforeRef: existing ? { version: existing.version } : null,
          afterRef: { id: record.id, version: record.version },
          evidenceRef: null,
          details: { tenantCode: record.tenantCode },
        },
        client,
      );

      await requireAudit(
        this.audit,
        {
          eventType: TenantManagementEventTypes.REGISTERED,
          actorId: input.actorId,
          subjectType: 'TENANT_REGISTRY',
          subjectId: record.id,
          details: {
            productTenantId: record.productTenantId,
            tenantCode: record.tenantCode,
          },
        },
        client,
      );

      return record;
    });
  }
}

export class SyncTenantsFromP7UseCase {
  constructor(private readonly repo: TenantManagementRepositoryPort) {}

  async execute(input: { actorId: string }) {
    const projections = await this.repo.listDistinctProductTenantIdsFromP7();
    let created = 0;
    let updated = 0;
    const now = new Date();

    for (const row of projections) {
      if (!row.productId || !isUuid(row.productId)) continue;
      const existing = await this.repo.getByProductTenantId(row.productTenantId);
      const code = existing?.tenantCode ?? deriveTenantCode(row.productTenantId);
      const slug = existing?.tenantSlug ?? slugifyTenantCode(code);
      const technicalStatus = mapP7LifecycleToTechnical(row.lifecycleStatus);

      const record = await this.repo.upsertByProductTenantId({
        id: existing?.id,
        version: existing?.version,
        productTenantId: row.productTenantId,
        tenantCode: code,
        tenantSlug: slug,
        displayName: existing?.displayName ?? code,
        legalNameRef: existing?.legalNameRef ?? null,
        productId: row.productId,
        productCode: existing?.productCode ?? null,
        accountId: row.accountId ?? existing?.accountId ?? null,
        subscriptionId: row.subscriptionId ?? existing?.subscriptionId ?? null,
        classification: existing?.classification ?? TenantClassification.STANDARD,
        segment: existing?.segment ?? null,
        deploymentProfile: existing?.deploymentProfile ?? null,
        environmentClassification:
          existing?.environmentClassification ?? EnvironmentClassification.PRODUCTION,
        region: existing?.region ?? null,
        administrativeStatus: existing?.administrativeStatus ?? AdministrativeStatus.PENDING_REVIEW,
        technicalStatus,
        governanceStatus: existing?.governanceStatus ?? GovernanceStatus.COMPLIANT,
        healthStatus: existing?.healthStatus ?? HealthStatus.UNKNOWN,
        riskLevel: existing?.riskLevel ?? RiskLevel.UNKNOWN,
        platformTenantRef: existing?.platformTenantRef ?? null,
        provisioningRequestId: row.provisioningRequestId ?? existing?.provisioningRequestId ?? null,
        activationRecordId: row.activationRecordId ?? existing?.activationRecordId ?? null,
        lifecycleRecordId: row.lifecycleRecordId ?? existing?.lifecycleRecordId ?? null,
        internalOwnerId: existing?.internalOwnerId ?? null,
        operationalTeam: existing?.operationalTeam ?? null,
        supportClassification: existing?.supportClassification ?? null,
        locale: existing?.locale ?? null,
        timezone: existing?.timezone ?? null,
        defaultLanguage: existing?.defaultLanguage ?? null,
        dataResidencyRef: existing?.dataResidencyRef ?? null,
        retentionPolicyRef: existing?.retentionPolicyRef ?? null,
        securityPolicyRef: existing?.securityPolicyRef ?? null,
        legalHold: existing?.legalHold ?? false,
        deletionProtection: existing?.deletionProtection ?? true,
        lastAdminActivityAt: existing?.lastAdminActivityAt ?? null,
        lastSyncedAt: now,
        technicalObservedAt: now,
        healthObservedAt: existing?.healthObservedAt ?? null,
        metadata: existing?.metadata ?? {},
        createdBy: existing?.createdBy ?? input.actorId,
        updatedBy: input.actorId,
      });

      if (existing) updated += 1;
      else created += 1;

      await this.repo.appendActivity({
        tenantRegistryId: record.id,
        productTenantId: record.productTenantId,
        eventType: 'TENANT_SYNCED_FROM_P7',
        action: 'SYNC',
        actorId: input.actorId,
        actorType: 'SYSTEM',
        source: 'p8.tenant_management',
        outcome: 'SUCCESS',
        reason: null,
        correlationId: randomUUID(),
        causationId: null,
        beforeRef: null,
        afterRef: { technicalStatus: record.technicalStatus, lastSyncedAt: now.toISOString() },
        evidenceRef: null,
        details: { lifecycleStatus: row.lifecycleStatus },
      });
    }

    return { synced: projections.length, created, updated };
  }
}

export class UpdateTenantMetadataUseCase {
  constructor(
    private readonly repo: TenantManagementRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    id: string;
    expectedVersion: number;
    displayName?: string;
    classification?: string;
    segment?: string | null;
    region?: string | null;
    locale?: string | null;
    timezone?: string | null;
    defaultLanguage?: string | null;
    supportClassification?: string | null;
    deploymentProfile?: string | null;
    environmentClassification?: string;
    metadata?: Record<string, unknown>;
    correlationId?: string | null;
  }) {
    const current = await this.repo.getById(input.id);
    if (!current) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Tenant registry record not found');
    }
    const correlationId = input.correlationId?.trim() || randomUUID();
    const patch: Partial<TenantRegistryRecord> = {
      updatedBy: input.actorId,
      lastAdminActivityAt: new Date(),
    };
    if (input.displayName !== undefined) patch.displayName = input.displayName.trim();
    if (input.classification !== undefined) patch.classification = input.classification;
    if (input.segment !== undefined) patch.segment = input.segment;
    if (input.region !== undefined) patch.region = input.region;
    if (input.locale !== undefined) patch.locale = input.locale;
    if (input.timezone !== undefined) patch.timezone = input.timezone;
    if (input.defaultLanguage !== undefined) patch.defaultLanguage = input.defaultLanguage;
    if (input.supportClassification !== undefined) {
      patch.supportClassification = input.supportClassification;
    }
    if (input.deploymentProfile !== undefined) patch.deploymentProfile = input.deploymentProfile;
    if (input.environmentClassification !== undefined) {
      patch.environmentClassification = input.environmentClassification;
    }
    if (input.metadata !== undefined) patch.metadata = input.metadata;

    const classificationChanged =
      input.classification !== undefined &&
      String(input.classification) !== String(current.classification);

    return this.outbox.runWithOutbox(EDGE_P8_OUTBOX_TENANT, async (client, enqueue) => {
      const updated = await this.repo.updateTenant(
        input.id,
        patch,
        input.expectedVersion,
        input.actorId,
        client,
      );

      await enqueue(
        buildTenantManagementOutboxEvent({
          eventType: TenantManagementEventTypes.METADATA_UPDATED,
          aggregateId: updated.id,
          correlationId,
          payload: { actorId: input.actorId, version: updated.version },
        }),
      );

      if (classificationChanged) {
        await enqueue(
          buildTenantManagementOutboxEvent({
            eventType: TenantManagementEventTypes.CLASSIFICATION_CHANGED,
            aggregateId: updated.id,
            correlationId,
            payload: {
              from: current.classification,
              to: updated.classification,
              actorId: input.actorId,
            },
          }),
        );
      }

      await requireAudit(
        this.audit,
        {
          eventType: TenantManagementEventTypes.METADATA_UPDATED,
          actorId: input.actorId,
          subjectType: 'TENANT_REGISTRY',
          subjectId: updated.id,
          details: { version: updated.version, classificationChanged },
        },
        client,
      );

      return updated;
    });
  }
}

export class AssignTenantOwnerUseCase {
  constructor(
    private readonly repo: TenantManagementRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    id: string;
    expectedVersion: number;
    internalOwnerId?: string | null;
    operationalTeam?: string | null;
    correlationId?: string | null;
  }) {
    const current = await this.repo.getById(input.id);
    if (!current) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Tenant registry record not found');
    }
    const correlationId = input.correlationId?.trim() || randomUUID();

    return this.outbox.runWithOutbox(EDGE_P8_OUTBOX_TENANT, async (client, enqueue) => {
      const updated = await this.repo.updateTenant(
        input.id,
        {
          internalOwnerId: input.internalOwnerId ?? null,
          operationalTeam: input.operationalTeam ?? null,
          lastAdminActivityAt: new Date(),
        },
        input.expectedVersion,
        input.actorId,
        client,
      );

      await enqueue(
        buildTenantManagementOutboxEvent({
          eventType: TenantManagementEventTypes.OWNER_ASSIGNED,
          aggregateId: updated.id,
          correlationId,
          payload: {
            internalOwnerId: updated.internalOwnerId,
            operationalTeam: updated.operationalTeam,
            actorId: input.actorId,
          },
        }),
      );

      await requireAudit(
        this.audit,
        {
          eventType: TenantManagementEventTypes.OWNER_ASSIGNED,
          actorId: input.actorId,
          subjectType: 'TENANT_REGISTRY',
          subjectId: updated.id,
          details: {
            internalOwnerId: updated.internalOwnerId,
            operationalTeam: updated.operationalTeam,
          },
        },
        client,
      );

      return updated;
    });
  }
}

export class ManageTenantTagsUseCase {
  constructor(private readonly repo: TenantManagementRepositoryPort) {}

  async execute(input: {
    actorId: string;
    tenantRegistryId: string;
    mode: 'add' | 'remove';
    tagKey: string;
    tagValue: string;
  }) {
    const tenant = await this.repo.getById(input.tenantRegistryId);
    if (!tenant) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Tenant registry record not found');
    }
    const tagKey = input.tagKey.trim();
    const tagValue = input.tagValue.trim();
    if (!tagKey || !tagValue) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'tagKey and tagValue are required');
    }

    if (input.mode === 'add') {
      const tag = await this.repo.addTag({
        tenantRegistryId: input.tenantRegistryId,
        tagKey,
        tagValue,
        createdBy: input.actorId,
      });
      await this.repo.appendActivity({
        tenantRegistryId: input.tenantRegistryId,
        productTenantId: tenant.productTenantId,
        eventType: 'TENANT_TAG_ADDED',
        action: 'ADD_TAG',
        actorId: input.actorId,
        actorType: 'ADMIN',
        source: 'p8.tenant_management',
        outcome: 'SUCCESS',
        reason: null,
        correlationId: randomUUID(),
        causationId: null,
        beforeRef: null,
        afterRef: { tagKey, tagValue },
        evidenceRef: null,
        details: {},
      });
      return tag;
    }

    await this.repo.removeTag(input.tenantRegistryId, tagKey, tagValue);
    await this.repo.appendActivity({
      tenantRegistryId: input.tenantRegistryId,
      productTenantId: tenant.productTenantId,
      eventType: 'TENANT_TAG_REMOVED',
      action: 'REMOVE_TAG',
      actorId: input.actorId,
      actorType: 'ADMIN',
      source: 'p8.tenant_management',
      outcome: 'SUCCESS',
      reason: null,
      correlationId: randomUUID(),
      causationId: null,
      beforeRef: { tagKey, tagValue },
      afterRef: null,
      evidenceRef: null,
      details: {},
    });
    return { removed: true, tagKey, tagValue };
  }
}

export class AddTenantNoteUseCase {
  constructor(private readonly repo: TenantManagementRepositoryPort) {}

  async execute(input: {
    actorId: string;
    tenantRegistryId: string;
    noteType: string;
    body: string;
  }) {
    const tenant = await this.repo.getById(input.tenantRegistryId);
    if (!tenant) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Tenant registry record not found');
    }
    const body = input.body.trim();
    if (body.length < 4) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Note body is required');
    }
    const note = await this.repo.addNote({
      tenantRegistryId: input.tenantRegistryId,
      noteType: input.noteType.trim() || 'GENERAL',
      body,
      createdBy: input.actorId,
    });
    await this.repo.appendActivity({
      tenantRegistryId: input.tenantRegistryId,
      productTenantId: tenant.productTenantId,
      eventType: 'TENANT_NOTE_ADDED',
      action: 'ADD_NOTE',
      actorId: input.actorId,
      actorType: 'ADMIN',
      source: 'p8.tenant_management',
      outcome: 'SUCCESS',
      reason: null,
      correlationId: randomUUID(),
      causationId: null,
      beforeRef: null,
      afterRef: { noteId: note.id, noteType: note.noteType },
      evidenceRef: null,
      details: {},
    });
    return note;
  }
}

export class RequestLifecycleActionUseCase {
  constructor(
    private readonly repo: TenantManagementRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    tenantRegistryId: string;
    requestType: LifecycleRequestType | string;
    justification: string;
    idempotencyKey: string;
    riskAssessment?: string | null;
    correlationId?: string | null;
  }) {
    assertJustification(input.justification);
    const tenant = await this.repo.getById(input.tenantRegistryId);
    if (!tenant) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Tenant registry record not found');
    }

    const existingByKey = await this.repo.getLifecycleRequestByIdempotency(input.idempotencyKey);
    if (existingByKey) return existingByKey;

    const eligibility = canRequestLifecycle(String(tenant.administrativeStatus), input.requestType);
    if (!eligibility.ok) {
      throw new DomainError(ErrorCode.CONFLICT, eligibility.reason);
    }

    if (input.requestType === LifecycleRequestType.TERMINATE) {
      assertNotLegalHold(tenant.legalHold, 'TERMINATE');
    }

    const correlationId = input.correlationId?.trim() || randomUUID();

    return this.outbox.runWithOutbox(EDGE_P8_OUTBOX_TENANT, async (client, enqueue) => {
      const request = await this.repo.createLifecycleRequest(
        {
          tenantRegistryId: tenant.id,
          productTenantId: tenant.productTenantId,
          requestType: input.requestType,
          status: GovernanceRequestStatus.WAITING_APPROVAL,
          justification: input.justification.trim(),
          riskAssessment: input.riskAssessment ?? null,
          requestedBy: input.actorId,
          approverId: null,
          approvedAt: null,
          rejectedReason: null,
          p7WorkflowId: null,
          p7LifecycleRecordId: tenant.lifecycleRecordId,
          p5SubscriptionId: tenant.subscriptionId,
          correlationId,
          idempotencyKey: input.idempotencyKey,
          evidence: {},
          result: {},
        },
        client,
      );

      await enqueue(
        buildTenantManagementOutboxEvent({
          eventType: TenantManagementEventTypes.LIFECYCLE_REQUESTED,
          aggregateId: request.id,
          correlationId,
          payload: {
            tenantRegistryId: tenant.id,
            requestType: input.requestType,
            requestedBy: input.actorId,
          },
        }),
      );

      await requireAudit(
        this.audit,
        {
          eventType: TenantManagementEventTypes.LIFECYCLE_REQUESTED,
          actorId: input.actorId,
          subjectType: 'LIFECYCLE_REQUEST',
          subjectId: request.id,
          details: { tenantRegistryId: tenant.id, requestType: input.requestType },
        },
        client,
      );

      return request;
    });
  }
}

export class ApproveLifecycleActionUseCase {
  constructor(
    private readonly repo: TenantManagementRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: { actorId: string; requestId: string; correlationId?: string | null }) {
    const request = await this.repo.getLifecycleRequest(input.requestId);
    if (!request) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Lifecycle request not found');
    }
    if (!isApprovableStatus(String(request.status))) {
      throw new DomainError(ErrorCode.CONFLICT, 'Lifecycle request is not awaiting approval');
    }
    assertSeparationOfDuties(request.requestedBy, input.actorId);

    const tenant = await this.repo.getById(request.tenantRegistryId);
    if (!tenant) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Tenant registry record not found');
    }

    const nextAdmin = nextStatusAfterApproval(request.requestType);
    const correlationId = input.correlationId?.trim() || randomUUID();

    return this.outbox.runWithOutbox(EDGE_P8_OUTBOX_TENANT, async (client, enqueue) => {
      if (nextAdmin) {
        assertAdministrativeTransition(String(tenant.administrativeStatus), nextAdmin);
        await this.repo.updateTenant(
          tenant.id,
          {
            administrativeStatus: nextAdmin,
            lastAdminActivityAt: new Date(),
          },
          tenant.version,
          input.actorId,
          client,
        );
      }

      const updated = await this.repo.updateLifecycleRequest(
        request.id,
        {
          status: GovernanceRequestStatus.APPROVED,
          approverId: input.actorId,
          approvedAt: new Date(),
          result: {
            delegation: 'P7_PENDING',
            administrativeTransition: nextAdmin,
          },
        },
        request.version,
        client,
      );

      await enqueue(
        buildTenantManagementOutboxEvent({
          eventType: TenantManagementEventTypes.LIFECYCLE_APPROVED,
          aggregateId: updated.id,
          correlationId,
          payload: {
            tenantRegistryId: tenant.id,
            requestType: request.requestType,
            approverId: input.actorId,
            delegation: 'P7_PENDING',
          },
        }),
      );

      await requireAudit(
        this.audit,
        {
          eventType: TenantManagementEventTypes.LIFECYCLE_APPROVED,
          actorId: input.actorId,
          subjectType: 'LIFECYCLE_REQUEST',
          subjectId: updated.id,
          details: { delegation: 'P7_PENDING' },
        },
        client,
      );

      return updated;
    });
  }
}

export class RejectLifecycleActionUseCase {
  constructor(
    private readonly repo: TenantManagementRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    requestId: string;
    rejectedReason: string;
    correlationId?: string | null;
  }) {
    const request = await this.repo.getLifecycleRequest(input.requestId);
    if (!request) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Lifecycle request not found');
    }
    if (!isApprovableStatus(String(request.status))) {
      throw new DomainError(ErrorCode.CONFLICT, 'Lifecycle request is not awaiting approval');
    }
    assertSeparationOfDuties(request.requestedBy, input.actorId);
    const reason = input.rejectedReason.trim();
    if (reason.length < 4) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'rejectedReason is required');
    }
    const correlationId = input.correlationId?.trim() || randomUUID();

    return this.outbox.runWithOutbox(EDGE_P8_OUTBOX_TENANT, async (client, enqueue) => {
      const updated = await this.repo.updateLifecycleRequest(
        request.id,
        {
          status: GovernanceRequestStatus.REJECTED,
          approverId: input.actorId,
          rejectedReason: reason,
        },
        request.version,
        client,
      );

      await enqueue(
        buildTenantManagementOutboxEvent({
          eventType: TenantManagementEventTypes.LIFECYCLE_REJECTED,
          aggregateId: updated.id,
          correlationId,
          payload: { rejectedReason: reason, approverId: input.actorId },
        }),
      );

      await requireAudit(
        this.audit,
        {
          eventType: TenantManagementEventTypes.LIFECYCLE_REJECTED,
          actorId: input.actorId,
          subjectType: 'LIFECYCLE_REQUEST',
          subjectId: updated.id,
          details: { rejectedReason: reason },
        },
        client,
      );

      return updated;
    });
  }
}

export class RequestExceptionUseCase {
  constructor(
    private readonly repo: TenantManagementRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    tenantRegistryId: string;
    exceptionType?: ExceptionType | string;
    description: string;
    businessJustification: string;
    startsAt: Date;
    expiresAt: Date;
    idempotencyKey: string;
    riskAssessment?: string | null;
    scope?: Record<string, unknown>;
    correlationId?: string | null;
  }) {
    assertJustification(input.businessJustification);
    if (input.expiresAt.getTime() <= input.startsAt.getTime()) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'expiresAt must be after startsAt');
    }
    const tenant = await this.repo.getById(input.tenantRegistryId);
    if (!tenant) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Tenant registry record not found');
    }
    const existing = await this.repo.getExceptionByIdempotency(input.idempotencyKey);
    if (existing) return existing;

    const correlationId = input.correlationId?.trim() || randomUUID();
    const exceptionType = input.exceptionType ?? ExceptionType.TEMPORARY_RESTRICTION;

    return this.outbox.runWithOutbox(EDGE_P8_OUTBOX_TENANT, async (client, enqueue) => {
      const record = await this.repo.createException(
        {
          tenantRegistryId: tenant.id,
          productTenantId: tenant.productTenantId,
          exceptionType,
          status: ExceptionStatus.REQUESTED,
          description: input.description.trim(),
          businessJustification: input.businessJustification.trim(),
          riskAssessment: input.riskAssessment ?? null,
          scope: { ...(input.scope ?? {}), temporary: true },
          conditions: {},
          evidence: {},
          requesterId: input.actorId,
          approverId: null,
          startsAt: input.startsAt,
          expiresAt: input.expiresAt,
          approvedAt: null,
          revokedAt: null,
          revokeReason: null,
          correlationId,
          idempotencyKey: input.idempotencyKey,
        },
        client,
      );

      await enqueue(
        buildTenantManagementOutboxEvent({
          eventType: TenantManagementEventTypes.EXCEPTION_REQUESTED,
          aggregateId: record.id,
          correlationId,
          payload: { tenantRegistryId: tenant.id, exceptionType },
        }),
      );

      await requireAudit(
        this.audit,
        {
          eventType: TenantManagementEventTypes.EXCEPTION_REQUESTED,
          actorId: input.actorId,
          subjectType: 'TENANT_EXCEPTION',
          subjectId: record.id,
          details: { tenantRegistryId: tenant.id },
        },
        client,
      );

      return record;
    });
  }
}

export class ApproveExceptionUseCase {
  constructor(
    private readonly repo: TenantManagementRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: { actorId: string; exceptionId: string; correlationId?: string | null }) {
    const record = await this.repo.getException(input.exceptionId);
    if (!record) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Exception not found');
    }
    if (String(record.status) !== ExceptionStatus.REQUESTED) {
      throw new DomainError(ErrorCode.CONFLICT, 'Exception is not awaiting approval');
    }
    assertSeparationOfDuties(record.requesterId, input.actorId);
    const correlationId = input.correlationId?.trim() || randomUUID();

    return this.outbox.runWithOutbox(EDGE_P8_OUTBOX_TENANT, async (client, enqueue) => {
      const updated = await this.repo.updateException(
        record.id,
        {
          status: ExceptionStatus.ACTIVE,
          approverId: input.actorId,
          approvedAt: new Date(),
        },
        record.version,
        client,
      );

      await enqueue(
        buildTenantManagementOutboxEvent({
          eventType: TenantManagementEventTypes.EXCEPTION_APPROVED,
          aggregateId: updated.id,
          correlationId,
          payload: { approverId: input.actorId },
        }),
      );

      await requireAudit(
        this.audit,
        {
          eventType: TenantManagementEventTypes.EXCEPTION_APPROVED,
          actorId: input.actorId,
          subjectType: 'TENANT_EXCEPTION',
          subjectId: updated.id,
          details: {},
        },
        client,
      );

      return updated;
    });
  }
}

export class RevokeExceptionUseCase {
  constructor(
    private readonly repo: TenantManagementRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    exceptionId: string;
    revokeReason: string;
    correlationId?: string | null;
  }) {
    const record = await this.repo.getException(input.exceptionId);
    if (!record) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Exception not found');
    }
    const reason = input.revokeReason.trim();
    if (reason.length < 4) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'revokeReason is required');
    }
    const correlationId = input.correlationId?.trim() || randomUUID();

    return this.outbox.runWithOutbox(EDGE_P8_OUTBOX_TENANT, async (client, enqueue) => {
      const updated = await this.repo.updateException(
        record.id,
        {
          status: ExceptionStatus.REVOKED,
          revokedAt: new Date(),
          revokeReason: reason,
        },
        record.version,
        client,
      );

      await enqueue(
        buildTenantManagementOutboxEvent({
          eventType: TenantManagementEventTypes.EXCEPTION_REVOKED,
          aggregateId: updated.id,
          correlationId,
          payload: { revokeReason: reason, actorId: input.actorId },
        }),
      );

      await requireAudit(
        this.audit,
        {
          eventType: TenantManagementEventTypes.EXCEPTION_REVOKED,
          actorId: input.actorId,
          subjectType: 'TENANT_EXCEPTION',
          subjectId: updated.id,
          details: { revokeReason: reason },
        },
        client,
      );

      return updated;
    });
  }
}

export class ExpireExceptionsUseCase {
  constructor(private readonly repo: TenantManagementRepositoryPort) {}

  async execute() {
    const count = await this.repo.expireDueExceptions(new Date());
    return { expired: count };
  }
}

export class RunReconciliationUseCase {
  constructor(
    private readonly repo: TenantManagementRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    mode?: string;
    dryRun?: boolean;
    correlationId?: string | null;
  }) {
    const mode = input.mode?.trim() || (input.dryRun ? 'dry_run' : 'on_demand');
    const correlationId = input.correlationId?.trim() || randomUUID();
    const p7Rows = await this.repo.listDistinctProductTenantIdsFromP7();
    const registryIds = new Set(await this.repo.listRegistryProductTenantIds());
    const p7Ids = new Set(p7Rows.map((r) => r.productTenantId));

    const run = await this.repo.createReconciliationRun({
      mode,
      status: 'RUNNING',
      scope: { source: 'p7_projection' },
      summary: {},
      startedBy: input.actorId,
      startedAt: new Date(),
      finishedAt: null,
      correlationId,
    });

    const findings: Array<{
      findingType: ReconciliationFindingType | string;
      productTenantId: string | null;
      tenantRegistryId: string | null;
      description: string;
    }> = [];

    for (const row of p7Rows) {
      if (!registryIds.has(row.productTenantId)) {
        findings.push({
          findingType: ReconciliationFindingType.MISSING_TENANT,
          productTenantId: row.productTenantId,
          tenantRegistryId: null,
          description: `P7 tenant ${row.productTenantId} missing from P8 registry`,
        });
      }
    }

    for (const id of registryIds) {
      if (!p7Ids.has(id)) {
        const tenant = await this.repo.getByProductTenantId(id);
        findings.push({
          findingType: ReconciliationFindingType.ORPHAN_TENANT,
          productTenantId: id,
          tenantRegistryId: tenant?.id ?? null,
          description: `Registry tenant ${id} not found in P7 projections`,
        });
      }
    }

    const byProductTenant = new Map<string, Set<string>>();
    for (const row of p7Rows) {
      if (!row.productId) continue;
      const set = byProductTenant.get(row.productTenantId) ?? new Set<string>();
      set.add(row.productId);
      byProductTenant.set(row.productTenantId, set);
    }
    for (const [productTenantId, productIds] of byProductTenant) {
      if (productIds.size > 1) {
        findings.push({
          findingType: ReconciliationFindingType.INVALID_PRODUCT_ASSOCIATION,
          productTenantId,
          tenantRegistryId: null,
          description: `Multiple product associations for tenant ${productTenantId}`,
        });
      }
    }

    if (!input.dryRun) {
      for (const f of findings) {
        await this.repo.createFinding({
          runId: run.id,
          tenantRegistryId: f.tenantRegistryId,
          productTenantId: f.productTenantId,
          findingType: f.findingType,
          severity: 'MEDIUM',
          status: 'OPEN',
          description: f.description,
          recommendedAction: null,
          evidence: {},
        });
      }
    }

    const summary = {
      missingTenant: findings.filter((f) => f.findingType === ReconciliationFindingType.MISSING_TENANT)
        .length,
      orphanTenant: findings.filter((f) => f.findingType === ReconciliationFindingType.ORPHAN_TENANT)
        .length,
      invalidProductAssociation: findings.filter(
        (f) => f.findingType === ReconciliationFindingType.INVALID_PRODUCT_ASSOCIATION,
      ).length,
      totalFindings: findings.length,
      dryRun: Boolean(input.dryRun),
    };

    const completed = await this.repo.updateReconciliationRun(run.id, {
      status: 'COMPLETED',
      finishedAt: new Date(),
      summary,
    });

    if (!input.dryRun) {
      await this.outbox.runWithOutbox(EDGE_P8_OUTBOX_TENANT, async (client, enqueue) => {
        await enqueue(
          buildTenantManagementOutboxEvent({
            eventType: TenantManagementEventTypes.RECONCILIATION_COMPLETED,
            aggregateId: completed.id,
            correlationId,
            payload: summary,
          }),
        );
        await requireAudit(
          this.audit,
          {
            eventType: TenantManagementEventTypes.RECONCILIATION_COMPLETED,
            actorId: input.actorId,
            subjectType: 'RECONCILIATION_RUN',
            subjectId: completed.id,
            details: summary,
          },
          client,
        );
      });
    }

    return { run: completed, findings: input.dryRun ? findings : undefined, summary };
  }
}

export class ListFindingsUseCase {
  constructor(private readonly repo: TenantManagementRepositoryPort) {}

  async execute(filter: {
    runId?: string;
    tenantRegistryId?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }) {
    if (!filter.status) {
      return this.repo.listFindings({ ...filter, status: undefined });
    }
    return this.repo.listFindings(filter);
  }
}

export class ListActivityUseCase {
  constructor(private readonly repo: TenantManagementRepositoryPort) {}

  async execute(filter: {
    tenantRegistryId?: string;
    productTenantId?: string;
    limit?: number;
    offset?: number;
  }) {
    return this.repo.listActivity(filter);
  }
}

export class ListLifecycleRequestsUseCase {
  constructor(private readonly repo: TenantManagementRepositoryPort) {}

  async execute(filter: {
    tenantRegistryId?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }) {
    return this.repo.listLifecycleRequests(filter);
  }
}

export class ListExceptionsUseCase {
  constructor(private readonly repo: TenantManagementRepositoryPort) {}

  async execute(filter: {
    tenantRegistryId?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }) {
    return this.repo.listExceptions(filter);
  }
}

export class RequestMigrationUseCase {
  constructor(
    private readonly repo: TenantManagementRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    tenantRegistryId: string;
    migrationType: MigrationType | string;
    justification: string;
    idempotencyKey: string;
    impactAssessment?: string | null;
    compatibilityAssessment?: string | null;
    dataResidencyReview?: string | null;
    downtimeAssessment?: string | null;
    targetRef?: Record<string, unknown>;
    scheduleAt?: Date | null;
    correlationId?: string | null;
  }) {
    assertJustification(input.justification);
    const tenant = await this.repo.getById(input.tenantRegistryId);
    if (!tenant) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Tenant registry record not found');
    }
    const existing = await this.repo.getMigrationByIdempotency(input.idempotencyKey);
    if (existing) return existing;

    const correlationId = input.correlationId?.trim() || randomUUID();

    return this.outbox.runWithOutbox(EDGE_P8_OUTBOX_TENANT, async (client, enqueue) => {
      const record = await this.repo.createMigrationRequest(
        {
          tenantRegistryId: tenant.id,
          productTenantId: tenant.productTenantId,
          migrationType: input.migrationType,
          status: MigrationRequestStatus.REQUESTED,
          justification: input.justification.trim(),
          impactAssessment: input.impactAssessment ?? null,
          compatibilityAssessment: input.compatibilityAssessment ?? null,
          dataResidencyReview: input.dataResidencyReview ?? null,
          downtimeAssessment: input.downtimeAssessment ?? null,
          targetRef: input.targetRef ?? {},
          scheduleAt: input.scheduleAt ?? null,
          requestedBy: input.actorId,
          approverId: null,
          approvedAt: null,
          p7WorkflowId: null,
          evidence: {},
          result: {},
          correlationId,
          idempotencyKey: input.idempotencyKey,
        },
        client,
      );

      await enqueue(
        buildTenantManagementOutboxEvent({
          eventType: TenantManagementEventTypes.MIGRATION_REQUESTED,
          aggregateId: record.id,
          correlationId,
          payload: {
            tenantRegistryId: tenant.id,
            migrationType: input.migrationType,
            requestedBy: input.actorId,
          },
        }),
      );

      await this.repo.appendActivity(
        {
          tenantRegistryId: tenant.id,
          productTenantId: tenant.productTenantId,
          eventType: 'MIGRATION_REQUESTED',
          action: 'REQUEST',
          actorId: input.actorId,
          actorType: 'ADMIN',
          source: 'p8.tenant_management',
          outcome: 'SUCCESS',
          reason: null,
          correlationId,
          causationId: null,
          beforeRef: null,
          afterRef: { requestId: record.id, status: record.status },
          evidenceRef: null,
          details: { migrationType: input.migrationType },
        },
        client,
      );

      await requireAudit(
        this.audit,
        {
          eventType: TenantManagementEventTypes.MIGRATION_REQUESTED,
          actorId: input.actorId,
          subjectType: 'MIGRATION_REQUEST',
          subjectId: record.id,
          details: { tenantRegistryId: tenant.id, migrationType: input.migrationType },
        },
        client,
      );

      return record;
    });
  }
}

export class ApproveMigrationUseCase {
  constructor(
    private readonly repo: TenantManagementRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: { actorId: string; requestId: string; correlationId?: string | null }) {
    const record = await this.repo.getMigrationRequest(input.requestId);
    if (!record) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Migration request not found');
    }
    if (!isDedicatedGovernanceApprovable(String(record.status))) {
      throw new DomainError(ErrorCode.CONFLICT, 'Migration request is not awaiting approval');
    }
    assertSeparationOfDuties(record.requestedBy, input.actorId);

    return this.outbox.runWithOutbox(EDGE_P8_OUTBOX_TENANT, async (client) => {
      const updated = await this.repo.updateMigrationRequest(
        record.id,
        {
          status: MigrationRequestStatus.APPROVED,
          approverId: input.actorId,
          approvedAt: new Date(),
          result: { delegation: 'P7_PENDING' },
        },
        record.version,
        client,
      );

      await requireAudit(
        this.audit,
        {
          eventType: TenantManagementEventTypes.MIGRATION_REQUESTED,
          actorId: input.actorId,
          subjectType: 'MIGRATION_REQUEST',
          subjectId: updated.id,
          details: { action: 'APPROVED', delegation: 'P7_PENDING' },
        },
        client,
      );

      return updated;
    });
  }
}

export class RejectMigrationUseCase {
  constructor(
    private readonly repo: TenantManagementRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    requestId: string;
    rejectedReason: string;
    correlationId?: string | null;
  }) {
    const record = await this.repo.getMigrationRequest(input.requestId);
    if (!record) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Migration request not found');
    }
    if (!isDedicatedGovernanceApprovable(String(record.status))) {
      throw new DomainError(ErrorCode.CONFLICT, 'Migration request is not awaiting approval');
    }
    assertSeparationOfDuties(record.requestedBy, input.actorId);
    const reason = input.rejectedReason.trim();
    if (reason.length < 4) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'rejectedReason is required');
    }
    return this.outbox.runWithOutbox(EDGE_P8_OUTBOX_TENANT, async (client) => {
      const updated = await this.repo.updateMigrationRequest(
        record.id,
        {
          status: MigrationRequestStatus.REJECTED,
          approverId: input.actorId,
          result: { rejectedReason: reason, rejectedBy: input.actorId },
        },
        record.version,
        client,
      );

      await requireAudit(
        this.audit,
        {
          eventType: TenantManagementEventTypes.MIGRATION_REQUESTED,
          actorId: input.actorId,
          subjectType: 'MIGRATION_REQUEST',
          subjectId: updated.id,
          details: { action: 'REJECTED', rejectedReason: reason },
        },
        client,
      );

      return updated;
    });
  }
}

export class ListMigrationRequestsUseCase {
  constructor(private readonly repo: TenantManagementRepositoryPort) {}

  async execute(filter: {
    tenantRegistryId?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }) {
    return this.repo.listMigrationRequests(filter);
  }
}

export class RequestRecoveryUseCase {
  constructor(
    private readonly repo: TenantManagementRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    tenantRegistryId: string;
    recoveryType: RecoveryType | string;
    justification: string;
    idempotencyKey: string;
    priority?: RecoveryPriority | string;
    scope?: Record<string, unknown>;
    backupRef?: string | null;
    restorePointRef?: string | null;
    rpoAssessment?: string | null;
    rtoMeasurement?: string | null;
    correlationId?: string | null;
  }) {
    assertJustification(input.justification);
    const tenant = await this.repo.getById(input.tenantRegistryId);
    if (!tenant) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Tenant registry record not found');
    }
    const existing = await this.repo.getRecoveryByIdempotency(input.idempotencyKey);
    if (existing) return existing;

    const correlationId = input.correlationId?.trim() || randomUUID();
    const priority = input.priority ?? RecoveryPriority.MEDIUM;

    return this.outbox.runWithOutbox(EDGE_P8_OUTBOX_TENANT, async (client, enqueue) => {
      const record = await this.repo.createRecoveryRequest(
        {
          tenantRegistryId: tenant.id,
          productTenantId: tenant.productTenantId,
          recoveryType: input.recoveryType,
          status: RecoveryRequestStatus.REQUESTED,
          priority,
          scope: input.scope ?? {},
          backupRef: input.backupRef ?? null,
          restorePointRef: input.restorePointRef ?? null,
          justification: input.justification.trim(),
          rpoAssessment: input.rpoAssessment ?? null,
          rtoMeasurement: input.rtoMeasurement ?? null,
          requestedBy: input.actorId,
          approverId: null,
          approvedAt: null,
          p7WorkflowId: null,
          evidence: {},
          result: {},
          correlationId,
          idempotencyKey: input.idempotencyKey,
        },
        client,
      );

      await enqueue(
        buildTenantManagementOutboxEvent({
          eventType: TenantManagementEventTypes.RECOVERY_REQUESTED,
          aggregateId: record.id,
          correlationId,
          payload: {
            tenantRegistryId: tenant.id,
            recoveryType: input.recoveryType,
            priority,
            requestedBy: input.actorId,
          },
        }),
      );

      await this.repo.appendActivity(
        {
          tenantRegistryId: tenant.id,
          productTenantId: tenant.productTenantId,
          eventType: 'RECOVERY_REQUESTED',
          action: 'REQUEST',
          actorId: input.actorId,
          actorType: 'ADMIN',
          source: 'p8.tenant_management',
          outcome: 'SUCCESS',
          reason: null,
          correlationId,
          causationId: null,
          beforeRef: null,
          afterRef: { requestId: record.id, status: record.status, priority },
          evidenceRef: null,
          details: { recoveryType: input.recoveryType },
        },
        client,
      );

      await requireAudit(
        this.audit,
        {
          eventType: TenantManagementEventTypes.RECOVERY_REQUESTED,
          actorId: input.actorId,
          subjectType: 'RECOVERY_REQUEST',
          subjectId: record.id,
          details: { tenantRegistryId: tenant.id, recoveryType: input.recoveryType, priority },
        },
        client,
      );

      return record;
    });
  }
}

export class ApproveRecoveryUseCase {
  constructor(
    private readonly repo: TenantManagementRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: { actorId: string; requestId: string; correlationId?: string | null }) {
    const record = await this.repo.getRecoveryRequest(input.requestId);
    if (!record) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Recovery request not found');
    }
    if (!isDedicatedGovernanceApprovable(String(record.status))) {
      throw new DomainError(ErrorCode.CONFLICT, 'Recovery request is not awaiting approval');
    }
    assertSeparationOfDuties(record.requestedBy, input.actorId);

    return this.outbox.runWithOutbox(EDGE_P8_OUTBOX_TENANT, async (client) => {
      const updated = await this.repo.updateRecoveryRequest(
        record.id,
        {
          status: RecoveryRequestStatus.AUTHORIZED,
          approverId: input.actorId,
          approvedAt: new Date(),
          result: { delegation: 'P7_PENDING' },
        },
        record.version,
        client,
      );

      await requireAudit(
        this.audit,
        {
          eventType: TenantManagementEventTypes.RECOVERY_REQUESTED,
          actorId: input.actorId,
          subjectType: 'RECOVERY_REQUEST',
          subjectId: updated.id,
          details: { action: 'AUTHORIZED', delegation: 'P7_PENDING' },
        },
        client,
      );

      return updated;
    });
  }
}

export class RejectRecoveryUseCase {
  constructor(
    private readonly repo: TenantManagementRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    requestId: string;
    rejectedReason: string;
    correlationId?: string | null;
  }) {
    const record = await this.repo.getRecoveryRequest(input.requestId);
    if (!record) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Recovery request not found');
    }
    if (!isDedicatedGovernanceApprovable(String(record.status))) {
      throw new DomainError(ErrorCode.CONFLICT, 'Recovery request is not awaiting approval');
    }
    assertSeparationOfDuties(record.requestedBy, input.actorId);
    const reason = input.rejectedReason.trim();
    if (reason.length < 4) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'rejectedReason is required');
    }

    return this.outbox.runWithOutbox(EDGE_P8_OUTBOX_TENANT, async (client) => {
      const updated = await this.repo.updateRecoveryRequest(
        record.id,
        {
          status: RecoveryRequestStatus.REJECTED,
          approverId: input.actorId,
          result: { rejectedReason: reason, rejectedBy: input.actorId },
        },
        record.version,
        client,
      );

      await requireAudit(
        this.audit,
        {
          eventType: TenantManagementEventTypes.RECOVERY_REQUESTED,
          actorId: input.actorId,
          subjectType: 'RECOVERY_REQUEST',
          subjectId: updated.id,
          details: { action: 'REJECTED', rejectedReason: reason },
        },
        client,
      );

      return updated;
    });
  }
}

export class ListRecoveryRequestsUseCase {
  constructor(private readonly repo: TenantManagementRepositoryPort) {}

  async execute(filter: {
    tenantRegistryId?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }) {
    return this.repo.listRecoveryRequests(filter);
  }
}

export class RequestTerminationUseCase {
  constructor(
    private readonly repo: TenantManagementRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    tenantRegistryId: string;
    justification: string;
    idempotencyKey: string;
    dataExportRef?: string | null;
    graceUntil?: Date | null;
    correlationId?: string | null;
  }) {
    assertJustification(input.justification);
    const tenant = await this.repo.getById(input.tenantRegistryId);
    if (!tenant) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Tenant registry record not found');
    }
    const existing = await this.repo.getTerminationByIdempotency(input.idempotencyKey);
    if (existing) return existing;

    const blockedByLegalHold = tenant.legalHold;
    const initialStatus = blockedByLegalHold
      ? TerminationRequestStatus.BLOCKED_LEGAL_HOLD
      : TerminationRequestStatus.REQUESTED;

    const correlationId = input.correlationId?.trim() || randomUUID();
    const contractualCheck = unavailableGovernanceCheck('P5_COMMERCIAL');
    const financialCheck = unavailableGovernanceCheck('P6_BILLING');
    const retentionEvaluation = unavailableGovernanceCheck('P8_RETENTION_POLICY');

    return this.outbox.runWithOutbox(EDGE_P8_OUTBOX_TENANT, async (client, enqueue) => {
      const record = await this.repo.createTerminationRequest(
        {
          tenantRegistryId: tenant.id,
          productTenantId: tenant.productTenantId,
          status: initialStatus,
          justification: input.justification.trim(),
          contractualCheck,
          financialCheck,
          retentionEvaluation,
          legalHold: tenant.legalHold,
          dataExportRef: input.dataExportRef ?? null,
          graceUntil: input.graceUntil ?? null,
          requestedBy: input.actorId,
          approverId: null,
          approvedAt: null,
          p7WorkflowId: null,
          evidence: blockedByLegalHold ? { legalHoldBlocked: true } : {},
          result: {},
          correlationId,
          idempotencyKey: input.idempotencyKey,
        },
        client,
      );

      await enqueue(
        buildTenantManagementOutboxEvent({
          eventType: TenantManagementEventTypes.TERMINATION_REQUESTED,
          aggregateId: record.id,
          correlationId,
          payload: {
            tenantRegistryId: tenant.id,
            status: initialStatus,
            legalHold: tenant.legalHold,
            requestedBy: input.actorId,
          },
        }),
      );

      await this.repo.appendActivity(
        {
          tenantRegistryId: tenant.id,
          productTenantId: tenant.productTenantId,
          eventType: 'TERMINATION_REQUESTED',
          action: 'REQUEST',
          actorId: input.actorId,
          actorType: 'ADMIN',
          source: 'p8.tenant_management',
          outcome: blockedByLegalHold ? 'BLOCKED' : 'SUCCESS',
          reason: blockedByLegalHold ? 'LEGAL_HOLD_ACTIVE' : null,
          correlationId,
          causationId: null,
          beforeRef: null,
          afterRef: { requestId: record.id, status: record.status },
          evidenceRef: null,
          details: { legalHold: tenant.legalHold },
        },
        client,
      );

      await requireAudit(
        this.audit,
        {
          eventType: TenantManagementEventTypes.TERMINATION_REQUESTED,
          actorId: input.actorId,
          subjectType: 'TERMINATION_REQUEST',
          subjectId: record.id,
          details: {
            tenantRegistryId: tenant.id,
            status: initialStatus,
            legalHold: tenant.legalHold,
          },
        },
        client,
      );

      return record;
    });
  }
}

export class ApproveTerminationUseCase {
  constructor(
    private readonly repo: TenantManagementRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: { actorId: string; requestId: string; correlationId?: string | null }) {
    const record = await this.repo.getTerminationRequest(input.requestId);
    if (!record) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Termination request not found');
    }
    if (!isDedicatedGovernanceApprovable(String(record.status))) {
      throw new DomainError(ErrorCode.CONFLICT, 'Termination request is not awaiting approval');
    }
    assertSeparationOfDuties(record.requestedBy, input.actorId);

    const tenant = await this.repo.getById(record.tenantRegistryId);
    if (!tenant) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Tenant registry record not found');
    }
    assertNotLegalHold(tenant.legalHold, 'TERMINATION_APPROVE');

    return this.outbox.runWithOutbox(EDGE_P8_OUTBOX_TENANT, async (client) => {
      const updated = await this.repo.updateTerminationRequest(
        record.id,
        {
          status: TerminationRequestStatus.APPROVED,
          approverId: input.actorId,
          approvedAt: new Date(),
          result: { delegation: 'P7_PENDING' },
        },
        record.version,
        client,
      );

      await requireAudit(
        this.audit,
        {
          eventType: TenantManagementEventTypes.TERMINATION_REQUESTED,
          actorId: input.actorId,
          subjectType: 'TERMINATION_REQUEST',
          subjectId: updated.id,
          details: { action: 'APPROVED', delegation: 'P7_PENDING' },
        },
        client,
      );

      return updated;
    });
  }
}

export class RejectTerminationUseCase {
  constructor(
    private readonly repo: TenantManagementRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    requestId: string;
    rejectedReason: string;
    correlationId?: string | null;
  }) {
    const record = await this.repo.getTerminationRequest(input.requestId);
    if (!record) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Termination request not found');
    }
    if (!isDedicatedGovernanceApprovable(String(record.status))) {
      throw new DomainError(ErrorCode.CONFLICT, 'Termination request is not awaiting approval');
    }
    assertSeparationOfDuties(record.requestedBy, input.actorId);
    const reason = input.rejectedReason.trim();
    if (reason.length < 4) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'rejectedReason is required');
    }

    return this.outbox.runWithOutbox(EDGE_P8_OUTBOX_TENANT, async (client) => {
      const updated = await this.repo.updateTerminationRequest(
        record.id,
        {
          status: TerminationRequestStatus.REJECTED,
          approverId: input.actorId,
          result: { rejectedReason: reason, rejectedBy: input.actorId },
        },
        record.version,
        client,
      );

      await requireAudit(
        this.audit,
        {
          eventType: TenantManagementEventTypes.TERMINATION_REQUESTED,
          actorId: input.actorId,
          subjectType: 'TERMINATION_REQUEST',
          subjectId: updated.id,
          details: { action: 'REJECTED', rejectedReason: reason },
        },
        client,
      );

      return updated;
    });
  }
}

export class ListTerminationRequestsUseCase {
  constructor(private readonly repo: TenantManagementRepositoryPort) {}

  async execute(filter: {
    tenantRegistryId?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }) {
    return this.repo.listTerminationRequests(filter);
  }
}

export class GetPortfolioAnalyticsUseCase {
  constructor(private readonly repo: TenantManagementRepositoryPort) {}

  async execute() {
    return this.repo.portfolioMetrics();
  }
}

/** Re-export port token for DI convenience in tests. */
export { TENANT_MANAGEMENT_REPOSITORY_PORT };