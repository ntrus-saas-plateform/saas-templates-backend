import { randomUUID } from 'node:crypto';
import type { IntegrationEvent } from '../../../../core/domain/events/integration-event.js';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import type { ControlPlaneOutboxTransactionService } from '../../../../shared/messaging/control-plane-outbox-transaction.service.js';
import type { AuditEventRepositoryPort } from '../../domain/ports/audit-event-repository.port.js';
import { EDGE_P7_OUTBOX_TENANT } from '../../domain/provisioning/provisioning.events.js';
import { assessCompensationSafety } from '../../domain/infrastructure-provisioning/compensation-safety.js';
import type { DatabaseEngineAdapterRegistryPort } from '../../domain/infrastructure-provisioning/database-engine.port.js';
import type { InfrastructureProviderRegistryPort } from '../../domain/infrastructure-provisioning/database-provider.port.js';
import {
  createDatabaseResourceReadyEvent,
  createInfrastructureResourceProvisionedEvent,
  createResourceCompensationSuspendedEvent,
  createResourcePlanCreatedEvent,
  createResourcePlanValidatedEvent,
  createResourceReconciliationRequiredEvent,
} from '../../domain/infrastructure-provisioning/infrastructure.events.js';
import type { InfrastructureRepositoryPort } from '../../domain/infrastructure-provisioning/infrastructure-repository.port.js';
import {
  DatabaseEngine,
  DatabaseTopology,
  DriftStatus,
  InfrastructureErrorCode,
  LOCAL_MANAGED_PROVIDER_CODE,
  ResourcePlanStatus,
  ResourceStatus,
  ResourceType,
  type ResourcePlanRecord,
} from '../../domain/infrastructure-provisioning/infrastructure.types.js';
import { matchProviderCapabilities } from '../../domain/infrastructure-provisioning/provider-capability.js';
import {
  computePlanFingerprint,
  validateResourcePlan,
  type PlanValidationContext,
  type ResourcePlanInput,
} from '../../domain/infrastructure-provisioning/resource-plan.js';
import {
  assertReadyRequiresVerification,
  assertResourceTransition,
} from '../../domain/infrastructure-provisioning/resource-state-machine.js';
import type { SecretsProviderPort } from '../../domain/infrastructure-provisioning/secrets-provider.port.js';
import { generateDbPassword } from '../../infrastructure/infrastructure-provisioning/postgresql-database.adapter.js';

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
      'Durable audit required for infrastructure mutation',
      [{ eventType: input.eventType }],
      err instanceof Error ? err : undefined,
    );
  }
}

function enqueue(
  enqueueFn: (event: IntegrationEvent<unknown>) => Promise<string>,
  event: IntegrationEvent<Record<string, unknown>>,
): Promise<string> {
  return enqueueFn(event as IntegrationEvent<unknown>);
}

export class ListInfrastructureResourcesUseCase {
  constructor(private readonly repo: InfrastructureRepositoryPort) {}

  listProviders() {
    return this.repo.listProviders();
  }
  getProvider(id: string) {
    return this.repo.getProviderById(id);
  }
  listPlans(filter: Parameters<InfrastructureRepositoryPort['listPlans']>[0]) {
    return this.repo.listPlans(filter);
  }
  getPlan(id: string) {
    return this.repo.getPlan(id);
  }
  listResources(filter: Parameters<InfrastructureRepositoryPort['listInfrastructureResources']>[0]) {
    return this.repo.listInfrastructureResources(filter);
  }
  getResource(id: string) {
    return this.repo.getInfrastructureResource(id);
  }
  listDatabases(filter: Parameters<InfrastructureRepositoryPort['listDatabaseResources']>[0]) {
    return this.repo.listDatabaseResources(filter);
  }
  getDatabase(id: string) {
    return this.repo.getDatabaseResource(id);
  }
  listBackups(resourceId: string) {
    return this.repo.listBackups(resourceId);
  }
  listHistory(resourceType: string, resourceId: string, limit?: number) {
    return this.repo.listHistory(resourceType, resourceId, limit);
  }
}

export class CreateResourcePlanUseCase {
  constructor(
    private readonly repo: InfrastructureRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: ResourcePlanInput & { actorId: string; correlationId: string }) {
    const provider = await this.repo.getProviderById(input.providerId);
    if (!provider) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Provider not found', [
        { code: InfrastructureErrorCode.PROVIDER_UNAVAILABLE },
      ]);
    }
    const fingerprint = computePlanFingerprint(input);
    return this.outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client, enqueueFn) => {
      const plan = await this.repo.createPlan(
        {
          tenantId: input.tenantId,
          productId: input.productId,
          subscriptionId: input.subscriptionId ?? null,
          authorizationId: input.authorizationId ?? null,
          authorizationVersion: input.authorizationVersion ?? null,
          placementDecisionId: input.placementDecisionId ?? null,
          reservationId: input.reservationId ?? null,
          providerId: input.providerId,
          region: input.region,
          availabilityZone: input.availabilityZone ?? null,
          deploymentProfileId: input.deploymentProfileId ?? null,
          deploymentProfileVersion: input.deploymentProfileVersion ?? null,
          runtimeProfileId: input.runtimeProfileId ?? null,
          databaseEngine: input.databaseEngine,
          databaseTopology: input.databaseTopology ?? DatabaseTopology.DEDICATED_DATABASE,
          computeRequirements: input.computeRequirements ?? {},
          storageRequirements: input.storageRequirements ?? {},
          networkRequirements: input.networkRequirements ?? {},
          backupPolicy: input.backupPolicy ?? { enabled: true, schedule: 'daily' },
          encryptionPolicy: input.encryptionPolicy ?? { tls: true },
          retentionPolicy: input.retentionPolicy ?? {},
          estimatedCapacity: input.estimatedCapacity ?? {},
          resourceDependencies: input.resourceDependencies ?? [],
          securityClassification: input.securityClassification ?? 'INTERNAL',
          planFingerprint: fingerprint,
          metadata: input.metadata ?? {},
          createdBy: input.actorId,
          updatedBy: input.actorId,
        },
        input.actorId,
        client,
      );
      await this.repo.insertPlanVersion(
        plan.id,
        1,
        fingerprint,
        { ...plan, id: plan.id },
        'PENDING',
        input.actorId,
        client,
      );
      await this.repo.appendHistory(
        {
          resourceType: 'PLAN',
          resourceId: plan.id,
          fromStatus: null,
          toStatus: plan.status,
          action: 'CREATE',
          reason: null,
          actorId: input.actorId,
          details: { fingerprint },
        },
        client,
      );
      await requireAudit(
        this.audit,
        {
          eventType: 'edge.p7.infrastructure.plan.created',
          actorId: input.actorId,
          subjectType: 'resource_plan',
          subjectId: plan.id,
          details: { tenantId: plan.tenantId, productId: plan.productId },
        },
        client,
      );
      await enqueue(
        enqueueFn,
        createResourcePlanCreatedEvent(
          plan.id,
          plan.tenantId,
          plan.productId,
          input.correlationId,
        ),
      );
      return plan;
    });
  }
}

export class ValidateResourcePlanUseCase {
  constructor(
    private readonly repo: InfrastructureRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    planId: string;
    actorId: string;
    correlationId: string;
    context: Partial<PlanValidationContext>;
  }) {
    const plan = await this.repo.getPlan(input.planId);
    if (!plan) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Plan not found', [
        { code: InfrastructureErrorCode.VALIDATION },
      ]);
    }
    const provider = await this.repo.getProviderById(plan.providerId);
    if (!provider) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Provider not found', [
        { code: InfrastructureErrorCode.PROVIDER_UNAVAILABLE },
      ]);
    }
    const ctx: PlanValidationContext = {
      authorizationValid: input.context.authorizationValid ?? false,
      authorizationExpired: input.context.authorizationExpired ?? false,
      authorizationRevoked: input.context.authorizationRevoked ?? false,
      placementValid: input.context.placementValid ?? false,
      reservationValid: input.context.reservationValid ?? false,
      reservationCommitted: input.context.reservationCommitted ?? false,
      providerActive: provider.operationalStatus === 'ACTIVE',
      providerCapabilities: provider.capabilities,
      providerRegions: provider.supportedRegions,
      providerEngines: provider.supportedDatabaseEngines,
      tlsRequiredByProfile: input.context.tlsRequiredByProfile ?? true,
      privateNetworkRequired: input.context.privateNetworkRequired ?? true,
    };
    const cap = matchProviderCapabilities({
      provider,
      requiredOperations: ['validate_plan', 'provision_database'],
      requiredRegion: plan.region,
      requiredEngine: plan.databaseEngine,
      requirePrivateNetworking: true,
      requireEncryption: true,
      requireBackup: true,
    });
    const result = validateResourcePlan(plan, ctx);
    if (!cap.matched) {
      result.valid = false;
      result.errors.push({
        code: cap.code ?? InfrastructureErrorCode.CAPABILITY_UNSUPPORTED,
        message: cap.message ?? 'Capability mismatch',
      });
    }
    return this.outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client, enqueueFn) => {
      const updated = await this.repo.updatePlanStatus(
        plan.id,
        result.valid ? ResourcePlanStatus.VALIDATED : ResourcePlanStatus.REJECTED,
        {
          validationErrors: result.errors,
          updatedBy: input.actorId,
        },
        plan.version,
        client,
      );
      await this.repo.insertPlanVersion(
        plan.id,
        plan.currentVersion + 1,
        plan.planFingerprint,
        { planId: plan.id, errors: result.errors },
        result.valid ? 'VALID' : 'INVALID',
        input.actorId,
        client,
      );
      await this.repo.appendHistory(
        {
          resourceType: 'PLAN',
          resourceId: plan.id,
          fromStatus: plan.status,
          toStatus: updated.status,
          action: 'VALIDATE',
          reason: result.valid ? 'ok' : 'validation_failed',
          actorId: input.actorId,
          details: { errors: result.errors },
        },
        client,
      );
      await requireAudit(
        this.audit,
        {
          eventType: 'edge.p7.infrastructure.plan.validated',
          actorId: input.actorId,
          subjectType: 'resource_plan',
          subjectId: plan.id,
          details: { valid: result.valid },
        },
        client,
      );
      await enqueue(
        enqueueFn,
        createResourcePlanValidatedEvent(plan.id, result.valid, input.correlationId),
      );
      return { plan: updated, validation: result };
    });
  }
}

type ProvisionDeps = {
  repo: InfrastructureRepositoryPort;
  providers: InfrastructureProviderRegistryPort;
  engines: DatabaseEngineAdapterRegistryPort;
  secrets: SecretsProviderPort;
  outbox: ControlPlaneOutboxTransactionService;
  audit: AuditEventRepositoryPort;
};

async function requireValidatedPlan(repo: InfrastructureRepositoryPort, planId: string) {
  const plan = await repo.getPlan(planId);
  if (!plan) {
    throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Plan not found', [
      { code: InfrastructureErrorCode.VALIDATION },
    ]);
  }
  if (
    plan.status !== ResourcePlanStatus.VALIDATED &&
    plan.status !== ResourcePlanStatus.COMMITTED
  ) {
    throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Plan must be VALIDATED before provisioning', [
      { code: InfrastructureErrorCode.PLAN_INCOMPATIBLE, status: plan.status },
    ]);
  }
  return plan;
}

export class ProvisionNetworkUseCase {
  constructor(private readonly deps: ProvisionDeps) {}

  async execute(input: { planId: string; actorId: string; correlationId: string }) {
    const plan = await requireValidatedPlan(this.deps.repo, input.planId);
    const adapter = await this.deps.providers.getById(plan.providerId);
    if (!adapter) {
      throw new DomainError(ErrorCode.DEPENDENCY_UNAVAILABLE, 'Provider adapter unavailable', [
        { code: InfrastructureErrorCode.PROVIDER_UNAVAILABLE },
      ]);
    }
    const provisioned = await adapter.provisionNetwork({
      tenantId: plan.tenantId,
      productId: plan.productId,
      region: plan.region,
      denyByDefault: true,
      publicEndpointAllowed: false,
    });
    return this.deps.outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client, enqueueFn) => {
      const resource = await this.deps.repo.createInfrastructureResource(
        {
          planId: plan.id,
          tenantId: plan.tenantId,
          productId: plan.productId,
          subscriptionId: plan.subscriptionId,
          providerId: plan.providerId,
          resourceType: ResourceType.NETWORK,
          providerResourceId: provisioned.providerResourceId,
          environment: plan.region,
          region: plan.region,
          status: ResourceStatus.READY,
          configuration: provisioned.configuration,
          configurationFingerprint: provisioned.fingerprint,
          evidence: provisioned.evidence,
          deletionProtection: true,
        },
        client,
      );
      await this.deps.repo.createNetworkResource(
        resource.id,
        {
          networkMode: 'PRIVATE',
          cidrBlock: String(provisioned.configuration.cidrBlock ?? ''),
          denyByDefault: true,
          publicEndpointAllowed: false,
        },
        client,
      );
      await this.deps.repo.appendHistory(
        {
          resourceType: 'NETWORK',
          resourceId: resource.id,
          fromStatus: null,
          toStatus: resource.status,
          action: 'PROVISION',
          reason: null,
          actorId: input.actorId,
          details: { providerResourceId: provisioned.providerResourceId },
        },
        client,
      );
      await requireAudit(
        this.deps.audit,
        {
          eventType: 'edge.p7.infrastructure.network.provisioned',
          actorId: input.actorId,
          subjectType: 'infrastructure_resource',
          subjectId: resource.id,
          details: { planId: plan.id },
        },
        client,
      );
      await enqueue(
        enqueueFn,
        createInfrastructureResourceProvisionedEvent(
          resource.id,
          ResourceType.NETWORK,
          plan.tenantId,
          input.correlationId,
        ),
      );
      return resource;
    });
  }
}

export class ProvisionStorageUseCase {
  constructor(private readonly deps: ProvisionDeps) {}

  async execute(input: { planId: string; actorId: string; correlationId: string; sizeGb?: number }) {
    const plan = await requireValidatedPlan(this.deps.repo, input.planId);
    const adapter = await this.deps.providers.getById(plan.providerId);
    if (!adapter) {
      throw new DomainError(ErrorCode.DEPENDENCY_UNAVAILABLE, 'Provider adapter unavailable', [
        { code: InfrastructureErrorCode.PROVIDER_UNAVAILABLE },
      ]);
    }
    const sizeGb =
      input.sizeGb ??
      Number((plan.storageRequirements as { sizeGb?: number }).sizeGb ?? 10);
    const provisioned = await adapter.provisionStorage({
      tenantId: plan.tenantId,
      productId: plan.productId,
      region: plan.region,
      sizeGb,
      encrypted: true,
    });
    return this.deps.outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client, enqueueFn) => {
      const resource = await this.deps.repo.createInfrastructureResource(
        {
          planId: plan.id,
          tenantId: plan.tenantId,
          productId: plan.productId,
          subscriptionId: plan.subscriptionId,
          providerId: plan.providerId,
          resourceType: ResourceType.STORAGE,
          providerResourceId: provisioned.providerResourceId,
          environment: plan.region,
          region: plan.region,
          status: ResourceStatus.READY,
          configuration: provisioned.configuration,
          configurationFingerprint: provisioned.fingerprint,
          evidence: provisioned.evidence,
        },
        client,
      );
      await this.deps.repo.createStorageResource(
        resource.id,
        { storageClass: 'STANDARD', sizeGb, encrypted: true },
        client,
      );
      await this.deps.repo.appendHistory(
        {
          resourceType: 'STORAGE',
          resourceId: resource.id,
          fromStatus: null,
          toStatus: resource.status,
          action: 'PROVISION',
          reason: null,
          actorId: input.actorId,
          details: {},
        },
        client,
      );
      await requireAudit(
        this.deps.audit,
        {
          eventType: 'edge.p7.infrastructure.storage.provisioned',
          actorId: input.actorId,
          subjectType: 'infrastructure_resource',
          subjectId: resource.id,
          details: { planId: plan.id },
        },
        client,
      );
      await enqueue(
        enqueueFn,
        createInfrastructureResourceProvisionedEvent(
          resource.id,
          ResourceType.STORAGE,
          plan.tenantId,
          input.correlationId,
        ),
      );
      return resource;
    });
  }
}

export class ProvisionComputeUseCase {
  constructor(private readonly deps: ProvisionDeps) {}

  async execute(input: { planId: string; actorId: string; correlationId: string }) {
    const plan = await requireValidatedPlan(this.deps.repo, input.planId);
    const adapter = await this.deps.providers.getById(plan.providerId);
    if (!adapter) {
      throw new DomainError(ErrorCode.DEPENDENCY_UNAVAILABLE, 'Provider adapter unavailable', [
        { code: InfrastructureErrorCode.PROVIDER_UNAVAILABLE },
      ]);
    }
    const provisioned = await adapter.provisionCompute({
      tenantId: plan.tenantId,
      productId: plan.productId,
      region: plan.region,
      requirements: plan.computeRequirements,
    });
    if (provisioned.skipped) {
      return { skipped: true as const, evidence: provisioned.evidence };
    }
    return this.deps.outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client, enqueueFn) => {
      const resource = await this.deps.repo.createInfrastructureResource(
        {
          planId: plan.id,
          tenantId: plan.tenantId,
          productId: plan.productId,
          subscriptionId: plan.subscriptionId,
          providerId: plan.providerId,
          resourceType: ResourceType.COMPUTE,
          providerResourceId: provisioned.providerResourceId,
          environment: plan.region,
          region: plan.region,
          status: ResourceStatus.READY,
          configuration: provisioned.configuration,
          configurationFingerprint: provisioned.fingerprint,
          evidence: provisioned.evidence,
        },
        client,
      );
      await requireAudit(
        this.deps.audit,
        {
          eventType: 'edge.p7.infrastructure.compute.provisioned',
          actorId: input.actorId,
          subjectType: 'infrastructure_resource',
          subjectId: resource.id,
          details: { planId: plan.id },
        },
        client,
      );
      await enqueue(
        enqueueFn,
        createInfrastructureResourceProvisionedEvent(
          resource.id,
          ResourceType.COMPUTE,
          plan.tenantId,
          input.correlationId,
        ),
      );
      return resource;
    });
  }
}

export class ProvisionDatabaseUseCase {
  constructor(private readonly deps: ProvisionDeps) {}

  async execute(input: { planId: string; actorId: string; correlationId: string }) {
    const plan = await requireValidatedPlan(this.deps.repo, input.planId);
    const adapter = await this.deps.providers.getById(plan.providerId);
    const engine = this.deps.engines.get(plan.databaseEngine);
    if (!adapter || !engine) {
      throw new DomainError(ErrorCode.DEPENDENCY_UNAVAILABLE, 'Database engine adapter unavailable', [
        { code: InfrastructureErrorCode.DEPENDENCY_UNAVAILABLE, engine: plan.databaseEngine },
      ]);
    }
    const adminRef = adapter.adminConnectionRefFor(plan.databaseEngine);
    const databaseName = `t_${plan.tenantId.replace(/-/g, '').slice(0, 12)}_${plan.databaseEngine.slice(0, 2).toLowerCase()}`;
    const created = await engine.createDatabase({
      tenantId: plan.tenantId,
      productId: plan.productId,
      databaseName,
      adminConnectionRef: adminRef,
      tlsRequired: true,
    });
    return this.deps.outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client, enqueueFn) => {
      const resource = await this.deps.repo.createInfrastructureResource(
        {
          planId: plan.id,
          tenantId: plan.tenantId,
          productId: plan.productId,
          subscriptionId: plan.subscriptionId,
          providerId: plan.providerId,
          resourceType: ResourceType.DATABASE,
          providerResourceId: created.clusterId,
          environment: plan.region,
          region: plan.region,
          status: ResourceStatus.PROVISIONING,
          configuration: { databaseName, endpointRef: created.endpointRef },
          evidence: created.evidence,
        },
        client,
      );
      const db = await this.deps.repo.createDatabaseResource(
        {
          resourceId: resource.id,
          planId: plan.id,
          tenantId: plan.tenantId,
          productId: plan.productId,
          subscriptionId: plan.subscriptionId,
          databaseEngine: plan.databaseEngine,
          engineVersion: created.engineVersion,
          providerId: plan.providerId,
          clusterId: created.clusterId,
          databaseName,
          endpointRef: created.endpointRef,
          networkPolicy: plan.networkRequirements,
          encryptionPolicy: plan.encryptionPolicy,
          backupPolicy: plan.backupPolicy,
          tlsRequired: true,
          status: ResourceStatus.PROVISIONING,
          evidence: created.evidence,
        },
        client,
      );
      await this.deps.repo.appendHistory(
        {
          resourceType: 'DATABASE',
          resourceId: db.id,
          fromStatus: null,
          toStatus: db.status,
          action: 'PROVISION',
          reason: null,
          actorId: input.actorId,
          details: { databaseName },
        },
        client,
      );
      await requireAudit(
        this.deps.audit,
        {
          eventType: 'edge.p7.database.provisioned',
          actorId: input.actorId,
          subjectType: 'database_resource',
          subjectId: db.id,
          details: { engine: plan.databaseEngine, databaseName },
        },
        client,
      );
      await enqueue(
        enqueueFn,
        createInfrastructureResourceProvisionedEvent(
          resource.id,
          ResourceType.DATABASE,
          plan.tenantId,
          input.correlationId,
        ),
      );
      return { resource, database: db };
    });
  }
}

export class CreateDatabaseCredentialsUseCase {
  constructor(private readonly deps: ProvisionDeps) {}

  async execute(input: { databaseResourceId: string; actorId: string; correlationId: string }) {
    const db = await this.deps.repo.getDatabaseResource(input.databaseResourceId);
    if (!db) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Database resource not found');
    }
    const plan = await this.deps.repo.getPlan(db.planId);
    if (!plan) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Plan not found');
    const adapter = await this.deps.providers.getById(db.providerId);
    const engine = this.deps.engines.get(db.databaseEngine);
    if (!adapter || !engine) {
      throw new DomainError(ErrorCode.DEPENDENCY_UNAVAILABLE, 'Engine unavailable');
    }
    const username = `app_${db.tenantId.replace(/-/g, '').slice(0, 10)}`;
    const password = generateDbPassword();
    const adminRef = adapter.adminConnectionRefFor(db.databaseEngine);
    const cred = await engine.createAppCredential({
      tenantId: db.tenantId,
      databaseName: db.databaseName,
      adminConnectionRef: adminRef,
      username,
      password,
      tlsRequired: db.tlsRequired,
    });
    const stored = await this.deps.secrets.put({
      kind: 'DATABASE_APP',
      material: {
        username,
        password,
        connectionUri: cred.endpointRef,
      },
    });
    return this.deps.outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client, enqueueFn) => {
      const updated = await this.deps.repo.updateDatabaseResource(
        db.id,
        {
          credentialRef: stored.credentialRef,
          endpointRef: cred.endpointRef,
          status: ResourceStatus.CONFIGURING,
          evidence: { ...(db.evidence ?? {}), credentials: cred.evidence },
        },
        db.version,
        client,
      );
      await this.deps.repo.createCredentialBinding(
        {
          resourceId: db.resourceId,
          databaseResourceId: db.id,
          credentialRef: stored.credentialRef,
          credentialKind: 'DATABASE_APP',
          metadata: { username },
        },
        client,
      );
      await requireAudit(
        this.deps.audit,
        {
          eventType: 'edge.p7.database.credentials.created',
          actorId: input.actorId,
          subjectType: 'database_resource',
          subjectId: db.id,
          details: { credentialRef: stored.credentialRef },
        },
        client,
      );
      await enqueueFn({
        eventId: randomUUID(),
        eventType: 'p7.database.credentials.created.v1',
        version: 1,
        occurredAt: new Date().toISOString(),
        tenantId: EDGE_P7_OUTBOX_TENANT,
        organizationId: null,
        correlationId: input.correlationId,
        causationId: null,
        traceId: null,
        actor: { type: 'service', id: input.actorId },
        source: 'okapi.edge.p7',
        aggregateType: 'database_resource',
        aggregateId: db.id,
        payload: { databaseResourceId: db.id, credentialRef: stored.credentialRef },
      });
      return {
        database: updated,
        credentialRef: stored.credentialRef,
        // password intentionally omitted
      };
    });
  }
}

export class ConfigureDatabaseSecurityUseCase {
  constructor(private readonly deps: ProvisionDeps) {}

  async execute(input: { databaseResourceId: string; actorId: string; correlationId: string }) {
    const db = await this.deps.repo.getDatabaseResource(input.databaseResourceId);
    if (!db) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Database not found');
    if (db.publicEndpoint) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Public database endpoint forbidden', [
        { code: InfrastructureErrorCode.VALIDATION },
      ]);
    }
    return this.deps.outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client, enqueueFn) => {
      const updated = await this.deps.repo.updateDatabaseResource(
        db.id,
        {
          status: ResourceStatus.CONFIGURING,
          encryptionPolicy: { ...db.encryptionPolicy, tls: true, atRest: true },
          networkPolicy: { ...db.networkPolicy, mode: 'PRIVATE', denyByDefault: true },
        },
        db.version,
        client,
      );
      await requireAudit(
        this.deps.audit,
        {
          eventType: 'edge.p7.database.security.configured',
          actorId: input.actorId,
          subjectType: 'database_resource',
          subjectId: db.id,
          details: { tls: true, privateNetwork: true },
        },
        client,
      );
      await enqueueFn({
        eventId: randomUUID(),
        eventType: 'p7.database.security.configured.v1',
        version: 1,
        occurredAt: new Date().toISOString(),
        tenantId: EDGE_P7_OUTBOX_TENANT,
        organizationId: null,
        correlationId: input.correlationId,
        causationId: null,
        traceId: null,
        actor: { type: 'service', id: input.actorId },
        source: 'okapi.edge.p7',
        aggregateType: 'database_resource',
        aggregateId: db.id,
        payload: { databaseResourceId: db.id },
      });
      return updated;
    });
  }
}

export class VerifyDatabaseConnectivityUseCase {
  constructor(private readonly deps: ProvisionDeps) {}

  async execute(input: { databaseResourceId: string; actorId: string; correlationId: string }) {
    const db = await this.deps.repo.getDatabaseResource(input.databaseResourceId);
    if (!db?.credentialRef || !db.endpointRef) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Database credentials/endpoint missing', [
        { code: InfrastructureErrorCode.CONNECTIVITY_FAILED },
      ]);
    }
    const engine = this.deps.engines.get(db.databaseEngine);
    if (!engine) throw new DomainError(ErrorCode.DEPENDENCY_UNAVAILABLE, 'Engine unavailable');
    const secret = await this.deps.secrets.get(db.credentialRef);
    const result = await engine.verifyConnectivity({
      endpointRef: db.endpointRef,
      username: secret.username!,
      password: secret.password!,
      databaseName: db.databaseName,
      tlsRequired: db.tlsRequired,
    });
    const lp = await engine.verifyLeastPrivilege({
      endpointRef: db.endpointRef,
      username: secret.username!,
      password: secret.password!,
      databaseName: db.databaseName,
    });
    return this.deps.outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client) => {
      const status = result.ok ? ResourceStatus.VERIFYING : ResourceStatus.FAILED;
      const updated = await this.deps.repo.updateDatabaseResource(
        db.id,
        {
          connectivityVerified: result.ok,
          leastPrivilegeVerified: lp.leastPrivilege,
          status,
          evidence: {
            ...db.evidence,
            connectivity: result.evidence,
            leastPrivilege: lp.evidence,
          },
        },
        db.version,
        client,
      );
      await this.deps.repo.createHealthCheck(
        {
          resourceId: db.resourceId,
          checkType: 'CONNECTIVITY',
          result: result.ok ? 'HEALTHY' : 'FAILED',
          details: result.evidence,
        },
        client,
      );
      await requireAudit(
        this.deps.audit,
        {
          eventType: 'edge.p7.database.connectivity.verified',
          actorId: input.actorId,
          subjectType: 'database_resource',
          subjectId: db.id,
          details: { ok: result.ok },
        },
        client,
      );
      return updated;
    });
  }
}

export class VerifyDatabaseIsolationUseCase {
  constructor(private readonly deps: ProvisionDeps) {}

  async execute(input: {
    databaseResourceId: string;
    actorId: string;
    correlationId: string;
    foreignDatabaseName?: string;
  }) {
    const db = await this.deps.repo.getDatabaseResource(input.databaseResourceId);
    if (!db?.credentialRef || !db.endpointRef) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Database credentials/endpoint missing');
    }
    const engine = this.deps.engines.get(db.databaseEngine);
    if (!engine) throw new DomainError(ErrorCode.DEPENDENCY_UNAVAILABLE, 'Engine unavailable');
    const secret = await this.deps.secrets.get(db.credentialRef);
    const foreign = input.foreignDatabaseName ?? `foreign_${randomUUID().slice(0, 8)}`;
    const result = await engine.verifyIsolation({
      endpointRef: db.endpointRef,
      username: secret.username!,
      password: secret.password!,
      ownDatabaseName: db.databaseName,
      foreignDatabaseName: foreign,
      tlsRequired: db.tlsRequired,
    });
    if (!result.isolated) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Tenant isolation violated', [
        { code: InfrastructureErrorCode.ISOLATION_VIOLATION, ...result.evidence },
      ]);
    }
    return this.deps.outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client, enqueueFn) => {
      assertReadyRequiresVerification({
        from: ResourceStatus.VERIFYING,
        to: ResourceStatus.READY,
        connectivityVerified: db.connectivityVerified,
        isolationVerified: true,
      });
      const updated = await this.deps.repo.updateDatabaseResource(
        db.id,
        {
          isolationVerified: true,
          status: ResourceStatus.READY,
          evidence: { ...db.evidence, isolation: result.evidence },
        },
        db.version,
        client,
      );
      await this.deps.repo.updateInfrastructureResource(
        db.resourceId,
        { status: ResourceStatus.READY, healthStatus: 'HEALTHY' },
        (await this.deps.repo.getInfrastructureResource(db.resourceId, client))!.version,
        client,
      );
      await this.deps.repo.createHealthCheck(
        {
          resourceId: db.resourceId,
          checkType: 'ISOLATION',
          result: 'HEALTHY',
          details: result.evidence,
        },
        client,
      );
      await requireAudit(
        this.deps.audit,
        {
          eventType: 'edge.p7.database.isolation.verified',
          actorId: input.actorId,
          subjectType: 'database_resource',
          subjectId: db.id,
          details: { isolated: true },
        },
        client,
      );
      await enqueue(
        enqueueFn,
        createDatabaseResourceReadyEvent(
          db.id,
          db.tenantId,
          db.databaseEngine,
          input.correlationId,
        ),
      );
      return updated;
    });
  }
}

export class ConfigureDatabaseBackupUseCase {
  constructor(private readonly deps: ProvisionDeps) {}

  async execute(input: { databaseResourceId: string; actorId: string; correlationId: string }) {
    const db = await this.deps.repo.getDatabaseResource(input.databaseResourceId);
    if (!db) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Database not found');
    const adapter = await this.deps.providers.getById(db.providerId);
    const engine = this.deps.engines.get(db.databaseEngine);
    if (!adapter || !engine) {
      throw new DomainError(ErrorCode.DEPENDENCY_UNAVAILABLE, 'Engine unavailable');
    }
    const backup = await engine.createBackup({
      adminConnectionRef: adapter.adminConnectionRefFor(db.databaseEngine),
      databaseName: db.databaseName,
      backupLabel: `init_${Date.now()}`,
    });
    if (!backup.integrityVerified || !backup.restorableVerified) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Backup not verified', [
        { code: InfrastructureErrorCode.BACKUP_UNVERIFIED },
      ]);
    }
    return this.deps.outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client) => {
      const record = await this.deps.repo.createBackup(
        {
          resourceId: db.resourceId,
          databaseResourceId: db.id,
          providerBackupId: backup.providerBackupId,
          status: 'VERIFIED',
          integrityVerified: true,
          restorableVerified: true,
          sizeBytes: backup.sizeBytes,
          evidence: backup.evidence,
        },
        client,
      );
      await this.deps.repo.updateDatabaseResource(
        db.id,
        { backupPolicy: { ...db.backupPolicy, lastBackupId: record.id, verified: true } },
        db.version,
        client,
      );
      await requireAudit(
        this.deps.audit,
        {
          eventType: 'edge.p7.database.backup.configured',
          actorId: input.actorId,
          subjectType: 'database_resource',
          subjectId: db.id,
          details: { backupId: record.id, verified: true },
        },
        client,
      );
      return record;
    });
  }
}

export class VerifyBackupPolicyUseCase {
  constructor(private readonly deps: ProvisionDeps) {}

  async execute(input: { databaseResourceId: string; actorId: string }) {
    const db = await this.deps.repo.getDatabaseResource(input.databaseResourceId);
    if (!db) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Database not found');
    const backups = await this.deps.repo.listBackups(db.resourceId);
    const verified = backups.some((b) => b.integrityVerified && b.restorableVerified);
    if (!verified) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'No verified backup found', [
        { code: InfrastructureErrorCode.BACKUP_UNVERIFIED },
      ]);
    }
    await this.deps.repo.createHealthCheck({
      resourceId: db.resourceId,
      checkType: 'BACKUP_POLICY',
      result: 'HEALTHY',
      details: { backupCount: backups.length },
    });
    return { ok: true, backupCount: backups.length };
  }
}

export class ReconcileResourceUseCase {
  constructor(private readonly deps: ProvisionDeps) {}

  async execute(input: { resourceId: string; actorId: string; correlationId: string }) {
    const resource = await this.deps.repo.getInfrastructureResource(input.resourceId);
    if (!resource) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Resource not found');
    const adapter = await this.deps.providers.getById(resource.providerId);
    if (!adapter || !resource.providerResourceId) {
      throw new DomainError(ErrorCode.DEPENDENCY_UNAVAILABLE, 'Cannot observe resource');
    }
    const observed = await adapter.observeResource(
      resource.providerResourceId,
      resource.resourceType,
    );
    const drifted =
      !observed.exists ||
      JSON.stringify(observed.configuration) !== JSON.stringify(resource.configuration);
    return this.deps.outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client, enqueueFn) => {
      const recon = await this.deps.repo.createReconciliation(
        {
          resourceId: resource.id,
          status: drifted ? 'DRIFT_DETECTED' : 'RECONCILED',
          driftClassification: drifted
            ? observed.exists
              ? 'CONFIGURATION_DIVERGED'
              : 'RESOURCE_MISSING'
            : null,
          expectedSnapshot: resource.configuration,
          observedSnapshot: observed.configuration,
          remediationAction: drifted ? 'MANUAL' : 'NONE',
          actorId: input.actorId,
        },
        client,
      );
      const updated = await this.deps.repo.updateInfrastructureResource(
        resource.id,
        {
          driftStatus: drifted ? DriftStatus.DETECTED : DriftStatus.NONE,
          status: drifted ? ResourceStatus.RECONCILIATION_REQUIRED : resource.status,
          lastReconciledAt: new Date(),
          healthStatus: observed.exists ? resource.healthStatus : 'UNAVAILABLE',
        },
        resource.version,
        client,
      );
      await requireAudit(
        this.deps.audit,
        {
          eventType: 'edge.p7.infrastructure.resource.reconciled',
          actorId: input.actorId,
          subjectType: 'infrastructure_resource',
          subjectId: resource.id,
          details: { drifted, reconciliationId: recon.id },
        },
        client,
      );
      if (drifted) {
        await enqueue(
          enqueueFn,
          createResourceReconciliationRequiredEvent(
            resource.id,
            observed.exists ? 'CONFIGURATION_DIVERGED' : 'RESOURCE_MISSING',
            input.correlationId,
          ),
        );
      }
      return { resource: updated, drifted, reconciliationId: recon.id };
    });
  }
}

export class DeprovisionResourceUseCase {
  constructor(private readonly deps: ProvisionDeps) {}

  async execute(input: {
    resourceId: string;
    actorId: string;
    correlationId: string;
    authorized: boolean;
    confirmed: boolean;
  }) {
    if (!input.authorized || !input.confirmed) {
      throw new DomainError(ErrorCode.FORBIDDEN, 'Destructive action requires authorization', [
        { code: InfrastructureErrorCode.DEPROVISION_FORBIDDEN },
      ]);
    }
    const resource = await this.deps.repo.getInfrastructureResource(input.resourceId);
    if (!resource) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Resource not found');
    const database = await this.deps.repo.getDatabaseByResourceId(resource.id);
    const depsCount = await this.deps.repo.countActiveDependencies(resource.id);
    const assessment = assessCompensationSafety({
      resource,
      database,
      referencedByActiveResources: depsCount > 0,
      unresolvedReconciliation: resource.driftStatus === DriftStatus.DETECTED,
      deprovisionAuthorized: input.authorized,
    });
    if (!assessment.safe) {
      return this.deps.outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client, enqueueFn) => {
        await this.deps.repo.appendHistory(
          {
            resourceType: 'INFRASTRUCTURE',
            resourceId: resource.id,
            fromStatus: resource.status,
            toStatus: resource.status,
            action: 'COMPENSATION_SUSPENDED',
            reason: assessment.reason,
            actorId: input.actorId,
            details: { code: assessment.code },
          },
          client,
        );
        await enqueue(
          enqueueFn,
          createResourceCompensationSuspendedEvent(
            resource.id,
            assessment.reason,
            input.correlationId,
          ),
        );
        return { suspended: true as const, assessment };
      });
    }
    const adapter = await this.deps.providers.getById(resource.providerId);
    if (adapter && resource.providerResourceId) {
      await adapter.deprovisionResource(resource.providerResourceId, resource.resourceType);
    }
    if (database) {
      const engine = this.deps.engines.get(database.databaseEngine);
      if (engine && adapter) {
        const secret = database.credentialRef
          ? await this.deps.secrets.get(database.credentialRef).catch(() => null)
          : null;
        await engine.deprovision({
          adminConnectionRef: adapter.adminConnectionRefFor(database.databaseEngine),
          databaseName: database.databaseName,
          username: secret?.username ?? `app_${database.tenantId.replace(/-/g, '').slice(0, 10)}`,
        });
        if (database.credentialRef) {
          await this.deps.secrets.revoke(database.credentialRef);
        }
      }
    }
    return this.deps.outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client) => {
      assertResourceTransition(resource.status, ResourceStatus.DEPROVISIONING);
      const updated = await this.deps.repo.updateInfrastructureResource(
        resource.id,
        { status: ResourceStatus.DEPROVISIONED, deletionProtection: false },
        resource.version,
        client,
      );
      if (database) {
        await this.deps.repo.updateDatabaseResource(
          database.id,
          { status: ResourceStatus.DEPROVISIONED },
          database.version,
          client,
        );
      }
      await requireAudit(
        this.deps.audit,
        {
          eventType: 'edge.p7.infrastructure.resource.deprovisioned',
          actorId: input.actorId,
          subjectType: 'infrastructure_resource',
          subjectId: resource.id,
          details: {},
        },
        client,
      );
      return { suspended: false as const, resource: updated };
    });
  }
}

export class RotateDatabaseCredentialsUseCase {
  constructor(private readonly deps: ProvisionDeps) {}

  async execute(input: { databaseResourceId: string; actorId: string; correlationId: string }) {
    const db = await this.deps.repo.getDatabaseResource(input.databaseResourceId);
    if (!db?.credentialRef) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'No credential to rotate');
    }
    const adapter = await this.deps.providers.getById(db.providerId);
    const engine = this.deps.engines.get(db.databaseEngine);
    if (!adapter || !engine) {
      throw new DomainError(ErrorCode.DEPENDENCY_UNAVAILABLE, 'Engine unavailable');
    }
    const previous = await this.deps.secrets.get(db.credentialRef);
    const password = generateDbPassword();
    const username = previous.username ?? `app_${db.tenantId.replace(/-/g, '').slice(0, 10)}`;
    await engine.rotateCredential({
      tenantId: db.tenantId,
      databaseName: db.databaseName,
      adminConnectionRef: adapter.adminConnectionRefFor(db.databaseEngine),
      username,
      password,
      tlsRequired: db.tlsRequired,
      previousUsername: username,
    });
    await this.deps.secrets.rotate(db.credentialRef, {
      username,
      password,
      connectionUri: db.endpointRef ?? undefined,
    });
    await this.deps.audit.create({
      eventType: 'edge.p7.database.credentials.rotated',
      actorId: input.actorId,
      subjectType: 'database_resource',
      subjectId: db.id,
      details: { credentialRef: db.credentialRef },
    });
    return { credentialRef: db.credentialRef };
  }
}

export class VerifyResourcesUseCase {
  constructor(private readonly deps: ProvisionDeps) {}

  async execute(input: { planId: string; actorId: string }) {
    const resources = await this.deps.repo.listInfrastructureResources({
      planId: input.planId,
      limit: 100,
    });
    const notReady = resources.items.filter(
      (r) => r.status !== ResourceStatus.READY && r.resourceType !== ResourceType.COMPUTE,
    );
    if (notReady.length > 0) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Not all resources are READY', [
        { code: InfrastructureErrorCode.RESOURCE_NOT_READY, count: notReady.length },
      ]);
    }
    return { ok: true, count: resources.items.length };
  }
}

export function buildProvisionDeps(args: ProvisionDeps): ProvisionDeps {
  return args;
}

export { LOCAL_MANAGED_PROVIDER_CODE, DatabaseEngine };
export type { ResourcePlanRecord };
