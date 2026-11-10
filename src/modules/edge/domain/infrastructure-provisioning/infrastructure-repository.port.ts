import type {
  DatabaseResourceRecord,
  InfrastructureProviderRecord,
  InfrastructureResourceRecord,
  ResourceBackupRecord,
  ResourceHistoryRecord,
  ResourcePlanRecord,
  ResourcePlanStatus,
  ResourceStatus,
  ResourceType,
} from './infrastructure.types.js';

export const INFRASTRUCTURE_REPOSITORY_PORT = Symbol('INFRASTRUCTURE_REPOSITORY_PORT');

export type CreatePlanRow = Omit<
  ResourcePlanRecord,
  'id' | 'createdAt' | 'updatedAt' | 'version' | 'currentVersion' | 'status' | 'validationErrors' | 'workflowId'
> & {
  status?: ResourcePlanStatus;
};

export type CreateInfraResourceRow = {
  planId: string;
  tenantId: string;
  productId: string;
  subscriptionId?: string | null;
  providerId: string;
  resourceType: ResourceType;
  providerResourceId?: string | null;
  environment: string;
  region: string;
  status?: ResourceStatus;
  configuration?: Record<string, unknown>;
  configurationFingerprint?: string | null;
  ownership?: Record<string, unknown>;
  deletionProtection?: boolean;
  workflowId?: string | null;
  evidence?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

export type CreateDatabaseRow = {
  resourceId: string;
  planId: string;
  tenantId: string;
  productId: string;
  subscriptionId?: string | null;
  databaseEngine: string;
  engineVersion?: string | null;
  providerId: string;
  clusterId?: string | null;
  databaseName: string;
  endpointRef?: string | null;
  credentialRef?: string | null;
  networkPolicy?: Record<string, unknown>;
  encryptionPolicy?: Record<string, unknown>;
  backupPolicy?: Record<string, unknown>;
  restorePolicy?: Record<string, unknown>;
  tlsRequired?: boolean;
  status?: ResourceStatus;
  workflowId?: string | null;
  evidence?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

export interface InfrastructureRepositoryPort {
  listProviders(client?: unknown): Promise<InfrastructureProviderRecord[]>;
  getProviderById(id: string, client?: unknown): Promise<InfrastructureProviderRecord | null>;
  getProviderByCode(code: string, client?: unknown): Promise<InfrastructureProviderRecord | null>;

  createPlan(row: CreatePlanRow, actorId: string, client?: unknown): Promise<ResourcePlanRecord>;
  getPlan(id: string, client?: unknown): Promise<ResourcePlanRecord | null>;
  listPlans(
    filter: { tenantId?: string; productId?: string; status?: string; limit?: number; offset?: number },
    client?: unknown,
  ): Promise<{ items: ResourcePlanRecord[]; total: number }>;
  updatePlanStatus(
    id: string,
    status: ResourcePlanStatus,
    patch: Partial<Pick<ResourcePlanRecord, 'validationErrors' | 'workflowId' | 'updatedBy'>>,
    expectedVersion: number,
    client?: unknown,
  ): Promise<ResourcePlanRecord>;
  insertPlanVersion(
    planId: string,
    versionNumber: number,
    fingerprint: string,
    snapshot: Record<string, unknown>,
    validationStatus: 'PENDING' | 'VALID' | 'INVALID',
    actorId: string,
    client?: unknown,
  ): Promise<void>;

  createInfrastructureResource(row: CreateInfraResourceRow, client?: unknown): Promise<InfrastructureResourceRecord>;
  getInfrastructureResource(id: string, client?: unknown): Promise<InfrastructureResourceRecord | null>;
  listInfrastructureResources(
    filter: {
      tenantId?: string;
      productId?: string;
      planId?: string;
      resourceType?: string;
      status?: string;
      limit?: number;
      offset?: number;
    },
    client?: unknown,
  ): Promise<{ items: InfrastructureResourceRecord[]; total: number }>;
  updateInfrastructureResource(
    id: string,
    patch: Partial<
      Pick<
        InfrastructureResourceRecord,
        | 'status'
        | 'providerResourceId'
        | 'configuration'
        | 'configurationFingerprint'
        | 'healthStatus'
        | 'driftStatus'
        | 'evidence'
        | 'lastReconciledAt'
        | 'deletionProtection'
        | 'workflowId'
      >
    >,
    expectedVersion: number,
    client?: unknown,
  ): Promise<InfrastructureResourceRecord>;

  createNetworkResource(
    resourceId: string,
    data: {
      networkMode: string;
      cidrBlock?: string | null;
      denyByDefault: boolean;
      ingressRules?: unknown[];
      egressRules?: unknown[];
      publicEndpointAllowed: boolean;
    },
    client?: unknown,
  ): Promise<void>;

  createStorageResource(
    resourceId: string,
    data: { storageClass: string; sizeGb: number; encrypted: boolean },
    client?: unknown,
  ): Promise<void>;

  createDatabaseResource(row: CreateDatabaseRow, client?: unknown): Promise<DatabaseResourceRecord>;
  getDatabaseResource(id: string, client?: unknown): Promise<DatabaseResourceRecord | null>;
  getDatabaseByResourceId(resourceId: string, client?: unknown): Promise<DatabaseResourceRecord | null>;
  listDatabaseResources(
    filter: {
      tenantId?: string;
      productId?: string;
      engine?: string;
      status?: string;
      limit?: number;
      offset?: number;
    },
    client?: unknown,
  ): Promise<{ items: DatabaseResourceRecord[]; total: number }>;
  updateDatabaseResource(
    id: string,
    patch: Partial<
      Pick<
        DatabaseResourceRecord,
        | 'status'
        | 'endpointRef'
        | 'credentialRef'
        | 'engineVersion'
        | 'clusterId'
        | 'isolationVerified'
        | 'connectivityVerified'
        | 'leastPrivilegeVerified'
        | 'configurationFingerprint'
        | 'evidence'
        | 'backupPolicy'
        | 'networkPolicy'
        | 'encryptionPolicy'
        | 'workflowId'
      >
    >,
    expectedVersion: number,
    client?: unknown,
  ): Promise<DatabaseResourceRecord>;

  createCredentialBinding(
    row: {
      resourceId: string;
      databaseResourceId?: string | null;
      credentialRef: string;
      credentialKind: string;
      expiresAt?: Date | null;
      metadata?: Record<string, unknown>;
    },
    client?: unknown,
  ): Promise<void>;

  createBackup(
    row: {
      resourceId: string;
      databaseResourceId?: string | null;
      providerBackupId?: string | null;
      backupType?: string;
      status: string;
      integrityVerified?: boolean;
      restorableVerified?: boolean;
      encrypted?: boolean;
      sizeBytes?: number | null;
      evidence?: Record<string, unknown>;
    },
    client?: unknown,
  ): Promise<ResourceBackupRecord>;
  listBackups(resourceId: string, client?: unknown): Promise<ResourceBackupRecord[]>;
  updateBackup(
    id: string,
    patch: Partial<Pick<ResourceBackupRecord, 'status' | 'integrityVerified' | 'restorableVerified' | 'evidence' | 'completedAt'>>,
    client?: unknown,
  ): Promise<ResourceBackupRecord>;

  createReconciliation(
    row: {
      resourceId: string;
      status: string;
      driftClassification?: string | null;
      expectedSnapshot?: Record<string, unknown>;
      observedSnapshot?: Record<string, unknown>;
      remediationAction?: string | null;
      actorId?: string | null;
      details?: Record<string, unknown>;
    },
    client?: unknown,
  ): Promise<{ id: string }>;

  createHealthCheck(
    row: {
      resourceId: string;
      checkType: string;
      result: string;
      details?: Record<string, unknown>;
    },
    client?: unknown,
  ): Promise<void>;

  appendHistory(
    row: Omit<ResourceHistoryRecord, 'id' | 'createdAt'>,
    client?: unknown,
  ): Promise<void>;

  listHistory(
    resourceType: string,
    resourceId: string,
    limit?: number,
    client?: unknown,
  ): Promise<ResourceHistoryRecord[]>;

  countActiveDependencies(resourceId: string, client?: unknown): Promise<number>;
  createDependency(resourceId: string, dependsOnResourceId: string, dependencyType: string, client?: unknown): Promise<void>;

  createAllocation(
    row: {
      providerId: string;
      planId: string;
      reservationId?: string | null;
      allocationRef: string;
      status: string;
      capacitySnapshot?: Record<string, unknown>;
    },
    client?: unknown,
  ): Promise<void>;
}
