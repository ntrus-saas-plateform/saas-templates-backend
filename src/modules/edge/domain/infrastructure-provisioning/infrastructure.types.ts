/** P7.6 Infrastructure & Database Provisioning — domain vocabulary. */

export enum InfrastructureProviderKind {
  LOCAL_MANAGED = 'LOCAL_MANAGED',
  PRIVATE_CLOUD = 'PRIVATE_CLOUD',
  PUBLIC_CLOUD = 'PUBLIC_CLOUD',
  KUBERNETES = 'KUBERNETES',
  ON_PREM = 'ON_PREM',
  DEDICATED = 'DEDICATED',
}

export enum ProviderOperationalStatus {
  ACTIVE = 'ACTIVE',
  DEGRADED = 'DEGRADED',
  UNAVAILABLE = 'UNAVAILABLE',
  RETIRED = 'RETIRED',
}

export enum DatabaseEngine {
  POSTGRESQL = 'POSTGRESQL',
  MONGODB = 'MONGODB',
  SURREALDB = 'SURREALDB',
}

export enum DatabaseTopology {
  DEDICATED_DATABASE = 'DEDICATED_DATABASE',
  DEDICATED_SCHEMA = 'DEDICATED_SCHEMA',
  DEDICATED_CLUSTER = 'DEDICATED_CLUSTER',
}

export enum ResourcePlanStatus {
  DRAFT = 'DRAFT',
  VALIDATING = 'VALIDATING',
  VALIDATED = 'VALIDATED',
  REJECTED = 'REJECTED',
  COMMITTED = 'COMMITTED',
  SUPERSEDED = 'SUPERSEDED',
  CANCELLED = 'CANCELLED',
}

export enum ResourceStatus {
  PLANNED = 'PLANNED',
  VALIDATING = 'VALIDATING',
  RESERVED = 'RESERVED',
  PROVISIONING = 'PROVISIONING',
  CONFIGURING = 'CONFIGURING',
  VERIFYING = 'VERIFYING',
  READY = 'READY',
  DEGRADED = 'DEGRADED',
  FAILED = 'FAILED',
  UNKNOWN = 'UNKNOWN',
  RECONCILIATION_REQUIRED = 'RECONCILIATION_REQUIRED',
  DEPROVISIONING = 'DEPROVISIONING',
  DEPROVISIONED = 'DEPROVISIONED',
  QUARANTINED = 'QUARANTINED',
}

export enum ResourceType {
  NETWORK = 'NETWORK',
  SUBNET = 'SUBNET',
  SECURITY_GROUP = 'SECURITY_GROUP',
  COMPUTE = 'COMPUTE',
  STORAGE = 'STORAGE',
  LOAD_BALANCER = 'LOAD_BALANCER',
  DNS = 'DNS',
  PRIVATE_ENDPOINT = 'PRIVATE_ENDPOINT',
  DATABASE = 'DATABASE',
  OTHER = 'OTHER',
}

export enum DriftStatus {
  NONE = 'NONE',
  DETECTED = 'DETECTED',
  REMEDIATING = 'REMEDIATING',
  RESOLVED = 'RESOLVED',
}

export enum BackupStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
  VERIFIED = 'VERIFIED',
  CORRUPT = 'CORRUPT',
  EXPIRED = 'EXPIRED',
}

export enum InfrastructureErrorCode {
  VALIDATION = 'VALIDATION',
  AUTHORIZATION_FAILED = 'AUTHORIZATION_FAILED',
  AUTHORIZATION_REVOKED = 'AUTHORIZATION_REVOKED',
  AUTHORIZATION_EXPIRED = 'AUTHORIZATION_EXPIRED',
  PLACEMENT_INVALID = 'PLACEMENT_INVALID',
  RESERVATION_INVALID = 'RESERVATION_INVALID',
  PROVIDER_UNAVAILABLE = 'PROVIDER_UNAVAILABLE',
  CAPABILITY_UNSUPPORTED = 'CAPABILITY_UNSUPPORTED',
  PLAN_INCOMPATIBLE = 'PLAN_INCOMPATIBLE',
  RESOURCE_NOT_READY = 'RESOURCE_NOT_READY',
  ISOLATION_VIOLATION = 'ISOLATION_VIOLATION',
  CONNECTIVITY_FAILED = 'CONNECTIVITY_FAILED',
  TLS_VALIDATION_FAILED = 'TLS_VALIDATION_FAILED',
  SECRET_UNAVAILABLE = 'SECRET_UNAVAILABLE',
  BACKUP_UNVERIFIED = 'BACKUP_UNVERIFIED',
  UNSAFE_COMPENSATION = 'UNSAFE_COMPENSATION',
  DEPROVISION_FORBIDDEN = 'DEPROVISION_FORBIDDEN',
  DRIFT_DETECTED = 'DRIFT_DETECTED',
  UNKNOWN_OUTCOME = 'UNKNOWN_OUTCOME',
  OPERATION_NOT_IMPLEMENTED = 'OPERATION_NOT_IMPLEMENTED',
  DEPENDENCY_UNAVAILABLE = 'DEPENDENCY_UNAVAILABLE',
  TIMEOUT = 'TIMEOUT',
}

/** Mandate P7.6 workflow handler keys — real implementations for supported ops. */
export const INFRASTRUCTURE_HANDLER_KEYS = [
  'infrastructure.validate_plan',
  'infrastructure.provision_network',
  'infrastructure.provision_compute',
  'infrastructure.provision_storage',
  'infrastructure.verify_resources',
  'database.provision',
  'database.configure_security',
  'database.create_credentials',
  'database.verify_connectivity',
  'database.verify_isolation',
  'database.configure_backup',
  'database.verify_backup_policy',
  'resource.reconcile',
  'resource.deprovision',
] as const;

export type InfrastructureHandlerKey = (typeof INFRASTRUCTURE_HANDLER_KEYS)[number];

/** Keys deferred / not executable without explicit destructive authorization path. */
export const INFRASTRUCTURE_RESTRICTED_HANDLER_KEYS = [
  'resource.deprovision',
] as const;

export const LOCAL_MANAGED_PROVIDER_CODE = 'local-managed-v1';

export type ProviderCapabilities = {
  encryption: boolean;
  backup: boolean;
  restore: boolean;
  highAvailability: boolean;
  privateNetworking: boolean;
  tlsRequired: boolean;
  operations: string[];
};

export type InfrastructureProviderRecord = {
  id: string;
  code: string;
  name: string;
  providerVersion: string;
  providerKind: InfrastructureProviderKind;
  operationalStatus: ProviderOperationalStatus;
  capabilities: ProviderCapabilities;
  supportedRegions: string[];
  supportedResourceTypes: string[];
  supportedDatabaseEngines: string[];
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

export type ResourcePlanRecord = {
  id: string;
  tenantId: string;
  productId: string;
  subscriptionId: string | null;
  authorizationId: string | null;
  authorizationVersion: number | null;
  placementDecisionId: string | null;
  reservationId: string | null;
  providerId: string;
  region: string;
  availabilityZone: string | null;
  deploymentProfileId: string | null;
  deploymentProfileVersion: number | null;
  runtimeProfileId: string | null;
  databaseEngine: DatabaseEngine;
  databaseTopology: DatabaseTopology;
  computeRequirements: Record<string, unknown>;
  storageRequirements: Record<string, unknown>;
  networkRequirements: Record<string, unknown>;
  backupPolicy: Record<string, unknown>;
  encryptionPolicy: Record<string, unknown>;
  retentionPolicy: Record<string, unknown>;
  estimatedCapacity: Record<string, unknown>;
  resourceDependencies: unknown[];
  securityClassification: string;
  planFingerprint: string;
  status: ResourcePlanStatus;
  currentVersion: number;
  workflowId: string | null;
  validationErrors: unknown[];
  metadata: Record<string, unknown>;
  version: number;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type InfrastructureResourceRecord = {
  id: string;
  planId: string;
  tenantId: string;
  productId: string;
  subscriptionId: string | null;
  providerId: string;
  resourceType: ResourceType;
  providerResourceId: string | null;
  environment: string;
  region: string;
  status: ResourceStatus;
  configuration: Record<string, unknown>;
  configurationFingerprint: string | null;
  ownership: Record<string, unknown>;
  deletionProtection: boolean;
  healthStatus: string;
  driftStatus: DriftStatus;
  workflowId: string | null;
  lastReconciledAt: Date | null;
  evidence: Record<string, unknown>;
  metadata: Record<string, unknown>;
  version: number;
  createdAt: Date;
  updatedAt: Date;
};

export type DatabaseResourceRecord = {
  id: string;
  resourceId: string;
  planId: string;
  tenantId: string;
  productId: string;
  subscriptionId: string | null;
  databaseEngine: DatabaseEngine;
  engineVersion: string | null;
  providerId: string;
  clusterId: string | null;
  databaseName: string;
  endpointRef: string | null;
  credentialRef: string | null;
  networkPolicy: Record<string, unknown>;
  encryptionPolicy: Record<string, unknown>;
  backupPolicy: Record<string, unknown>;
  restorePolicy: Record<string, unknown>;
  isolationVerified: boolean;
  connectivityVerified: boolean;
  leastPrivilegeVerified: boolean;
  tlsRequired: boolean;
  publicEndpoint: boolean;
  status: ResourceStatus;
  configurationFingerprint: string | null;
  workflowId: string | null;
  evidence: Record<string, unknown>;
  metadata: Record<string, unknown>;
  version: number;
  createdAt: Date;
  updatedAt: Date;
};

export type ResourceBackupRecord = {
  id: string;
  resourceId: string;
  databaseResourceId: string | null;
  providerBackupId: string | null;
  backupType: string;
  status: BackupStatus;
  integrityVerified: boolean;
  restorableVerified: boolean;
  encrypted: boolean;
  sizeBytes: number | null;
  startedAt: Date;
  completedAt: Date | null;
  expiresAt: Date | null;
  evidence: Record<string, unknown>;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

export type ResourceHistoryRecord = {
  id: string;
  resourceType: string;
  resourceId: string;
  fromStatus: string | null;
  toStatus: string | null;
  action: string;
  reason: string | null;
  actorId: string;
  details: Record<string, unknown>;
  createdAt: Date;
};
