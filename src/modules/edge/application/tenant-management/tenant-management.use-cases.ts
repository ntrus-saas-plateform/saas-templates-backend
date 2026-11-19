import { randomUUID } from 'node:crypto';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import type { ControlPlaneOutboxTransactionService } from '../../../../shared/messaging/control-plane-outbox-transaction.service.js';
import type { AuditEventRepositoryPort } from '../../domain/ports/audit-event-repository.port.js';
import { LifecycleStatus } from '../../domain/tenant-lifecycle/lifecycle.types.js';
import {
  assertAdministrativeTransition,
  assertJustification,
  assertHealthSnapshotSource,
  assertLegalHoldMutationRequiresWorkflow,
  assertLifecycleApprovalAllowedUnderLegalHold,
  assertLifecycleRequestAllowedUnderLegalHold,
  assertNotLegalHold,
  assertP7BridgeOutcomeAllowsApproval,
  assertSeparationOfDuties,
  assertTenantInOperatorScope,
  buildOperatorTenantAccess,
  p8TenantDeprovisionAllowed,
  P7_DELEGATED_LIFECYCLE_TYPES,
  type OperatorTenantAccess,
  canRequestLifecycle,
  isApprovableStatus,
  BULK_SENSITIVE_TYPES,
  coerceHealthOverallStatus,
  evaluateTenantRiskLevel,
  governanceStatusAfterExceptionApproval,
  governanceStatusAfterExceptionRevoke,
  HEALTH_FRESHNESS_MS,
  isDedicatedGovernanceApprovable,
  isImmediateAdminLifecycleApproval,
  nextStatusAfterApproval,
  normalizeReconciliationMode,
  p7ApprovalAdministrativeIntent,
  slugifyTenantCode,
  unavailableGovernanceCheck,
} from '../../domain/tenant-management/tenant-management-policy.js';
import {
  TENANT_MANAGEMENT_REPOSITORY_PORT,
  type TenantManagementRepositoryPort,
} from '../../domain/tenant-management/tenant-management-repository.port.js';
import type { TenantTechnicalLifecycleBridgePort } from '../../domain/tenant-management/tenant-technical-lifecycle-bridge.port.js';
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
  LegalHoldChangeAction,
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

function applyOperatorAccessToFilter(
  filter: TenantSearchFilter,
  access?: OperatorTenantAccess,
): TenantSearchFilter {
  if (!access || access.global) return filter;
  return {
    ...filter,
    operatorRegions: access.regions,
    operatorAccountIds: access.accountIds,
    operatorProductIds: access.productIds,
    operatorOwnerIds: access.ownerIds,
  };
}

export class ResolveOperatorTenantAccessUseCase {
  constructor(private readonly repo: TenantManagementRepositoryPort) {}

  async execute(input: {
    administratorId: string | null | undefined;
    permissions: readonly string[];
  }): Promise<OperatorTenantAccess> {
    const scopes = input.administratorId
      ? await this.repo.listOperatorScopes(input.administratorId)
      : [];
    return buildOperatorTenantAccess(input.permissions, scopes);
  }
}

export class ListTenantsUseCase {
  constructor(private readonly repo: TenantManagementRepositoryPort) {}

  async execute(filter: TenantSearchFilter, access?: OperatorTenantAccess) {
    return this.repo.search(applyOperatorAccessToFilter(filter, access));
  }
}

export class GetTenantUseCase {
  constructor(private readonly repo: TenantManagementRepositoryPort) {}

  async execute(id: string, access?: OperatorTenantAccess) {
    const tenant = await this.repo.getById(id);
    if (!tenant) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Tenant registry record not found');
    }
    if (access) {
      assertTenantInOperatorScope(tenant, access);
    }
    return tenant;
  }
}

export class GetTenant360UseCase {
  constructor(private readonly repo: TenantManagementRepositoryPort) {}

  async execute(id: string, access?: OperatorTenantAccess): Promise<Tenant360Overview> {
    const registry = await this.repo.getById(id);
    if (!registry) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Tenant registry record not found');
    }
    if (access) {
      assertTenantInOperatorScope(registry, access);
    }
    const [
      tags,
      notes,
      openExceptions,
      lifecycleRequests,
      findings,
      timeline,
      latestHealthSnapshot,
      latestRiskAssessment,
      resources,
      applications,
      configuration,
      commercialDetail,
    ] = await Promise.all([
      this.repo.listTags(id),
      this.repo.listNotes(id, 50),
      this.repo.countOpenExceptions(id),
      this.repo.listLifecycleRequests({
        tenantRegistryId: id,
        status: GovernanceRequestStatus.WAITING_APPROVAL,
        limit: 1,
      }),
      this.repo.listFindings({ tenantRegistryId: id, status: 'OPEN', limit: 1 }),
      this.repo.listActivity({ tenantRegistryId: id, limit: 30 }),
      this.repo.getLatestHealthSnapshot(id),
      this.repo.getLatestRiskAssessment(id),
      this.repo.getTechnicalResources(registry.productTenantId),
      this.repo.getApplicationRefs(registry.productTenantId),
      this.repo.getConfigurationRefs(registry.productTenantId),
      this.repo.getCommercialProjection(registry.subscriptionId),
    ]);

    const technicalFreshness = computeFreshness(registry.technicalObservedAt);
    const technicalStatus = String(registry.technicalStatus);

    const healthFreshness = computeFreshness(registry.healthObservedAt);
    const healthStatus =
      healthFreshness === 'STALE' ? HealthStatus.STALE : String(registry.healthStatus);

    const commercialAvailability =
      commercialDetail.availability === 'AVAILABLE'
        ? ('AVAILABLE' as const)
        : registry.accountId || registry.subscriptionId
          ? ('PARTIAL' as const)
          : commercialDetail.availability;

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
      commercialDetail,
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
      latestHealthSnapshot,
      latestRiskAssessment,
      resources,
      applications,
      configuration,
      timeline: timeline.items,
      openExceptions,
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

    let subscriptionCommercialVerified = false;
    const subscriptionRef = input.subscriptionId?.trim() ?? '';
    if (subscriptionRef) {
      const verification = await this.repo.verifySubscriptionProduct(
        subscriptionRef,
        input.productId,
      );
      if (verification === 'NOT_FOUND') {
        throw new DomainError(
          ErrorCode.VALIDATION_ERROR,
          'subscriptionId not found in edge_subscriptions',
          [{ code: 'SUBSCRIPTION_NOT_FOUND', subscriptionId: subscriptionRef }],
        );
      }
      if (verification === 'PRODUCT_MISMATCH') {
        throw new DomainError(
          ErrorCode.VALIDATION_ERROR,
          'subscription product_id does not match tenant productId',
          [{ code: 'SUBSCRIPTION_PRODUCT_MISMATCH', subscriptionId: subscriptionRef }],
        );
      }
      if (verification === 'INACTIVE') {
        throw new DomainError(
          ErrorCode.VALIDATION_ERROR,
          'subscription is not in an active commercial status',
          [{ code: 'SUBSCRIPTION_INACTIVE', subscriptionId: subscriptionRef }],
        );
      }
      if (verification === 'VERIFIED') {
        subscriptionCommercialVerified = true;
      }
    }

    return this.outbox.runWithOutbox(EDGE_P8_OUTBOX_TENANT, async (client, enqueue) => {
      const existing = await this.repo.getByProductTenantId(input.productTenantId);
      const now = new Date();
      const commercialRefsProvided =
        (input.accountId !== undefined &&
          input.accountId !== null &&
          input.accountId.trim() !== '') ||
        (input.subscriptionId !== undefined &&
          input.subscriptionId !== null &&
          input.subscriptionId.trim() !== '');

      const commercialUnverifiedOnly =
        commercialRefsProvided && !subscriptionCommercialVerified;

      let record: TenantRegistryRecord;
      let unverifiedCommercial = false;

      if (existing) {
        const upsertPayload: Omit<
          TenantRegistryRecord,
          'id' | 'createdAt' | 'updatedAt' | 'version'
        > & { id: string; version: number } = {
          id: existing.id,
          version: existing.version,
          productTenantId: input.productTenantId,
          tenantCode: code,
          tenantSlug: slug,
          displayName: input.displayName.trim(),
          legalNameRef: existing.legalNameRef,
          productId: input.productId,
          productCode: input.productCode ?? existing.productCode,
          accountId:
            input.accountId !== undefined && input.accountId !== null
              ? input.accountId
              : existing.accountId,
          subscriptionId:
            input.subscriptionId !== undefined && input.subscriptionId !== null
              ? input.subscriptionId
              : existing.subscriptionId,
          classification: input.classification ?? existing.classification,
          segment: existing.segment,
          deploymentProfile: existing.deploymentProfile,
          environmentClassification: existing.environmentClassification,
          region: input.region ?? existing.region,
          administrativeStatus: existing.administrativeStatus,
          technicalStatus: existing.technicalStatus,
          governanceStatus: commercialUnverifiedOnly
            ? GovernanceStatus.REVIEW_REQUIRED
            : subscriptionCommercialVerified
              ? GovernanceStatus.COMPLIANT
              : existing.governanceStatus,
          healthStatus: existing.healthStatus,
          riskLevel: existing.riskLevel,
          platformTenantRef: existing.platformTenantRef,
          provisioningRequestId: existing.provisioningRequestId,
          activationRecordId: existing.activationRecordId,
          lifecycleRecordId: existing.lifecycleRecordId,
          internalOwnerId: existing.internalOwnerId,
          operationalTeam: existing.operationalTeam,
          supportClassification: existing.supportClassification,
          locale: existing.locale,
          timezone: existing.timezone,
          defaultLanguage: existing.defaultLanguage,
          dataResidencyRef: existing.dataResidencyRef,
          retentionPolicyRef: existing.retentionPolicyRef,
          securityPolicyRef: existing.securityPolicyRef,
          legalHold: existing.legalHold,
          deletionProtection: existing.deletionProtection,
          lastAdminActivityAt: now,
          lastSyncedAt: existing.lastSyncedAt,
          technicalObservedAt: existing.technicalObservedAt,
          healthObservedAt: existing.healthObservedAt,
          metadata: { ...existing.metadata, ...(input.metadata ?? {}) },
          createdBy: existing.createdBy,
          updatedBy: input.actorId,
        };
        unverifiedCommercial = commercialUnverifiedOnly;
        record = await this.repo.upsertByProductTenantId(upsertPayload, client);
      } else {
        const base: Omit<TenantRegistryRecord, 'id' | 'createdAt' | 'updatedAt' | 'version'> = {
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
          governanceStatus: commercialUnverifiedOnly
            ? GovernanceStatus.REVIEW_REQUIRED
            : subscriptionCommercialVerified
              ? GovernanceStatus.COMPLIANT
              : GovernanceStatus.REVIEW_REQUIRED,
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
        unverifiedCommercial = commercialUnverifiedOnly;
        record = await this.repo.registerTenant(base, client);
      }

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
          details: {
            tenantCode: record.tenantCode,
            ...(unverifiedCommercial ? { note: 'UNVERIFIED_COMMERCIAL_REFS' } : {}),
          },
        },
        client,
      );

      if (unverifiedCommercial) {
        await this.repo.appendActivity(
          {
            tenantRegistryId: record.id,
            productTenantId: record.productTenantId,
            eventType: 'COMMERCIAL_REFS_UNVERIFIED',
            action: 'REGISTER',
            actorId: input.actorId,
            actorType: 'ADMIN',
            source: 'p8.tenant_management',
            outcome: 'SUCCESS',
            reason: 'UNVERIFIED_COMMERCIAL_REFS',
            correlationId,
            causationId: null,
            beforeRef: null,
            afterRef: {
              accountId: record.accountId,
              subscriptionId: record.subscriptionId,
            },
            evidenceRef: null,
            details: {
              message:
                'Commercial references stored without P5 verification; governance review required',
            },
          },
          client,
        );
      }

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
        governanceStatus: existing?.governanceStatus ?? GovernanceStatus.REVIEW_REQUIRED,
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

    assertLifecycleRequestAllowedUnderLegalHold(tenant.legalHold, input.requestType);

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
    private readonly p7Bridge: TenantTechnicalLifecycleBridgePort | null = null,
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

    assertLifecycleApprovalAllowedUnderLegalHold(tenant.legalHold, request.requestType);

    const immediateAdmin = isImmediateAdminLifecycleApproval(request.requestType);
    const intentAdmin = immediateAdmin
      ? null
      : p7ApprovalAdministrativeIntent(request.requestType, String(tenant.administrativeStatus));
    const nextAdmin = immediateAdmin ? nextStatusAfterApproval(request.requestType) : null;
    let delegation = immediateAdmin ? 'P8_ADMIN' : 'P7_PENDING';
    const correlationId = input.correlationId?.trim() || randomUUID();
    const bridgeInputBase = {
      lifecycleRecordId: tenant.lifecycleRecordId ?? '',
      actorId: input.actorId,
      correlationId,
      idempotencyKey: `p8-lifecycle-bridge-${request.id}`,
      reason: request.justification,
    };
    let p7WorkflowId: string | null = null;
    const p7BridgeResult: Record<string, unknown> = {};
    const requestType = String(request.requestType);

    if (
      !immediateAdmin &&
      P7_DELEGATED_LIFECYCLE_TYPES.has(requestType) &&
      this.p7Bridge
    ) {
      if (!tenant.lifecycleRecordId) {
        p7BridgeResult.outcome = 'SKIPPED_NO_RECORD';
        p7BridgeResult.reason = 'NO_P7_LIFECYCLE_RECORD_ID';
      } else if (requestType === LifecycleRequestType.SUSPEND) {
        const bridgeOut = await this.p7Bridge.requestSuspend(bridgeInputBase);
        Object.assign(p7BridgeResult, bridgeOut);
        assertP7BridgeOutcomeAllowsApproval(bridgeOut.outcome);
        if (bridgeOut.outcome === 'STARTED' && bridgeOut.workflowId) {
          delegation = 'P7_STARTED';
          p7WorkflowId = bridgeOut.workflowId;
        }
      } else if (requestType === LifecycleRequestType.RESUME) {
        const bridgeOut = await this.p7Bridge.requestResume(bridgeInputBase);
        Object.assign(p7BridgeResult, bridgeOut);
        assertP7BridgeOutcomeAllowsApproval(bridgeOut.outcome);
        if (bridgeOut.outcome === 'STARTED' && bridgeOut.workflowId) {
          delegation = 'P7_STARTED';
          p7WorkflowId = bridgeOut.workflowId;
        }
      } else if (
        requestType === LifecycleRequestType.DEACTIVATE ||
        requestType === LifecycleRequestType.TERMINATE
      ) {
        if (p8TenantDeprovisionAllowed(tenant)) {
          const bridgeOut = await this.p7Bridge.requestDeprovision({
            ...bridgeInputBase,
            authorized: true,
            confirmed: true,
          });
          Object.assign(p7BridgeResult, bridgeOut);
          assertP7BridgeOutcomeAllowsApproval(bridgeOut.outcome);
          if (bridgeOut.outcome === 'STARTED' && bridgeOut.workflowId) {
            delegation = 'P7_STARTED';
            p7WorkflowId = bridgeOut.workflowId;
          }
        } else {
          p7BridgeResult.outcome = 'SKIPPED_NO_RECORD';
          p7BridgeResult.reason = 'DEPROVISION_FLAG_GATED';
          delegation = 'P7_PENDING';
        }
      }
    } else if (
      !immediateAdmin &&
      P7_DELEGATED_LIFECYCLE_TYPES.has(requestType) &&
      !tenant.lifecycleRecordId
    ) {
      p7BridgeResult.outcome = 'SKIPPED_NO_RECORD';
      p7BridgeResult.reason = 'NO_P7_LIFECYCLE_RECORD_ID';
    }

    return this.outbox.runWithOutbox(EDGE_P8_OUTBOX_TENANT, async (client, enqueue) => {
      let tenantVersion = tenant.version;
      if (immediateAdmin && nextAdmin) {
        assertAdministrativeTransition(String(tenant.administrativeStatus), nextAdmin);
        const updatedTenant = await this.repo.updateTenant(
          tenant.id,
          {
            administrativeStatus: nextAdmin,
            lastAdminActivityAt: new Date(),
          },
          tenantVersion,
          input.actorId,
          client,
        );
        tenantVersion = updatedTenant.version;
      } else if (intentAdmin) {
        assertAdministrativeTransition(String(tenant.administrativeStatus), intentAdmin);
        const updatedTenant = await this.repo.updateTenant(
          tenant.id,
          {
            administrativeStatus: intentAdmin,
            lastAdminActivityAt: new Date(),
          },
          tenantVersion,
          input.actorId,
          client,
        );
        tenantVersion = updatedTenant.version;
      }

      const updated = await this.repo.updateLifecycleRequest(
        request.id,
        {
          status: GovernanceRequestStatus.APPROVED,
          approverId: input.actorId,
          approvedAt: new Date(),
          p7WorkflowId: p7WorkflowId ?? undefined,
          result: {
            delegation,
            administrativeTransition: nextAdmin ?? intentAdmin,
            p7Bridge: p7BridgeResult,
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
            delegation,
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
          details: { delegation },
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

    const tenant = await this.repo.getById(record.tenantRegistryId);
    if (!tenant) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Tenant registry record not found');
    }

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

      await this.repo.updateTenant(
        tenant.id,
        { governanceStatus: governanceStatusAfterExceptionApproval() },
        tenant.version,
        input.actorId,
        client,
      );

      await enqueue(
        buildTenantManagementOutboxEvent({
          eventType: TenantManagementEventTypes.EXCEPTION_APPROVED,
          aggregateId: updated.id,
          correlationId,
          payload: { approverId: input.actorId, governanceStatus: GovernanceStatus.EXCEPTION_PENDING },
        }),
      );

      await enqueue(
        buildTenantManagementOutboxEvent({
          eventType: TenantManagementEventTypes.GOVERNANCE_STATUS_CHANGED,
          aggregateId: tenant.id,
          correlationId,
          payload: { governanceStatus: GovernanceStatus.EXCEPTION_PENDING, reason: 'EXCEPTION_ACTIVE' },
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

    const tenant = await this.repo.getById(record.tenantRegistryId);
    if (!tenant) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Tenant registry record not found');
    }

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

      const activeCount = await this.repo.countActiveExceptions(tenant.id);
      const nextGovernance = governanceStatusAfterExceptionRevoke(
        activeCount,
        String(tenant.administrativeStatus) === AdministrativeStatus.PENDING_REVIEW,
      );
      await this.repo.updateTenant(
        tenant.id,
        { governanceStatus: nextGovernance },
        tenant.version,
        input.actorId,
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

      await enqueue(
        buildTenantManagementOutboxEvent({
          eventType: TenantManagementEventTypes.GOVERNANCE_STATUS_CHANGED,
          aggregateId: tenant.id,
          correlationId,
          payload: { governanceStatus: nextGovernance, reason: 'EXCEPTION_REVOKED' },
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
    const mode = normalizeReconciliationMode(input.mode, input.dryRun);
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

    const duplicateCodes = await this.repo.detectDuplicateRegistryRows();
    for (const dup of duplicateCodes) {
      findings.push({
        findingType: ReconciliationFindingType.DUPLICATE_REFERENCE,
        productTenantId: dup.productTenantIds[0] ?? null,
        tenantRegistryId: null,
        description: `Duplicate tenant_code "${dup.tenantCode}" across ${dup.count} registry rows`,
      });
    }

    const duplicateAccountProduct = await this.repo.detectDuplicateAccountProductRefs();
    for (const dup of duplicateAccountProduct) {
      findings.push({
        findingType: ReconciliationFindingType.DUPLICATE_REFERENCE,
        productTenantId: dup.productTenantIds[0] ?? null,
        tenantRegistryId: null,
        description: `Account ${dup.accountId} + product ${dup.productId} maps to multiple product tenants: ${dup.productTenantIds.join(', ')}`,
      });
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
    const correlationId = input.correlationId?.trim() || randomUUID();

    return this.outbox.runWithOutbox(EDGE_P8_OUTBOX_TENANT, async (client, enqueue) => {
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

      await enqueue(
        buildTenantManagementOutboxEvent({
          eventType: TenantManagementEventTypes.MIGRATION_APPROVED,
          aggregateId: updated.id,
          correlationId,
          payload: { approverId: input.actorId, delegation: 'P7_PENDING' },
        }),
      );

      await requireAudit(
        this.audit,
        {
          eventType: TenantManagementEventTypes.MIGRATION_APPROVED,
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
    const correlationId = input.correlationId?.trim() || randomUUID();

    return this.outbox.runWithOutbox(EDGE_P8_OUTBOX_TENANT, async (client, enqueue) => {
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

      await enqueue(
        buildTenantManagementOutboxEvent({
          eventType: TenantManagementEventTypes.MIGRATION_REJECTED,
          aggregateId: updated.id,
          correlationId,
          payload: { rejectedReason: reason, actorId: input.actorId },
        }),
      );

      await requireAudit(
        this.audit,
        {
          eventType: TenantManagementEventTypes.MIGRATION_REJECTED,
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
    const correlationId = input.correlationId?.trim() || randomUUID();

    return this.outbox.runWithOutbox(EDGE_P8_OUTBOX_TENANT, async (client, enqueue) => {
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

      await enqueue(
        buildTenantManagementOutboxEvent({
          eventType: TenantManagementEventTypes.RECOVERY_APPROVED,
          aggregateId: updated.id,
          correlationId,
          payload: { approverId: input.actorId, delegation: 'P7_PENDING' },
        }),
      );

      await requireAudit(
        this.audit,
        {
          eventType: TenantManagementEventTypes.RECOVERY_APPROVED,
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

    const correlationId = input.correlationId?.trim() || randomUUID();

    return this.outbox.runWithOutbox(EDGE_P8_OUTBOX_TENANT, async (client, enqueue) => {
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

      await enqueue(
        buildTenantManagementOutboxEvent({
          eventType: TenantManagementEventTypes.RECOVERY_REJECTED,
          aggregateId: updated.id,
          correlationId,
          payload: { rejectedReason: reason, actorId: input.actorId },
        }),
      );

      await requireAudit(
        this.audit,
        {
          eventType: TenantManagementEventTypes.RECOVERY_REJECTED,
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
    const correlationId = input.correlationId?.trim() || randomUUID();

    return this.outbox.runWithOutbox(EDGE_P8_OUTBOX_TENANT, async (client, enqueue) => {
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

      await enqueue(
        buildTenantManagementOutboxEvent({
          eventType: TenantManagementEventTypes.TERMINATION_APPROVED,
          aggregateId: updated.id,
          correlationId,
          payload: { approverId: input.actorId, delegation: 'P7_PENDING' },
        }),
      );

      await requireAudit(
        this.audit,
        {
          eventType: TenantManagementEventTypes.TERMINATION_APPROVED,
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

    const correlationId = input.correlationId?.trim() || randomUUID();

    return this.outbox.runWithOutbox(EDGE_P8_OUTBOX_TENANT, async (client, enqueue) => {
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

      await enqueue(
        buildTenantManagementOutboxEvent({
          eventType: TenantManagementEventTypes.TERMINATION_REJECTED,
          aggregateId: updated.id,
          correlationId,
          payload: { rejectedReason: reason, actorId: input.actorId },
        }),
      );

      await requireAudit(
        this.audit,
        {
          eventType: TenantManagementEventTypes.TERMINATION_REJECTED,
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

  async execute(verticalId?: string) {
    const metrics = await this.repo.portfolioMetrics(verticalId);
    // Snapshot only the platform-wide view — vertical-scoped reads don't pollute the store.
    if (!verticalId) {
      await this.repo.createAnalyticsSnapshot(
        'portfolio',
        metrics as unknown as Record<string, unknown>,
      );
    }
    return metrics;
  }
}

export class ExportTenantsUseCase {
  constructor(
    private readonly repo: TenantManagementRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    filter: TenantSearchFilter;
    correlationId?: string | null;
    access?: OperatorTenantAccess;
  }) {
    const correlationId = input.correlationId?.trim() || randomUUID();
    const csv = await this.repo.exportTenantsCsv(
      applyOperatorAccessToFilter(input.filter, input.access),
    );

    await this.outbox.runWithOutbox(EDGE_P8_OUTBOX_TENANT, async (client, enqueue) => {
      await enqueue(
        buildTenantManagementOutboxEvent({
          eventType: TenantManagementEventTypes.EXPORT_REQUESTED,
          aggregateId: correlationId,
          correlationId,
          payload: { actorId: input.actorId, rowEstimate: csv.split('\n').length - 1 },
        }),
      );
      await this.repo.appendActivity(
        {
          tenantRegistryId: null,
          productTenantId: null,
          eventType: 'TENANT_EXPORT',
          action: 'EXPORT',
          actorId: input.actorId,
          actorType: 'ADMIN',
          source: 'p8.tenant_management',
          outcome: 'SUCCESS',
          reason: null,
          correlationId,
          causationId: null,
          beforeRef: null,
          afterRef: { format: 'CSV' },
          evidenceRef: null,
          details: { filter: input.filter },
        },
        client,
      );
      await requireAudit(
        this.audit,
        {
          eventType: TenantManagementEventTypes.EXPORT_REQUESTED,
          actorId: input.actorId,
          subjectType: 'TENANT_REGISTRY',
          subjectId: correlationId,
          details: { format: 'CSV' },
        },
        client,
      );
    });

    return { csv, correlationId };
  }
}

export class PreviewBulkOperationUseCase {
  constructor(private readonly repo: TenantManagementRepositoryPort) {}

  async execute(input: {
    actorId: string;
    operationType: string;
    filter: TenantSearchFilter;
    payload?: Record<string, unknown>;
    idempotencyKey: string;
    correlationId?: string | null;
  }) {
    const allowed = ['TAG', 'ASSIGN', 'CLASSIFY', 'REVIEW', 'RECONCILE'];
    if (!allowed.includes(input.operationType)) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Unsupported bulk operation type');
    }
    const existing = await this.repo.getBulkOperationByIdempotency(input.idempotencyKey);
    if (existing) return existing;

    const preview = await this.repo.search({ ...input.filter, limit: 1, offset: 0 });
    const scope = await this.repo.search({ ...input.filter, limit: 5000, offset: 0 });
    const frozenTenantIds = scope.items.map((t) => t.id);
    const correlationId = input.correlationId?.trim() || randomUUID();

    return this.repo.createBulkOperation({
      operationType: input.operationType,
      status: 'PREVIEW',
      previewCount: preview.total,
      filter: input.filter as Record<string, unknown>,
      payload: { ...(input.payload ?? {}), frozenTenantIds },
      results: [],
      requestedBy: input.actorId,
      approverId: null,
      correlationId,
      idempotencyKey: input.idempotencyKey,
    });
  }
}

export class ExecuteBulkOperationUseCase {
  constructor(
    private readonly repo: TenantManagementRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    bulkOperationId: string;
    expectedPreviewCount: number;
  }) {
    const op = await this.repo.getBulkOperation(input.bulkOperationId);
    if (!op) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Bulk operation not found');
    }
    if (op.status !== 'PREVIEW' && op.status !== 'APPROVED') {
      throw new DomainError(ErrorCode.CONFLICT, 'Bulk operation is not executable');
    }

    const type = op.operationType;
    const filter = op.filter as TenantSearchFilter;
    const search = await this.repo.search({ ...filter, limit: 5000, offset: 0 });
    if (input.expectedPreviewCount !== search.total || input.expectedPreviewCount !== op.previewCount) {
      throw new DomainError(ErrorCode.CONFLICT, 'Preview count mismatch — re-run preview');
    }

    const frozenTenantIds = (op.payload as { frozenTenantIds?: string[] }).frozenTenantIds;
    if (!frozenTenantIds?.length) {
      throw new DomainError(
        ErrorCode.CONFLICT,
        'Bulk operation missing frozen tenant scope — re-run preview',
      );
    }
    const frozenSet = new Set(frozenTenantIds);
    const tenants = search.items.filter((t) => frozenSet.has(t.id));
    if (tenants.length !== frozenTenantIds.length) {
      throw new DomainError(ErrorCode.CONFLICT, 'Frozen tenant scope no longer matches search results');
    }

    if (BULK_SENSITIVE_TYPES.has(type) && op.status === 'PREVIEW') {
      assertSeparationOfDuties(op.requestedBy, input.actorId);
      await this.repo.updateBulkOperation(op.id, {
        status: 'APPROVED',
        approverId: input.actorId,
      });
    }

    const results: unknown[] = [];

    if (type === 'TAG') {
      const tagKey = String((op.payload as { tagKey?: string }).tagKey ?? '');
      const tagValue = String((op.payload as { tagValue?: string }).tagValue ?? '');
      if (!tagKey) {
        throw new DomainError(ErrorCode.VALIDATION_ERROR, 'payload.tagKey is required for TAG bulk');
      }
      for (const tenant of tenants) {
        await this.repo.addTag({
          tenantRegistryId: tenant.id,
          tagKey,
          tagValue,
          createdBy: input.actorId,
        });
        results.push({ tenantRegistryId: tenant.id, tagKey, tagValue });
      }
    } else if (type === 'ASSIGN') {
      const internalOwnerId = (op.payload as { internalOwnerId?: string | null }).internalOwnerId;
      const operationalTeam = (op.payload as { operationalTeam?: string | null }).operationalTeam;
      for (const tenant of tenants) {
        const updated = await this.repo.updateTenant(
          tenant.id,
          {
            internalOwnerId: internalOwnerId ?? tenant.internalOwnerId,
            operationalTeam: operationalTeam ?? tenant.operationalTeam,
          },
          tenant.version,
          input.actorId,
        );
        results.push({ tenantRegistryId: updated.id, version: updated.version });
      }
    } else if (type === 'CLASSIFY') {
      const classification = String((op.payload as { classification?: string }).classification ?? '');
      if (!classification) {
        throw new DomainError(ErrorCode.VALIDATION_ERROR, 'payload.classification is required');
      }
      for (const tenant of tenants) {
        const updated = await this.repo.updateTenant(
          tenant.id,
          { classification },
          tenant.version,
          input.actorId,
        );
        results.push({ tenantRegistryId: updated.id, classification });
      }
    } else if (type === 'REVIEW') {
      for (const tenant of tenants) {
        if (String(tenant.governanceStatus) === GovernanceStatus.COMPLIANT) {
          const updated = await this.repo.updateTenant(
            tenant.id,
            { governanceStatus: GovernanceStatus.REVIEW_REQUIRED },
            tenant.version,
            input.actorId,
          );
          results.push({ tenantRegistryId: updated.id, governanceStatus: updated.governanceStatus });
        }
      }
    } else if (type === 'RECONCILE') {
      results.push({ note: 'Use RunReconciliationUseCase for full reconcile; bulk marks scope only', count: search.total });
    } else {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Destructive bulk operations are not supported');
    }

    const correlationId = op.correlationId ?? randomUUID();
    return this.outbox.runWithOutbox(EDGE_P8_OUTBOX_TENANT, async (client, enqueue) => {
      const completed = await this.repo.updateBulkOperation(
        op.id,
        { status: 'COMPLETED', results },
        client,
      );

      await enqueue(
        buildTenantManagementOutboxEvent({
          eventType: TenantManagementEventTypes.BULK_COMPLETED,
          aggregateId: completed.id,
          correlationId,
          payload: { operationType: type, affected: results.length },
        }),
      );

      await requireAudit(
        this.audit,
        {
          eventType: TenantManagementEventTypes.BULK_COMPLETED,
          actorId: input.actorId,
          subjectType: 'BULK_OPERATION',
          subjectId: completed.id,
          details: { operationType: type, affected: results.length },
        },
        client,
      );

      return { operation: completed, results };
    });
  }
}

export class ListBulkOperationsUseCase {
  constructor(private readonly repo: TenantManagementRepositoryPort) {}

  async execute(filter: { status?: string; limit?: number; offset?: number }) {
    return this.repo.listBulkOperations(filter);
  }
}

export class RecordHealthSnapshotUseCase {
  constructor(
    private readonly repo: TenantManagementRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    tenantRegistryId: string;
    overallStatus: string;
    indicators: Record<string, unknown>;
    sourceSystem: string;
    observedAt: Date;
    staleAfter?: Date;
    correlationId?: string | null;
  }) {
    const tenant = await this.repo.getById(input.tenantRegistryId);
    if (!tenant) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Tenant registry record not found');
    }
    const observedAt = input.observedAt;
    const coerced = coerceHealthOverallStatus(input.overallStatus, observedAt);
    assertHealthSnapshotSource(String(coerced), input.sourceSystem);
    const staleAfter =
      input.staleAfter ?? new Date(observedAt.getTime() + HEALTH_FRESHNESS_MS);
    const correlationId = input.correlationId?.trim() || randomUUID();

    return this.outbox.runWithOutbox(EDGE_P8_OUTBOX_TENANT, async (client, enqueue) => {
      const snapshot = await this.repo.createHealthSnapshot(
        {
          tenantRegistryId: tenant.id,
          productTenantId: tenant.productTenantId,
          overallStatus: coerced,
          indicators: input.indicators,
          sourceSystem: input.sourceSystem,
          observedAt,
          staleAfter,
        },
        client,
      );

      await this.repo.updateTenantHealthFromSnapshot(
        tenant.id,
        String(coerced),
        observedAt,
        input.actorId,
        client,
      );

      await enqueue(
        buildTenantManagementOutboxEvent({
          eventType: TenantManagementEventTypes.HEALTH_RECORDED,
          aggregateId: snapshot.id,
          correlationId,
          payload: { overallStatus: coerced, observedAt: observedAt.toISOString() },
        }),
      );

      await requireAudit(
        this.audit,
        {
          eventType: TenantManagementEventTypes.HEALTH_RECORDED,
          actorId: input.actorId,
          subjectType: 'HEALTH_SNAPSHOT',
          subjectId: snapshot.id,
          details: { overallStatus: coerced },
        },
        client,
      );

      return snapshot;
    });
  }
}

export class ListHealthSnapshotsUseCase {
  constructor(private readonly repo: TenantManagementRepositoryPort) {}

  async execute(tenantRegistryId: string, limit?: number) {
    return this.repo.listHealthSnapshots(tenantRegistryId, limit);
  }
}

export class EvaluateTenantRiskUseCase {
  constructor(
    private readonly repo: TenantManagementRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: { actorId: string; tenantRegistryId: string; correlationId?: string | null }) {
    const tenant = await this.repo.getById(input.tenantRegistryId);
    if (!tenant) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Tenant registry record not found');
    }
    const activeExceptions = await this.repo.countActiveExceptions(tenant.id);
    const criticalFindings = await this.repo.listFindings({
      tenantRegistryId: tenant.id,
      status: 'OPEN',
      limit: 200,
    });
    const openCritical = criticalFindings.items.filter((f) => f.severity === 'CRITICAL').length;

    const evaluated = evaluateTenantRiskLevel({
      legalHold: tenant.legalHold,
      activeExceptionCount: activeExceptions,
      governanceStatus: String(tenant.governanceStatus),
      openCriticalFindings: openCritical,
    });

    const correlationId = input.correlationId?.trim() || randomUUID();
    const ruleVersion = 'p8-risk-v1';

    return this.outbox.runWithOutbox(EDGE_P8_OUTBOX_TENANT, async (client, enqueue) => {
      const assessment = await this.repo.createRiskAssessment(
        {
          tenantRegistryId: tenant.id,
          productTenantId: tenant.productTenantId,
          riskLevel: evaluated.riskLevel,
          score: null,
          ruleVersion,
          inputs: {
            legalHold: tenant.legalHold,
            activeExceptions,
            governanceStatus: tenant.governanceStatus,
            openCriticalFindings: openCritical,
          },
          result: { reasons: evaluated.reasons },
          evidenceRefs: [],
          reviewerId: input.actorId,
        },
        client,
      );

      await this.repo.updateTenantRiskLevel(tenant.id, evaluated.riskLevel, input.actorId, client);

      await enqueue(
        buildTenantManagementOutboxEvent({
          eventType: TenantManagementEventTypes.RISK_EVALUATED,
          aggregateId: assessment.id,
          correlationId,
          payload: { riskLevel: evaluated.riskLevel, ruleVersion },
        }),
      );

      await requireAudit(
        this.audit,
        {
          eventType: TenantManagementEventTypes.RISK_EVALUATED,
          actorId: input.actorId,
          subjectType: 'RISK_ASSESSMENT',
          subjectId: assessment.id,
          details: { riskLevel: evaluated.riskLevel, reasons: evaluated.reasons },
        },
        client,
      );

      return assessment;
    });
  }
}

export class ListRiskAssessmentsUseCase {
  constructor(private readonly repo: TenantManagementRepositoryPort) {}

  async execute(tenantRegistryId: string, limit?: number) {
    return this.repo.listRiskAssessments(tenantRegistryId, limit);
  }
}

export class UpdateTenantPoliciesUseCase {
  constructor(
    private readonly repo: TenantManagementRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    tenantRegistryId: string;
    expectedVersion: number;
    retentionPolicyRef?: string | null;
    securityPolicyRef?: string | null;
    dataResidencyRef?: string | null;
    deletionProtection?: boolean;
    correlationId?: string | null;
  }) {
    const tenant = await this.repo.getById(input.tenantRegistryId);
    if (!tenant) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Tenant registry record not found');
    }
    const correlationId = input.correlationId?.trim() || randomUUID();

    return this.outbox.runWithOutbox(EDGE_P8_OUTBOX_TENANT, async (client, enqueue) => {
      let record = tenant;

      const policyPatch: {
        retentionPolicyRef?: string | null;
        securityPolicyRef?: string | null;
        dataResidencyRef?: string | null;
        deletionProtection?: boolean;
      } = {};
      if (input.retentionPolicyRef !== undefined) policyPatch.retentionPolicyRef = input.retentionPolicyRef;
      if (input.securityPolicyRef !== undefined) policyPatch.securityPolicyRef = input.securityPolicyRef;
      if (input.dataResidencyRef !== undefined) policyPatch.dataResidencyRef = input.dataResidencyRef;
      if (input.deletionProtection !== undefined) policyPatch.deletionProtection = input.deletionProtection;

      if (Object.keys(policyPatch).length > 0) {
        record = await this.repo.updateGovernancePolicies(
          record.id,
          policyPatch,
          record.version,
          input.actorId,
          client,
        );
      }

      await requireAudit(
        this.audit,
        {
          eventType: TenantManagementEventTypes.GOVERNANCE_STATUS_CHANGED,
          actorId: input.actorId,
          subjectType: 'TENANT_REGISTRY',
          subjectId: record.id,
          details: {
            legalHold: record.legalHold,
            retentionPolicyRef: record.retentionPolicyRef,
            securityPolicyRef: record.securityPolicyRef,
            dataResidencyRef: record.dataResidencyRef,
            deletionProtection: record.deletionProtection,
          },
        },
        client,
      );

      return record;
    });
  }
}

export class RequestLegalHoldChangeUseCase {
  constructor(
    private readonly repo: TenantManagementRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    tenantRegistryId: string;
    action: LegalHoldChangeAction | string;
    justification: string;
    idempotencyKey: string;
    correlationId?: string | null;
  }) {
    assertJustification(input.justification);
    const action = String(input.action);
    if (action !== LegalHoldChangeAction.RAISE && action !== LegalHoldChangeAction.LIFT) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'action must be RAISE or LIFT');
    }
    const tenant = await this.repo.getById(input.tenantRegistryId);
    if (!tenant) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Tenant registry record not found');
    }
    if (action === LegalHoldChangeAction.RAISE && tenant.legalHold) {
      throw new DomainError(ErrorCode.CONFLICT, 'Legal hold is already active');
    }
    if (action === LegalHoldChangeAction.LIFT && !tenant.legalHold) {
      throw new DomainError(ErrorCode.CONFLICT, 'Legal hold is not active');
    }

    const existing = await this.repo.getLegalHoldChangeRequestByIdempotency(input.idempotencyKey);
    if (existing) return existing;

    const correlationId = input.correlationId?.trim() || randomUUID();

    return this.outbox.runWithOutbox(EDGE_P8_OUTBOX_TENANT, async (client, enqueue) => {
      const record = await this.repo.createLegalHoldChangeRequest(
        {
          tenantRegistryId: tenant.id,
          action,
          status: GovernanceRequestStatus.PENDING,
          justification: input.justification.trim(),
          requestedBy: input.actorId,
          approverId: null,
          approvedAt: null,
          rejectedReason: null,
          correlationId,
          idempotencyKey: input.idempotencyKey,
        },
        client,
      );

      await enqueue(
        buildTenantManagementOutboxEvent({
          eventType: TenantManagementEventTypes.LEGAL_HOLD_CHANGE_REQUESTED,
          aggregateId: record.id,
          correlationId,
          payload: { tenantRegistryId: tenant.id, action },
        }),
      );

      await requireAudit(
        this.audit,
        {
          eventType: TenantManagementEventTypes.LEGAL_HOLD_CHANGE_REQUESTED,
          actorId: input.actorId,
          subjectType: 'LEGAL_HOLD_REQUEST',
          subjectId: record.id,
          details: { tenantRegistryId: tenant.id, action },
        },
        client,
      );

      return record;
    });
  }
}

export class ApproveLegalHoldChangeUseCase {
  constructor(
    private readonly repo: TenantManagementRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    requestId: string;
    correlationId?: string | null;
  }) {
    const request = await this.repo.getLegalHoldChangeRequest(input.requestId);
    if (!request) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Legal hold change request not found');
    }
    if (String(request.status) !== GovernanceRequestStatus.PENDING) {
      throw new DomainError(ErrorCode.CONFLICT, 'Legal hold change request is not pending');
    }
    assertSeparationOfDuties(request.requestedBy, input.actorId);

    const tenant = await this.repo.getById(request.tenantRegistryId);
    if (!tenant) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Tenant registry record not found');
    }

    const targetLegalHold = String(request.action) === LegalHoldChangeAction.RAISE;
    if (targetLegalHold === tenant.legalHold) {
      throw new DomainError(ErrorCode.CONFLICT, 'Legal hold state already matches requested action');
    }

    const correlationId = input.correlationId?.trim() || randomUUID();

    return this.outbox.runWithOutbox(EDGE_P8_OUTBOX_TENANT, async (client, enqueue) => {
      const updatedTenant = await this.repo.updateLegalHold(
        tenant.id,
        targetLegalHold,
        tenant.version,
        input.actorId,
        client,
      );

      const updated = await this.repo.updateLegalHoldChangeRequest(
        request.id,
        {
          status: GovernanceRequestStatus.APPROVED,
          approverId: input.actorId,
          approvedAt: new Date(),
        },
        request.version,
        client,
      );

      await enqueue(
        buildTenantManagementOutboxEvent({
          eventType: TenantManagementEventTypes.LEGAL_HOLD_CHANGE_APPROVED,
          aggregateId: updated.id,
          correlationId,
          payload: {
            tenantRegistryId: tenant.id,
            action: request.action,
            legalHold: targetLegalHold,
            approverId: input.actorId,
          },
        }),
      );

      await enqueue(
        buildTenantManagementOutboxEvent({
          eventType: TenantManagementEventTypes.LEGAL_HOLD_CHANGED,
          aggregateId: updatedTenant.id,
          correlationId,
          payload: {
            legalHold: targetLegalHold,
            actorId: input.actorId,
            justification: request.justification,
            previousLegalHold: tenant.legalHold,
            viaApproval: true,
          },
        }),
      );

      await requireAudit(
        this.audit,
        {
          eventType: TenantManagementEventTypes.LEGAL_HOLD_CHANGE_APPROVED,
          actorId: input.actorId,
          subjectType: 'LEGAL_HOLD_REQUEST',
          subjectId: updated.id,
          details: { legalHold: targetLegalHold },
        },
        client,
      );

      return { request: updated, tenant: updatedTenant };
    });
  }
}

export class RejectLegalHoldChangeUseCase {
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
    const request = await this.repo.getLegalHoldChangeRequest(input.requestId);
    if (!request) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Legal hold change request not found');
    }
    if (String(request.status) !== GovernanceRequestStatus.PENDING) {
      throw new DomainError(ErrorCode.CONFLICT, 'Legal hold change request is not pending');
    }
    assertSeparationOfDuties(request.requestedBy, input.actorId);
    const reason = input.rejectedReason.trim();
    if (reason.length < 4) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'rejectedReason is required');
    }
    const correlationId = input.correlationId?.trim() || randomUUID();

    return this.outbox.runWithOutbox(EDGE_P8_OUTBOX_TENANT, async (client, enqueue) => {
      const updated = await this.repo.updateLegalHoldChangeRequest(
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
          eventType: TenantManagementEventTypes.LEGAL_HOLD_CHANGE_REJECTED,
          aggregateId: updated.id,
          correlationId,
          payload: { rejectedReason: reason, approverId: input.actorId },
        }),
      );

      await requireAudit(
        this.audit,
        {
          eventType: TenantManagementEventTypes.LEGAL_HOLD_CHANGE_REJECTED,
          actorId: input.actorId,
          subjectType: 'LEGAL_HOLD_REQUEST',
          subjectId: updated.id,
          details: { rejectedReason: reason },
        },
        client,
      );

      return updated;
    });
  }
}

export class ListLegalHoldChangeRequestsUseCase {
  constructor(private readonly repo: TenantManagementRepositoryPort) {}

  async execute(filter: {
    tenantRegistryId?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }) {
    return this.repo.listLegalHoldChangeRequests(filter);
  }
}

export class AuthorizeTenantDeprovisionUseCase {
  constructor(
    private readonly repo: TenantManagementRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    tenantRegistryId: string;
    expectedVersion: number;
    authorized: boolean;
    confirmed: boolean;
    liftDeletionProtection: boolean;
    justification: string;
    deprovisionAuthorizePermissionGranted: boolean;
    correlationId?: string | null;
  }) {
    if (!input.deprovisionAuthorizePermissionGranted) {
      throw new DomainError(
        ErrorCode.FORBIDDEN,
        'deprovision authorization requires platform:tenant_management:deprovision:authorize',
      );
    }
    assertJustification(input.justification);
    if (!input.authorized || !input.confirmed) {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        'Deprovision authorization requires authorized===true and confirmed===true',
        [{ code: 'DEPROVISION_FLAGS_REQUIRED' }],
      );
    }

    const tenant = await this.repo.getById(input.tenantRegistryId);
    if (!tenant) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Tenant registry record not found');
    }
    assertNotLegalHold(tenant.legalHold, 'DEPROVISION_AUTHORIZE');

    const correlationId = input.correlationId?.trim() || randomUUID();
    const nextMetadata = {
      ...(tenant.metadata ?? {}),
      p7DeprovisionAuthorized: true,
      p7DeprovisionConfirmed: true,
      p7DeprovisionAuthorizedBy: input.actorId,
      p7DeprovisionAuthorizedAt: new Date().toISOString(),
      p7DeprovisionJustification: input.justification.trim(),
    };

    return this.outbox.runWithOutbox(EDGE_P8_OUTBOX_TENANT, async (client, enqueue) => {
      let record = await this.repo.updateTenant(
        tenant.id,
        {
          metadata: nextMetadata,
          lastAdminActivityAt: new Date(),
        },
        input.expectedVersion,
        input.actorId,
        client,
      );

      if (input.liftDeletionProtection && record.deletionProtection) {
        record = await this.repo.updateGovernancePolicies(
          record.id,
          { deletionProtection: false },
          record.version,
          input.actorId,
          client,
        );
      }

      await enqueue(
        buildTenantManagementOutboxEvent({
          eventType: TenantManagementEventTypes.DEPROVISION_AUTHORIZED,
          aggregateId: record.id,
          correlationId,
          payload: {
            deprovisionAuthorized: true,
            deletionProtection: record.deletionProtection,
            actorId: input.actorId,
          },
        }),
      );

      await requireAudit(
        this.audit,
        {
          eventType: TenantManagementEventTypes.DEPROVISION_AUTHORIZED,
          actorId: input.actorId,
          subjectType: 'TENANT_REGISTRY',
          subjectId: record.id,
          details: {
            authorized: true,
            confirmed: true,
            deletionProtection: record.deletionProtection,
            justification: input.justification.trim(),
          },
        },
        client,
      );

      return record;
    });
  }
}

export class UpdateLegalHoldUseCase {
  constructor(
    private readonly repo: TenantManagementRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    tenantRegistryId: string;
    expectedVersion: number;
    legalHold: boolean;
    justification: string;
    legalHoldPermissionGranted: boolean;
    correlationId?: string | null;
  }) {
    if (!input.legalHoldPermissionGranted) {
      throw new DomainError(
        ErrorCode.FORBIDDEN,
        'legal hold changes require platform:tenant_management:legal_hold:manage',
      );
    }
    assertJustification(input.justification);

    const tenant = await this.repo.getById(input.tenantRegistryId);
    if (!tenant) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Tenant registry record not found');
    }
    if (input.legalHold === tenant.legalHold) {
      return tenant;
    }

    assertLegalHoldMutationRequiresWorkflow(tenant.legalHold, input.legalHold);

    const correlationId = input.correlationId?.trim() || randomUUID();
    const justification = input.justification.trim();

    return this.outbox.runWithOutbox(EDGE_P8_OUTBOX_TENANT, async (client, enqueue) => {
      const record = await this.repo.updateLegalHold(
        tenant.id,
        input.legalHold,
        input.expectedVersion,
        input.actorId,
        client,
      );

      await enqueue(
        buildTenantManagementOutboxEvent({
          eventType: TenantManagementEventTypes.LEGAL_HOLD_CHANGED,
          aggregateId: record.id,
          correlationId,
          payload: {
            legalHold: input.legalHold,
            actorId: input.actorId,
            justification,
            previousLegalHold: tenant.legalHold,
          },
        }),
      );

      await requireAudit(
        this.audit,
        {
          eventType: TenantManagementEventTypes.LEGAL_HOLD_CHANGED,
          actorId: input.actorId,
          subjectType: 'TENANT_REGISTRY',
          subjectId: record.id,
          details: {
            legalHold: input.legalHold,
            previousLegalHold: tenant.legalHold,
            justification,
          },
        },
        client,
      );

      return record;
    });
  }
}

export class ListTenantReconciliationRunsUseCase {
  constructor(private readonly repo: TenantManagementRepositoryPort) {}

  async execute(filter: { limit?: number; offset?: number }) {
    return this.repo.listReconciliationRuns(filter);
  }
}

export class AcknowledgeFindingUseCase {
  constructor(
    private readonly repo: TenantManagementRepositoryPort,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    findingId: string;
    status: 'ACKNOWLEDGED' | 'DISMISSED';
    reason?: string | null;
  }) {
    if (input.status !== 'ACKNOWLEDGED' && input.status !== 'DISMISSED') {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'status must be ACKNOWLEDGED or DISMISSED');
    }
    const updated = await this.repo.updateFindingStatus(input.findingId, input.status);
    await requireAudit(
      this.audit,
      {
        eventType: TenantManagementEventTypes.RECONCILIATION_COMPLETED,
        actorId: input.actorId,
        subjectType: 'RECONCILIATION_FINDING',
        subjectId: updated.id,
        details: { status: input.status, reason: input.reason ?? null },
      },
      undefined,
    );
    return updated;
  }
}

/** Re-export port token for DI convenience in tests. */
export { TENANT_MANAGEMENT_REPOSITORY_PORT };