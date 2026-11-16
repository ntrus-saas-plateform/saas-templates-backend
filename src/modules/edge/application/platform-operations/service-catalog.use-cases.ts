import { randomUUID } from 'node:crypto';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import type { ControlPlaneOutboxTransactionService } from '../../../../shared/messaging/control-plane-outbox-transaction.service.js';
import type { AuditEventRepositoryPort } from '../../domain/ports/audit-event-repository.port.js';
import {
  assertLifecycleAllowsDependency,
  assertNoSelfDependency,
  assertObservationTransition,
  assertServiceCode,
  slugifyServiceCode,
} from '../../domain/platform-operations/service-catalog-policy.js';
import type { ServiceCatalogRepositoryPort } from '../../domain/platform-operations/service-catalog-repository.port.js';
import {
  buildServiceCatalogOutboxEvent,
  EDGE_P9_OUTBOX_TENANT,
  ServiceCatalogEventTypes,
} from '../../domain/platform-operations/service-catalog.events.js';
import {
  ServiceCategory,
  ServiceCriticality,
  ServiceDependencyType,
  ServiceEnvironment,
  ServiceLifecycleStatus,
  ServiceObservationStatus,
  ServiceType,
  type PlatformServiceDetail,
  type ServiceCatalogSearchFilter,
} from '../../domain/platform-operations/service-catalog.types.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  const actorId = UUID_PATTERN.test(input.actorId) ? input.actorId : null;
  if (actorId === null && input.actorId) details.actorRef = input.actorId;
  const subjectId = UUID_PATTERN.test(input.subjectId) ? input.subjectId : null;
  if (subjectId === null && input.subjectId) details.subjectRef = input.subjectId;
  try {
    await audit.create({ ...input, actorId, subjectId, details }, client);
  } catch (err) {
    throw new DomainError(
      ErrorCode.DEPENDENCY_UNAVAILABLE,
      'Durable audit required for service catalog mutation',
      [{ eventType: input.eventType }],
      err instanceof Error ? err : undefined,
    );
  }
}

export class ListPlatformServicesUseCase {
  constructor(private readonly repo: ServiceCatalogRepositoryPort) {}

  async execute(filter: ServiceCatalogSearchFilter) {
    return this.repo.search(filter);
  }
}

export class GetPlatformServiceUseCase {
  constructor(private readonly repo: ServiceCatalogRepositoryPort) {}

  async execute(id: string): Promise<PlatformServiceDetail> {
    const service = await this.repo.getById(id);
    if (!service) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Platform service not found');
    }
    const [dependencies, dependents] = await Promise.all([
      this.repo.listDependencies(id),
      this.repo.listDependents(id),
    ]);
    return { service, dependencies, dependents };
  }
}

export class RegisterPlatformServiceUseCase {
  constructor(
    private readonly repo: ServiceCatalogRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    serviceCode: string;
    displayName: string;
    description?: string | null;
    category?: string;
    serviceType?: string;
    lifecycleStatus?: string;
    observationStatus?: string;
    businessCriticality?: string;
    technicalCriticality?: string;
    environment?: string;
    region?: string | null;
    deploymentProfile?: string | null;
    runtimeTechnology?: string | null;
    currentVersion?: string | null;
    serviceOwnerId?: string | null;
    technicalOwnerId?: string | null;
    operationalTeam?: string | null;
    supportGroup?: string | null;
    escalationPolicyRef?: string | null;
    healthCheckRef?: string | null;
    monitoringConfigRef?: string | null;
    sloRef?: string | null;
    runbookRef?: string | null;
    rpoMinutes?: number | null;
    rtoMinutes?: number | null;
    maintenancePolicyRef?: string | null;
    dataClassification?: string | null;
    securityClassification?: string | null;
    supportHours?: string | null;
    documentationUrl?: string | null;
    p7ResourceRef?: string | null;
    p8ProjectionNote?: string | null;
    metadata?: Record<string, unknown>;
    correlationId?: string | null;
  }) {
    assertServiceCode(input.serviceCode);
    const displayName = input.displayName.trim();
    if (displayName.length < 2) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'displayName is required');
    }

    const existing = await this.repo.getByCode(input.serviceCode.trim());
    if (existing) {
      throw new DomainError(ErrorCode.CONFLICT, 'serviceCode already registered', [
        { code: 'SERVICE_CODE_EXISTS', serviceCode: input.serviceCode },
      ]);
    }

    const observationStatus =
      input.observationStatus?.trim() || ServiceObservationStatus.CONFIGURED;
    const metadata = input.metadata ?? {};
    assertObservationTransition(ServiceObservationStatus.UNKNOWN, observationStatus, metadata);

    const correlationId = input.correlationId?.trim() || randomUUID();

    return this.outbox.runWithOutbox(EDGE_P9_OUTBOX_TENANT, async (client, enqueue) => {
      const record = await this.repo.createService(
        {
          serviceCode: input.serviceCode.trim(),
          serviceSlug: slugifyServiceCode(input.serviceCode),
          displayName,
          description: input.description?.trim() || null,
          category: input.category?.trim() || ServiceCategory.PLATFORM,
          serviceType: input.serviceType?.trim() || ServiceType.INTERNAL,
          lifecycleStatus: input.lifecycleStatus?.trim() || ServiceLifecycleStatus.CONFIGURED,
          observationStatus,
          businessCriticality:
            input.businessCriticality?.trim() || ServiceCriticality.MEDIUM,
          technicalCriticality:
            input.technicalCriticality?.trim() || ServiceCriticality.MEDIUM,
          environment: input.environment?.trim() || ServiceEnvironment.PRODUCTION,
          region: input.region ?? null,
          deploymentProfile: input.deploymentProfile ?? null,
          runtimeTechnology: input.runtimeTechnology ?? null,
          currentVersion: input.currentVersion ?? null,
          serviceOwnerId: input.serviceOwnerId ?? null,
          technicalOwnerId: input.technicalOwnerId ?? null,
          operationalTeam: input.operationalTeam ?? null,
          supportGroup: input.supportGroup ?? null,
          escalationPolicyRef: input.escalationPolicyRef ?? null,
          healthCheckRef: input.healthCheckRef ?? null,
          monitoringConfigRef: input.monitoringConfigRef ?? null,
          sloRef: input.sloRef ?? null,
          runbookRef: input.runbookRef ?? null,
          rpoMinutes: input.rpoMinutes ?? null,
          rtoMinutes: input.rtoMinutes ?? null,
          maintenancePolicyRef: input.maintenancePolicyRef ?? null,
          dataClassification: input.dataClassification ?? null,
          securityClassification: input.securityClassification ?? null,
          supportHours: input.supportHours ?? null,
          documentationUrl: input.documentationUrl ?? null,
          p7ResourceRef: input.p7ResourceRef ?? null,
          p8ProjectionNote: input.p8ProjectionNote ?? null,
          metadata,
          createdBy: input.actorId,
          updatedBy: null,
        },
        client,
      );

      await enqueue(
        buildServiceCatalogOutboxEvent({
          eventType: ServiceCatalogEventTypes.SERVICE_REGISTERED,
          aggregateId: record.id,
          correlationId,
          actorId: input.actorId,
          payload: {
            serviceCode: record.serviceCode,
            observationStatus: record.observationStatus,
          },
        }),
      );

      await this.repo.appendActivity(
        {
          serviceId: record.id,
          eventType: ServiceCatalogEventTypes.SERVICE_REGISTERED,
          action: 'REGISTER',
          actorId: input.actorId,
          correlationId,
          details: { serviceCode: record.serviceCode },
        },
        client,
      );

      await requireAudit(
        this.audit,
        {
          eventType: ServiceCatalogEventTypes.SERVICE_REGISTERED,
          actorId: input.actorId,
          subjectType: 'PLATFORM_SERVICE',
          subjectId: record.id,
          details: { serviceCode: record.serviceCode },
        },
        client,
      );

      return record;
    });
  }
}

export class UpdatePlatformServiceUseCase {
  constructor(
    private readonly repo: ServiceCatalogRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    id: string;
    expectedVersion: number;
    displayName?: string;
    description?: string | null;
    category?: string;
    serviceType?: string;
    lifecycleStatus?: string;
    observationStatus?: string;
    businessCriticality?: string;
    technicalCriticality?: string;
    environment?: string;
    region?: string | null;
    deploymentProfile?: string | null;
    runtimeTechnology?: string | null;
    currentVersion?: string | null;
    serviceOwnerId?: string | null;
    technicalOwnerId?: string | null;
    operationalTeam?: string | null;
    supportGroup?: string | null;
    escalationPolicyRef?: string | null;
    healthCheckRef?: string | null;
    monitoringConfigRef?: string | null;
    sloRef?: string | null;
    runbookRef?: string | null;
    rpoMinutes?: number | null;
    rtoMinutes?: number | null;
    maintenancePolicyRef?: string | null;
    dataClassification?: string | null;
    securityClassification?: string | null;
    supportHours?: string | null;
    documentationUrl?: string | null;
    p7ResourceRef?: string | null;
    p8ProjectionNote?: string | null;
    metadata?: Record<string, unknown>;
    correlationId?: string | null;
  }) {
    const existing = await this.repo.getById(input.id);
    if (!existing) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Platform service not found');
    }

    const nextObservation =
      input.observationStatus !== undefined
        ? input.observationStatus
        : String(existing.observationStatus);
    const nextMetadata = input.metadata ?? existing.metadata;
    assertObservationTransition(
      String(existing.observationStatus),
      nextObservation,
      nextMetadata,
    );

    const correlationId = input.correlationId?.trim() || randomUUID();
    const ownershipChanged =
      (input.serviceOwnerId !== undefined &&
        input.serviceOwnerId !== existing.serviceOwnerId) ||
      (input.technicalOwnerId !== undefined &&
        input.technicalOwnerId !== existing.technicalOwnerId) ||
      (input.operationalTeam !== undefined &&
        input.operationalTeam !== existing.operationalTeam);

    return this.outbox.runWithOutbox(EDGE_P9_OUTBOX_TENANT, async (client, enqueue) => {
      const patch: Partial<typeof existing> = {};
      if (input.displayName !== undefined) patch.displayName = input.displayName.trim();
      if (input.description !== undefined) patch.description = input.description;
      if (input.category !== undefined) patch.category = input.category;
      if (input.serviceType !== undefined) patch.serviceType = input.serviceType;
      if (input.lifecycleStatus !== undefined) patch.lifecycleStatus = input.lifecycleStatus;
      if (input.observationStatus !== undefined) {
        patch.observationStatus = input.observationStatus;
      }
      if (input.businessCriticality !== undefined) {
        patch.businessCriticality = input.businessCriticality;
      }
      if (input.technicalCriticality !== undefined) {
        patch.technicalCriticality = input.technicalCriticality;
      }
      if (input.environment !== undefined) patch.environment = input.environment;
      if (input.region !== undefined) patch.region = input.region;
      if (input.deploymentProfile !== undefined) {
        patch.deploymentProfile = input.deploymentProfile;
      }
      if (input.runtimeTechnology !== undefined) {
        patch.runtimeTechnology = input.runtimeTechnology;
      }
      if (input.currentVersion !== undefined) patch.currentVersion = input.currentVersion;
      if (input.serviceOwnerId !== undefined) patch.serviceOwnerId = input.serviceOwnerId;
      if (input.technicalOwnerId !== undefined) {
        patch.technicalOwnerId = input.technicalOwnerId;
      }
      if (input.operationalTeam !== undefined) patch.operationalTeam = input.operationalTeam;
      if (input.supportGroup !== undefined) patch.supportGroup = input.supportGroup;
      if (input.escalationPolicyRef !== undefined) {
        patch.escalationPolicyRef = input.escalationPolicyRef;
      }
      if (input.healthCheckRef !== undefined) patch.healthCheckRef = input.healthCheckRef;
      if (input.monitoringConfigRef !== undefined) {
        patch.monitoringConfigRef = input.monitoringConfigRef;
      }
      if (input.sloRef !== undefined) patch.sloRef = input.sloRef;
      if (input.runbookRef !== undefined) patch.runbookRef = input.runbookRef;
      if (input.rpoMinutes !== undefined) patch.rpoMinutes = input.rpoMinutes;
      if (input.rtoMinutes !== undefined) patch.rtoMinutes = input.rtoMinutes;
      if (input.maintenancePolicyRef !== undefined) {
        patch.maintenancePolicyRef = input.maintenancePolicyRef;
      }
      if (input.dataClassification !== undefined) {
        patch.dataClassification = input.dataClassification;
      }
      if (input.securityClassification !== undefined) {
        patch.securityClassification = input.securityClassification;
      }
      if (input.supportHours !== undefined) patch.supportHours = input.supportHours;
      if (input.documentationUrl !== undefined) {
        patch.documentationUrl = input.documentationUrl;
      }
      if (input.p7ResourceRef !== undefined) patch.p7ResourceRef = input.p7ResourceRef;
      if (input.p8ProjectionNote !== undefined) {
        patch.p8ProjectionNote = input.p8ProjectionNote;
      }
      if (input.metadata !== undefined) patch.metadata = input.metadata;

      const updated = await this.repo.updateService(
        existing.id,
        patch,
        input.expectedVersion,
        input.actorId,
        client,
      );

      await enqueue(
        buildServiceCatalogOutboxEvent({
          eventType: ServiceCatalogEventTypes.SERVICE_UPDATED,
          aggregateId: updated.id,
          correlationId,
          actorId: input.actorId,
          payload: { version: updated.version },
        }),
      );

      if (ownershipChanged) {
        await enqueue(
          buildServiceCatalogOutboxEvent({
            eventType: ServiceCatalogEventTypes.SERVICE_OWNERSHIP_CHANGED,
            aggregateId: updated.id,
            correlationId,
            actorId: input.actorId,
            payload: {
              serviceOwnerId: updated.serviceOwnerId,
              technicalOwnerId: updated.technicalOwnerId,
              operationalTeam: updated.operationalTeam,
            },
          }),
        );
      }

      if (String(existing.observationStatus) !== String(updated.observationStatus)) {
        await enqueue(
          buildServiceCatalogOutboxEvent({
            eventType: ServiceCatalogEventTypes.SERVICE_OBSERVATION_CHANGED,
            aggregateId: updated.id,
            correlationId,
            actorId: input.actorId,
            payload: {
              from: existing.observationStatus,
              to: updated.observationStatus,
            },
          }),
        );
      }

      await requireAudit(
        this.audit,
        {
          eventType: ServiceCatalogEventTypes.SERVICE_UPDATED,
          actorId: input.actorId,
          subjectType: 'PLATFORM_SERVICE',
          subjectId: updated.id,
          details: { version: updated.version },
        },
        client,
      );

      return updated;
    });
  }
}

export class AddServiceDependencyUseCase {
  constructor(
    private readonly repo: ServiceCatalogRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    serviceId: string;
    dependsOnServiceId: string;
    dependencyType?: string;
    criticality?: string;
    description?: string | null;
    correlationId?: string | null;
  }) {
    assertNoSelfDependency(input.serviceId, input.dependsOnServiceId);
    const service = await this.repo.getById(input.serviceId);
    if (!service) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Platform service not found');
    }
    assertLifecycleAllowsDependency(String(service.lifecycleStatus));
    const dependsOn = await this.repo.getById(input.dependsOnServiceId);
    if (!dependsOn) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Dependency target service not found');
    }

    const correlationId = input.correlationId?.trim() || randomUUID();
    const dependencyType = input.dependencyType?.trim() || ServiceDependencyType.RUNTIME;

    return this.outbox.runWithOutbox(EDGE_P9_OUTBOX_TENANT, async (client, enqueue) => {
      const dep = await this.repo.addDependency(
        {
          serviceId: input.serviceId,
          dependsOnServiceId: input.dependsOnServiceId,
          dependencyType,
          criticality: input.criticality?.trim() || ServiceCriticality.HIGH,
          description: input.description ?? null,
          createdBy: input.actorId,
        },
        client,
      );

      await enqueue(
        buildServiceCatalogOutboxEvent({
          eventType: ServiceCatalogEventTypes.SERVICE_DEPENDENCY_ADDED,
          aggregateId: input.serviceId,
          correlationId,
          actorId: input.actorId,
          payload: {
            dependsOnServiceId: input.dependsOnServiceId,
            dependencyType,
          },
        }),
      );

      await requireAudit(
        this.audit,
        {
          eventType: ServiceCatalogEventTypes.SERVICE_DEPENDENCY_ADDED,
          actorId: input.actorId,
          subjectType: 'PLATFORM_SERVICE',
          subjectId: input.serviceId,
          details: { dependsOnServiceId: input.dependsOnServiceId, dependencyType },
        },
        client,
      );

      return dep;
    });
  }
}

export class RemoveServiceDependencyUseCase {
  constructor(
    private readonly repo: ServiceCatalogRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    serviceId: string;
    dependsOnServiceId: string;
    dependencyType: string;
    correlationId?: string | null;
  }) {
    const service = await this.repo.getById(input.serviceId);
    if (!service) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Platform service not found');
    }
    const correlationId = input.correlationId?.trim() || randomUUID();

    return this.outbox.runWithOutbox(EDGE_P9_OUTBOX_TENANT, async (client, enqueue) => {
      await this.repo.removeDependency(
        input.serviceId,
        input.dependsOnServiceId,
        input.dependencyType,
        client,
      );

      await enqueue(
        buildServiceCatalogOutboxEvent({
          eventType: ServiceCatalogEventTypes.SERVICE_DEPENDENCY_REMOVED,
          aggregateId: input.serviceId,
          correlationId,
          actorId: input.actorId,
          payload: {
            dependsOnServiceId: input.dependsOnServiceId,
            dependencyType: input.dependencyType,
          },
        }),
      );

      await requireAudit(
        this.audit,
        {
          eventType: ServiceCatalogEventTypes.SERVICE_DEPENDENCY_REMOVED,
          actorId: input.actorId,
          subjectType: 'PLATFORM_SERVICE',
          subjectId: input.serviceId,
          details: {
            dependsOnServiceId: input.dependsOnServiceId,
            dependencyType: input.dependencyType,
          },
        },
        client,
      );
    });
  }
}
