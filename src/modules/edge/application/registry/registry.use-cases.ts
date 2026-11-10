import { randomUUID } from 'node:crypto';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import type { IntegrationEvent } from '../../../../core/domain/events/integration-event.js';
import type { ControlPlaneOutboxTransactionService } from '../../../../shared/messaging/control-plane-outbox-transaction.service.js';
import type { AuditEventRepositoryPort } from '../../domain/ports/audit-event-repository.port.js';
import { evaluateRegistryCompatibility } from '../../domain/registry/compatibility-engine.js';
import {
  assertContractTransition,
  assertEnvironmentTransition,
  assertMutableContract,
  assertMutableTechnicalVersion,
  assertPlatformTransition,
  assertProductRegistryTransition,
  assertProfileTransition,
  assertTechnicalVersionTransition,
  isProvisionable,
} from '../../domain/registry/registry-lifecycle.js';
import type { RegistryRepositoryPort } from '../../domain/registry/registry-repository.port.js';
import {
  createCompatibilityEvaluatedEvent,
  createControlContractPublishedEvent,
  createDeploymentProfileUpdatedEvent,
  createEnvironmentRegisteredEvent,
  createPlatformRegisteredEvent,
  createProductCertifiedEvent,
  createProductDeprecatedEvent,
  createProductRegisteredEvent,
  createProductUpdatedEvent,
} from '../../domain/registry/registry.events.js';
import {
  CertificationStatus,
  ControlContractStatus,
  EnvironmentStatus,
  PlatformOperationalStatus,
  PlatformType,
  ProfileStatus,
  RegistryLifecycleStatus,
  RegistryResourceType,
  TechnicalVersionStatus,
  type DeploymentProfile,
  type ProductControlContract,
  type ProductPlatform,
  type ProductRegistryRecord,
  type ProductTechnicalVersion,
  type RuntimeEnvironment,
  RuntimeEnvironmentType,
} from '../../domain/registry/registry.types.js';
import { EDGE_P7_OUTBOX_TENANT } from '../../domain/provisioning/provisioning.events.js';

async function enqueue(
  outbox: ControlPlaneOutboxTransactionService,
  event: IntegrationEvent<unknown>,
): Promise<void> {
  await outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (_c, enq) => {
    await enq(event);
  });
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
): Promise<void> {
  try {
    await audit.create(input);
  } catch (err) {
    throw new DomainError(
      ErrorCode.DEPENDENCY_UNAVAILABLE,
      'Durable audit required for registry mutation',
      [{ eventType: input.eventType }],
      err instanceof Error ? err : undefined,
    );
  }
}

export class RegisterProductUseCase {
  constructor(
    private readonly repo: RegistryRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    productId: string;
    code: string;
    name: string;
    description?: string | null;
    verticalCategory?: string | null;
  }) {
    const existing = await this.repo.getProductRegistryByProductId(input.productId);
    if (existing) {
      throw new DomainError(ErrorCode.CONFLICT, 'Product already registered in P7.2 registry');
    }
    const record = await this.repo.createProductRegistry({
      productId: input.productId,
      code: input.code.trim(),
      name: input.name.trim(),
      description: input.description ?? null,
      verticalCategory: input.verticalCategory ?? null,
      registryStatus: RegistryLifecycleStatus.DRAFT,
      certificationStatus: CertificationStatus.UNCERTIFIED,
      technicalConstraints: {},
      declaredCapabilities: [],
      compatiblePlatformIds: [],
      compatibleEnvironmentIds: [],
      compatibleProfileIds: [],
      compatibleContractIds: [],
      metadata: {},
      createdBy: input.actorId,
      updatedBy: input.actorId,
    });
    const correlationId = randomUUID();
    await this.repo.appendHistory({
      resourceType: RegistryResourceType.PRODUCT_REGISTRY,
      resourceId: record.id,
      fromStatus: null,
      toStatus: record.registryStatus,
      action: 'REGISTER',
      reason: null,
      actorId: input.actorId,
      details: { productId: input.productId },
    });
    await enqueue(
      this.outbox,
      createProductRegisteredEvent({
        actorId: input.actorId,
        correlationId,
        productRegistryId: record.id,
        productId: input.productId,
      }),
    );
    await requireAudit(this.audit, {
      eventType: 'registry.product.registered',
      actorId: input.actorId,
      subjectType: 'PRODUCT_REGISTRY',
      subjectId: record.id,
      details: { productId: input.productId, code: record.code },
    });
    return record;
  }
}

export class UpdateProductRegistryUseCase {
  constructor(
    private readonly repo: RegistryRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    id: string;
    expectedVersion: number;
    patch: Partial<
      Pick<
        ProductRegistryRecord,
        | 'name'
        | 'description'
        | 'verticalCategory'
        | 'technicalConstraints'
        | 'declaredCapabilities'
        | 'compatiblePlatformIds'
        | 'compatibleEnvironmentIds'
        | 'compatibleProfileIds'
        | 'compatibleContractIds'
        | 'metadata'
      >
    >;
  }) {
    const current = await this.repo.getProductRegistry(input.id);
    if (!current) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Product registry not found');
    if (
      current.registryStatus === RegistryLifecycleStatus.RETIRED ||
      current.registryStatus === RegistryLifecycleStatus.DEPRECATED
    ) {
      throw new DomainError(
        ErrorCode.INVALID_STATE_TRANSITION,
        'Cannot update deprecated/retired product registry',
      );
    }
    const updated = await this.repo.updateProductRegistry(
      input.id,
      { ...input.patch, updatedBy: input.actorId },
      input.expectedVersion,
    );
    await enqueue(
      this.outbox,
      createProductUpdatedEvent({
        actorId: input.actorId,
        correlationId: randomUUID(),
        productRegistryId: updated.id,
      }),
    );
    await requireAudit(this.audit, {
      eventType: 'registry.product.updated',
      actorId: input.actorId,
      subjectType: 'PRODUCT_REGISTRY',
      subjectId: updated.id,
      details: { version: updated.version },
    });
    return updated;
  }
}

export class TransitionProductRegistryUseCase {
  constructor(
    private readonly repo: RegistryRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    id: string;
    toStatus: RegistryLifecycleStatus;
    reason?: string;
  }) {
    const current = await this.repo.getProductRegistry(input.id);
    if (!current) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Product registry not found');
    assertProductRegistryTransition(current.registryStatus, input.toStatus, input.reason);

    let certificationStatus = current.certificationStatus;
    if (input.toStatus === RegistryLifecycleStatus.CERTIFIED) {
      certificationStatus = CertificationStatus.CERTIFIED;
    } else if (input.toStatus === RegistryLifecycleStatus.VALIDATING) {
      certificationStatus = CertificationStatus.PENDING;
    } else if (
      input.toStatus === RegistryLifecycleStatus.SUSPENDED ||
      input.toStatus === RegistryLifecycleStatus.RETIRED
    ) {
      certificationStatus =
        input.toStatus === RegistryLifecycleStatus.RETIRED
          ? CertificationStatus.REVOKED
          : current.certificationStatus;
    }

    const provisionable = isProvisionable(input.toStatus, certificationStatus);
    const updated = await this.repo.updateProductRegistry(
      input.id,
      {
        registryStatus: input.toStatus,
        certificationStatus,
        provisionable,
        updatedBy: input.actorId,
      },
      current.version,
    );
    await this.repo.appendHistory({
      resourceType: RegistryResourceType.PRODUCT_REGISTRY,
      resourceId: updated.id,
      fromStatus: current.registryStatus,
      toStatus: input.toStatus,
      action: 'TRANSITION',
      reason: input.reason ?? null,
      actorId: input.actorId,
      details: { provisionable },
    });

    const correlationId = randomUUID();
    if (input.toStatus === RegistryLifecycleStatus.CERTIFIED) {
      await enqueue(
        this.outbox,
        createProductCertifiedEvent({
          actorId: input.actorId,
          correlationId,
          productRegistryId: updated.id,
        }),
      );
    } else if (input.toStatus === RegistryLifecycleStatus.DEPRECATED) {
      await enqueue(
        this.outbox,
        createProductDeprecatedEvent({
          actorId: input.actorId,
          correlationId,
          productRegistryId: updated.id,
          reason: input.reason ?? '',
        }),
      );
    } else {
      await enqueue(
        this.outbox,
        createProductUpdatedEvent({
          actorId: input.actorId,
          correlationId,
          productRegistryId: updated.id,
        }),
      );
    }
    await requireAudit(this.audit, {
      eventType: 'registry.product.transitioned',
      actorId: input.actorId,
      subjectType: 'PRODUCT_REGISTRY',
      subjectId: updated.id,
      details: {
        from: current.registryStatus,
        to: input.toStatus,
        reason: input.reason ?? null,
        provisionable,
      },
    });
    return updated;
  }
}

export class CreateTechnicalVersionUseCase {
  constructor(
    private readonly repo: RegistryRepositoryPort,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    productRegistryId: string;
    technicalVersion: string;
    releaseChannel?: string;
    changeSummary?: string | null;
  }) {
    const product = await this.repo.getProductRegistry(input.productRegistryId);
    if (!product) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Product registry not found');
    const version = await this.repo.createTechnicalVersion({
      productRegistryId: input.productRegistryId,
      technicalVersion: input.technicalVersion.trim(),
      releaseChannel: input.releaseChannel ?? 'STABLE',
      versionStatus: TechnicalVersionStatus.DRAFT,
      compatibleContractVersions: [],
      compatibleProfileCodes: [],
      compatibleRuntimeTypes: [],
      schemaCompatibility: {},
      apiCompatibility: {},
      availableFrom: null,
      supportEndsAt: null,
      certificationMetadata: {},
      changeSummary: input.changeSummary ?? null,
      immutableAfterPublish: true,
      metadata: {},
      createdBy: input.actorId,
      updatedBy: input.actorId,
    });
    await this.repo.appendHistory({
      resourceType: RegistryResourceType.PRODUCT_TECHNICAL_VERSION,
      resourceId: version.id,
      fromStatus: null,
      toStatus: version.versionStatus,
      action: 'REGISTER',
      reason: null,
      actorId: input.actorId,
      details: { technicalVersion: version.technicalVersion },
    });
    await requireAudit(this.audit, {
      eventType: 'registry.technical_version.created',
      actorId: input.actorId,
      subjectType: 'PRODUCT_TECHNICAL_VERSION',
      subjectId: version.id,
      details: { productRegistryId: input.productRegistryId },
    });
    return version;
  }
}

export class TransitionTechnicalVersionUseCase {
  constructor(
    private readonly repo: RegistryRepositoryPort,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    id: string;
    toStatus: TechnicalVersionStatus;
  }) {
    const current = await this.repo.getTechnicalVersion(input.id);
    if (!current) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Technical version not found');
    assertTechnicalVersionTransition(current.versionStatus, input.toStatus);
    const updated = await this.repo.updateTechnicalVersion(input.id, {
      versionStatus: input.toStatus,
      updatedBy: input.actorId,
      availableFrom:
        input.toStatus === TechnicalVersionStatus.PUBLISHED ? new Date() : current.availableFrom,
    });
    await this.repo.appendHistory({
      resourceType: RegistryResourceType.PRODUCT_TECHNICAL_VERSION,
      resourceId: updated.id,
      fromStatus: current.versionStatus,
      toStatus: input.toStatus,
      action: 'TRANSITION',
      reason: null,
      actorId: input.actorId,
      details: {},
    });
    await requireAudit(this.audit, {
      eventType: 'registry.technical_version.transitioned',
      actorId: input.actorId,
      subjectType: 'PRODUCT_TECHNICAL_VERSION',
      subjectId: updated.id,
      details: { from: current.versionStatus, to: input.toStatus },
    });
    return updated;
  }
}

export class UpdateTechnicalVersionDraftUseCase {
  constructor(private readonly repo: RegistryRepositoryPort) {}

  async execute(input: {
    actorId: string;
    id: string;
    patch: Partial<ProductTechnicalVersion>;
  }) {
    const current = await this.repo.getTechnicalVersion(input.id);
    if (!current) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Technical version not found');
    assertMutableTechnicalVersion(current.versionStatus);
    return this.repo.updateTechnicalVersion(input.id, {
      ...input.patch,
      updatedBy: input.actorId,
    });
  }
}

export class RegisterPlatformUseCase {
  constructor(
    private readonly repo: RegistryRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    code: string;
    name: string;
    description?: string | null;
    platformType: PlatformType;
    businessBackendId?: string | null;
    allowedProductIds?: string[];
    supportedEnvironmentTypes?: string[];
    supportedProfileCodes?: string[];
    connectivityReference?: string | null;
    secureConfigRef?: string | null;
  }) {
    const platform = await this.repo.createPlatform({
      code: input.code.trim(),
      name: input.name.trim(),
      description: input.description ?? null,
      platformType: input.platformType,
      businessBackendId: input.businessBackendId ?? null,
      allowedProductIds: input.allowedProductIds ?? [],
      supportedEnvironmentTypes: input.supportedEnvironmentTypes ?? [],
      supportedProfileCodes: input.supportedProfileCodes ?? [],
      connectivityReference: input.connectivityReference ?? null,
      secureConfigRef: input.secureConfigRef ?? null,
      integrationProtocolVersion: null,
      controlContractVersion: null,
      certificationStatus: CertificationStatus.UNCERTIFIED,
      operationalStatus: PlatformOperationalStatus.DRAFT,
      declaredCapabilities: [],
      constraints: {},
      metadata: {},
      createdBy: input.actorId,
      updatedBy: input.actorId,
    });
    await this.repo.appendHistory({
      resourceType: RegistryResourceType.PRODUCT_PLATFORM,
      resourceId: platform.id,
      fromStatus: null,
      toStatus: platform.operationalStatus,
      action: 'REGISTER',
      reason: null,
      actorId: input.actorId,
      details: { code: platform.code },
    });
    await enqueue(
      this.outbox,
      createPlatformRegisteredEvent({
        actorId: input.actorId,
        correlationId: randomUUID(),
        platformId: platform.id,
        code: platform.code,
      }),
    );
    await requireAudit(this.audit, {
      eventType: 'registry.platform.registered',
      actorId: input.actorId,
      subjectType: 'PRODUCT_PLATFORM',
      subjectId: platform.id,
      details: { code: platform.code },
    });
    return platform;
  }
}

export class TransitionPlatformUseCase {
  constructor(
    private readonly repo: RegistryRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    id: string;
    toStatus: PlatformOperationalStatus;
    reason?: string;
  }) {
    const current = await this.repo.getPlatform(input.id);
    if (!current) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Platform not found');
    assertPlatformTransition(current.operationalStatus, input.toStatus, input.reason);

    if (
      input.toStatus === PlatformOperationalStatus.RETIRED ||
      input.toStatus === PlatformOperationalStatus.DEPRECATED
    ) {
      const deps = await this.repo.countActiveDependenciesOnPlatform(input.id);
      if (deps > 0 && !input.reason?.includes('FORCE_DEPENDENCY_REVIEW')) {
        throw new DomainError(
          ErrorCode.CONFLICT,
          'Platform has active environments/contracts; complete dependency review first',
          [{ dependencyCount: deps }],
        );
      }
    }

    let certificationStatus = current.certificationStatus;
    if (input.toStatus === PlatformOperationalStatus.ACTIVE) {
      certificationStatus = CertificationStatus.CERTIFIED;
    } else if (input.toStatus === PlatformOperationalStatus.VALIDATING) {
      certificationStatus = CertificationStatus.PENDING;
    }

    const updated = await this.repo.updatePlatform(
      input.id,
      {
        operationalStatus: input.toStatus,
        certificationStatus,
        updatedBy: input.actorId,
      },
      current.version,
    );
    await this.repo.appendHistory({
      resourceType: RegistryResourceType.PRODUCT_PLATFORM,
      resourceId: updated.id,
      fromStatus: current.operationalStatus,
      toStatus: input.toStatus,
      action: 'TRANSITION',
      reason: input.reason ?? null,
      actorId: input.actorId,
      details: {},
    });
    await enqueue(
      this.outbox,
      createPlatformRegisteredEvent({
        actorId: input.actorId,
        correlationId: randomUUID(),
        platformId: updated.id,
        code: updated.code,
      }),
    );
    await requireAudit(this.audit, {
      eventType: 'registry.platform.transitioned',
      actorId: input.actorId,
      subjectType: 'PRODUCT_PLATFORM',
      subjectId: updated.id,
      details: { from: current.operationalStatus, to: input.toStatus },
    });
    return updated;
  }
}

export class UpdatePlatformUseCase {
  constructor(
    private readonly repo: RegistryRepositoryPort,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    id: string;
    expectedVersion: number;
    patch: Partial<ProductPlatform>;
  }) {
    const current = await this.repo.getPlatform(input.id);
    if (!current) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Platform not found');
    const updated = await this.repo.updatePlatform(
      input.id,
      { ...input.patch, updatedBy: input.actorId },
      input.expectedVersion,
    );
    await requireAudit(this.audit, {
      eventType: 'registry.platform.updated',
      actorId: input.actorId,
      subjectType: 'PRODUCT_PLATFORM',
      subjectId: updated.id,
      details: { version: updated.version },
    });
    return updated;
  }
}

export class RegisterEnvironmentUseCase {
  constructor(
    private readonly repo: RegistryRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    platformId: string;
    code: string;
    name: string;
    environmentType: RuntimeEnvironmentType;
    region?: string | null;
    geoZone?: string | null;
    securityClassification?: string | null;
    dataClassification?: string | null;
    allowedProfileCodes?: string[];
    dataResidencyConstraints?: Record<string, unknown>;
  }) {
    const platform = await this.repo.getPlatform(input.platformId);
    if (!platform) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Platform not found');
    const env = await this.repo.createEnvironment({
      platformId: input.platformId,
      code: input.code.trim(),
      name: input.name.trim(),
      environmentType: input.environmentType,
      region: input.region ?? null,
      geoZone: input.geoZone ?? null,
      securityClassification: input.securityClassification ?? null,
      dataClassification: input.dataClassification ?? null,
      availableCapabilities: [],
      dataResidencyConstraints: input.dataResidencyConstraints ?? {},
      backupPolicy: {},
      availabilityPolicy: {},
      allowedProfileCodes: input.allowedProfileCodes ?? [],
      environmentStatus: EnvironmentStatus.DRAFT,
      governanceMetadata: {},
      metadata: {},
      createdBy: input.actorId,
      updatedBy: input.actorId,
    });
    await this.repo.appendHistory({
      resourceType: RegistryResourceType.RUNTIME_ENVIRONMENT,
      resourceId: env.id,
      fromStatus: null,
      toStatus: env.environmentStatus,
      action: 'REGISTER',
      reason: null,
      actorId: input.actorId,
      details: { platformId: input.platformId },
    });
    await enqueue(
      this.outbox,
      createEnvironmentRegisteredEvent({
        actorId: input.actorId,
        correlationId: randomUUID(),
        environmentId: env.id,
        platformId: input.platformId,
      }),
    );
    await requireAudit(this.audit, {
      eventType: 'registry.environment.registered',
      actorId: input.actorId,
      subjectType: 'RUNTIME_ENVIRONMENT',
      subjectId: env.id,
      details: { code: env.code },
    });
    return env;
  }
}

export class TransitionEnvironmentUseCase {
  constructor(
    private readonly repo: RegistryRepositoryPort,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    id: string;
    toStatus: EnvironmentStatus;
    reason?: string;
  }) {
    const current = await this.repo.getEnvironment(input.id);
    if (!current) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Environment not found');
    assertEnvironmentTransition(current.environmentStatus, input.toStatus, input.reason);
    const updated = await this.repo.updateEnvironment(
      input.id,
      { environmentStatus: input.toStatus, updatedBy: input.actorId },
      current.version,
    );
    await this.repo.appendHistory({
      resourceType: RegistryResourceType.RUNTIME_ENVIRONMENT,
      resourceId: updated.id,
      fromStatus: current.environmentStatus,
      toStatus: input.toStatus,
      action: 'TRANSITION',
      reason: input.reason ?? null,
      actorId: input.actorId,
      details: {},
    });
    await requireAudit(this.audit, {
      eventType: 'registry.environment.transitioned',
      actorId: input.actorId,
      subjectType: 'RUNTIME_ENVIRONMENT',
      subjectId: updated.id,
      details: { from: current.environmentStatus, to: input.toStatus },
    });
    return updated;
  }
}

export class UpdateEnvironmentUseCase {
  constructor(private readonly repo: RegistryRepositoryPort) {}

  async execute(input: {
    actorId: string;
    id: string;
    expectedVersion: number;
    patch: Partial<RuntimeEnvironment>;
  }) {
    return this.repo.updateEnvironment(
      input.id,
      { ...input.patch, updatedBy: input.actorId },
      input.expectedVersion,
    );
  }
}

export class UpdateDeploymentProfileUseCase {
  constructor(
    private readonly repo: RegistryRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    id: string;
    patch: Partial<DeploymentProfile>;
  }) {
    const current = await this.repo.getProfile(input.id);
    if (!current) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Profile not found');
    const updated = await this.repo.updateProfile(input.id, {
      ...input.patch,
      updatedBy: input.actorId,
    });
    await enqueue(
      this.outbox,
      createDeploymentProfileUpdatedEvent({
        actorId: input.actorId,
        correlationId: randomUUID(),
        profileId: updated.id,
        code: String(updated.code),
      }),
    );
    await requireAudit(this.audit, {
      eventType: 'registry.deployment_profile.updated',
      actorId: input.actorId,
      subjectType: 'DEPLOYMENT_PROFILE',
      subjectId: updated.id,
      details: { code: updated.code },
    });
    return updated;
  }
}

export class TransitionDeploymentProfileUseCase {
  constructor(
    private readonly repo: RegistryRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    id: string;
    toStatus: ProfileStatus;
    reason?: string;
  }) {
    const current = await this.repo.getProfile(input.id);
    if (!current) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Profile not found');
    assertProfileTransition(current.profileStatus, input.toStatus, input.reason);
    const certificationStatus =
      input.toStatus === ProfileStatus.ACTIVE
        ? CertificationStatus.CERTIFIED
        : current.certificationStatus;
    const updated = await this.repo.updateProfile(input.id, {
      profileStatus: input.toStatus,
      certificationStatus,
      updatedBy: input.actorId,
    });
    await this.repo.appendHistory({
      resourceType: RegistryResourceType.DEPLOYMENT_PROFILE,
      resourceId: updated.id,
      fromStatus: current.profileStatus,
      toStatus: input.toStatus,
      action: 'TRANSITION',
      reason: input.reason ?? null,
      actorId: input.actorId,
      details: {},
    });
    await enqueue(
      this.outbox,
      createDeploymentProfileUpdatedEvent({
        actorId: input.actorId,
        correlationId: randomUUID(),
        profileId: updated.id,
        code: String(updated.code),
      }),
    );
    await requireAudit(this.audit, {
      eventType: 'registry.deployment_profile.transitioned',
      actorId: input.actorId,
      subjectType: 'DEPLOYMENT_PROFILE',
      subjectId: updated.id,
      details: { from: current.profileStatus, to: input.toStatus },
    });
    return updated;
  }
}

export class CreateControlContractUseCase {
  constructor(
    private readonly repo: RegistryRepositoryPort,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    productId: string;
    platformId: string;
    contractCode: string;
    contractVersion: string;
    schemaVersion: string;
    connectivityModel: string;
    supportedCapabilities?: unknown[];
    supportedControlOperations?: unknown[];
    s2sAuthPolicy?: Record<string, unknown>;
  }) {
    const platform = await this.repo.getPlatform(input.platformId);
    if (!platform) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Platform not found');
    const contract = await this.repo.createContract({
      productId: input.productId,
      platformId: input.platformId,
      contractCode: input.contractCode.trim(),
      contractVersion: input.contractVersion.trim(),
      schemaVersion: input.schemaVersion.trim(),
      supportedCapabilities: input.supportedCapabilities ?? [],
      supportedControlOperations: input.supportedControlOperations ?? [],
      connectivityModel: input.connectivityModel,
      s2sAuthPolicy: input.s2sAuthPolicy ?? {},
      signatureRequirements: {},
      publishedEvents: [],
      consumedEvents: [],
      backwardCompatible: true,
      forwardCompatible: false,
      versioningPolicy: {},
      effectiveFrom: null,
      deprecatedAt: null,
      contractStatus: ControlContractStatus.DRAFT,
      certificationEvidence: {},
      immutable: false,
      metadata: {},
      createdBy: input.actorId,
      updatedBy: input.actorId,
    });
    await this.repo.appendHistory({
      resourceType: RegistryResourceType.PRODUCT_CONTROL_CONTRACT,
      resourceId: contract.id,
      fromStatus: null,
      toStatus: contract.contractStatus,
      action: 'REGISTER',
      reason: null,
      actorId: input.actorId,
      details: { contractVersion: contract.contractVersion },
    });
    await requireAudit(this.audit, {
      eventType: 'registry.control_contract.created',
      actorId: input.actorId,
      subjectType: 'PRODUCT_CONTROL_CONTRACT',
      subjectId: contract.id,
      details: { contractCode: contract.contractCode },
    });
    return contract;
  }
}

export class TransitionControlContractUseCase {
  constructor(
    private readonly repo: RegistryRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    id: string;
    toStatus: ControlContractStatus;
    reason?: string;
  }) {
    const current = await this.repo.getContract(input.id);
    if (!current) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Control contract not found');
    assertContractTransition(current.contractStatus, input.toStatus, input.reason);
    const immutable =
      input.toStatus === ControlContractStatus.PUBLISHED ||
      input.toStatus === ControlContractStatus.DEPRECATED ||
      input.toStatus === ControlContractStatus.RETIRED;
    const updated = await this.repo.updateContract(input.id, {
      contractStatus: input.toStatus,
      immutable,
      effectiveFrom:
        input.toStatus === ControlContractStatus.PUBLISHED ? new Date() : current.effectiveFrom,
      deprecatedAt:
        input.toStatus === ControlContractStatus.DEPRECATED ? new Date() : current.deprecatedAt,
      updatedBy: input.actorId,
    });
    await this.repo.appendHistory({
      resourceType: RegistryResourceType.PRODUCT_CONTROL_CONTRACT,
      resourceId: updated.id,
      fromStatus: current.contractStatus,
      toStatus: input.toStatus,
      action: 'TRANSITION',
      reason: input.reason ?? null,
      actorId: input.actorId,
      details: { immutable },
    });
    if (input.toStatus === ControlContractStatus.PUBLISHED) {
      await enqueue(
        this.outbox,
        createControlContractPublishedEvent({
          actorId: input.actorId,
          correlationId: randomUUID(),
          contractId: updated.id,
          contractVersion: updated.contractVersion,
        }),
      );
    }
    await requireAudit(this.audit, {
      eventType: 'registry.control_contract.transitioned',
      actorId: input.actorId,
      subjectType: 'PRODUCT_CONTROL_CONTRACT',
      subjectId: updated.id,
      details: { from: current.contractStatus, to: input.toStatus },
    });
    return updated;
  }
}

export class UpdateControlContractDraftUseCase {
  constructor(private readonly repo: RegistryRepositoryPort) {}

  async execute(input: {
    actorId: string;
    id: string;
    patch: Partial<ProductControlContract>;
  }) {
    const current = await this.repo.getContract(input.id);
    if (!current) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Control contract not found');
    assertMutableContract(current.immutable, current.contractStatus);
    return this.repo.updateContract(input.id, { ...input.patch, updatedBy: input.actorId });
  }
}

export class EvaluateCompatibilityUseCase {
  constructor(
    private readonly repo: RegistryRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    productRegistryId: string;
    technicalVersionId: string;
    platformId: string;
    environmentId: string;
    profileId: string;
    contractId: string;
    correlationId?: string;
  }) {
    const [product, version, platform, environment, profile, contract] = await Promise.all([
      this.repo.getProductRegistry(input.productRegistryId),
      this.repo.getTechnicalVersion(input.technicalVersionId),
      this.repo.getPlatform(input.platformId),
      this.repo.getEnvironment(input.environmentId),
      this.repo.getProfile(input.profileId),
      this.repo.getContract(input.contractId),
    ]);
    if (!product || !version || !platform || !environment || !profile || !contract) {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        'All compatibility references must exist',
        [
          {
            product: Boolean(product),
            version: Boolean(version),
            platform: Boolean(platform),
            environment: Boolean(environment),
            profile: Boolean(profile),
            contract: Boolean(contract),
          },
        ],
      );
    }

    const evaluation = evaluateRegistryCompatibility({
      product,
      technicalVersion: version,
      platform,
      environment,
      profile,
      contract,
      evaluatedBy: input.actorId,
      correlationId: input.correlationId,
    });
    const saved = await this.repo.saveCompatibilityEvaluation(evaluation);
    await enqueue(
      this.outbox,
      createCompatibilityEvaluatedEvent({
        actorId: input.actorId,
        correlationId: saved.correlationId,
        evaluationId: saved.id,
        result: saved.result,
      }),
    );
    await requireAudit(this.audit, {
      eventType: 'registry.compatibility.evaluated',
      actorId: input.actorId,
      subjectType: 'COMPATIBILITY_EVALUATION',
      subjectId: saved.id,
      details: { result: saved.result, reasons: saved.reasons },
    });
    return saved;
  }
}

export class ListRegistryResourcesUseCase {
  constructor(private readonly repo: RegistryRepositoryPort) {}

  listProducts(filter: Parameters<RegistryRepositoryPort['listProductRegistries']>[0]) {
    return this.repo.listProductRegistries(filter);
  }
  getProduct(id: string) {
    return this.repo.getProductRegistry(id);
  }
  listVersions(productRegistryId: string, filter?: { limit?: number; offset?: number; status?: string }) {
    return this.repo.listTechnicalVersions(productRegistryId, filter);
  }
  getVersion(id: string) {
    return this.repo.getTechnicalVersion(id);
  }
  listPlatforms(filter: Parameters<RegistryRepositoryPort['listPlatforms']>[0]) {
    return this.repo.listPlatforms(filter);
  }
  getPlatform(id: string) {
    return this.repo.getPlatform(id);
  }
  listEnvironments(filter: Parameters<RegistryRepositoryPort['listEnvironments']>[0]) {
    return this.repo.listEnvironments(filter);
  }
  getEnvironment(id: string) {
    return this.repo.getEnvironment(id);
  }
  listProfiles(filter: Parameters<RegistryRepositoryPort['listProfiles']>[0]) {
    return this.repo.listProfiles(filter);
  }
  getProfile(id: string) {
    return this.repo.getProfile(id);
  }
  listContracts(filter: Parameters<RegistryRepositoryPort['listContracts']>[0]) {
    return this.repo.listContracts(filter);
  }
  getContract(id: string) {
    return this.repo.getContract(id);
  }
  listEvaluations(filter: Parameters<RegistryRepositoryPort['listCompatibilityEvaluations']>[0]) {
    return this.repo.listCompatibilityEvaluations(filter);
  }
  getEvaluation(id: string) {
    return this.repo.getCompatibilityEvaluation(id);
  }
  listHistory(filter: Parameters<RegistryRepositoryPort['listHistory']>[0]) {
    return this.repo.listHistory(filter);
  }
}
