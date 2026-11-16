/** P7.8 — Configuration & Entitlement Deployment domain vocabulary. */

export enum ConfigurationSchemaStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  DEPRECATED = 'DEPRECATED',
  RETIRED = 'RETIRED',
}

export enum ConfigurationTemplateStatus {
  DRAFT = 'DRAFT',
  VALIDATED = 'VALIDATED',
  PUBLISHED = 'PUBLISHED',
  DEPRECATED = 'DEPRECATED',
  RETIRED = 'RETIRED',
}

export enum ConfigurationBundleStatus {
  DRAFT = 'DRAFT',
  VALIDATED = 'VALIDATED',
  PUBLISHED = 'PUBLISHED',
  DEPRECATED = 'DEPRECATED',
  RETIRED = 'RETIRED',
}

export enum VersionRecordStatus {
  DRAFT = 'DRAFT',
  VALIDATED = 'VALIDATED',
  PUBLISHED = 'PUBLISHED',
  SUPERSEDED = 'SUPERSEDED',
}

export enum AssignmentStatus {
  ASSIGNED = 'ASSIGNED',
  DEPLOYING = 'DEPLOYING',
  DEPLOYED = 'DEPLOYED',
  FAILED = 'FAILED',
  ROLLBACK_PENDING = 'ROLLBACK_PENDING',
  ROLLED_BACK = 'ROLLED_BACK',
  SUPERSEDED = 'SUPERSEDED',
}

export enum EntitlementDeploymentStatus {
  PENDING = 'PENDING',
  VALIDATING = 'VALIDATING',
  DEPLOYING = 'DEPLOYING',
  DEPLOYED = 'DEPLOYED',
  SUSPENDED = 'SUSPENDED',
  REVOKED = 'REVOKED',
  FAILED = 'FAILED',
  SUPERSEDED = 'SUPERSEDED',
}

export enum DeploymentStrategy {
  ATOMIC = 'ATOMIC',
  ROLLING = 'ROLLING',
  CANARY = 'CANARY',
  BLUE_GREEN = 'BLUE_GREEN',
  STAGED = 'STAGED',
}

export enum DeploymentOperation {
  DEPLOY = 'DEPLOY',
  ROLLBACK = 'ROLLBACK',
  RECONCILE = 'RECONCILE',
  SUSPEND_ENTITLEMENT = 'SUSPEND_ENTITLEMENT',
  REVOKE_ENTITLEMENT = 'REVOKE_ENTITLEMENT',
  VALIDATE = 'VALIDATE',
}

export enum DeploymentRunOutcome {
  PENDING = 'PENDING',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
  PARTIAL = 'PARTIAL',
  ROLLED_BACK = 'ROLLED_BACK',
  SKIPPED = 'SKIPPED',
}

export enum ConfigurationDriftStatus {
  NONE = 'NONE',
  DETECTED = 'DETECTED',
  REMEDIATING = 'REMEDIATING',
  RESOLVED = 'RESOLVED',
  UNKNOWN = 'UNKNOWN',
}

export enum ConfigurationErrorCode {
  VALIDATION = 'VALIDATION',
  AUTHORIZATION_FAILED = 'AUTHORIZATION_FAILED',
  SCHEMA_INVALID = 'SCHEMA_INVALID',
  CHECKSUM_MISMATCH = 'CHECKSUM_MISMATCH',
  ENTITLEMENT_EXPANSION = 'ENTITLEMENT_EXPANSION',
  ENTITLEMENT_REVOKED = 'ENTITLEMENT_REVOKED',
  BUNDLE_NOT_PUBLISHED = 'BUNDLE_NOT_PUBLISHED',
  DEPENDENCY_MISSING = 'DEPENDENCY_MISSING',
  SECRET_PLAINTEXT_FORBIDDEN = 'SECRET_PLAINTEXT_FORBIDDEN',
  ROLLBACK_FORBIDDEN = 'ROLLBACK_FORBIDDEN',
  DRIFT_DETECTED = 'DRIFT_DETECTED',
  PROVIDER_UNAVAILABLE = 'PROVIDER_UNAVAILABLE',
  IDEMPOTENT_REPLAY = 'IDEMPOTENT_REPLAY',
  CONFLICT = 'CONFLICT',
}

/** Distinguishes commercial entitlement from technical knobs. */
export type EntitlementKind =
  | 'COMMERCIAL_ENTITLEMENT'
  | 'TECHNICAL_CAPABILITY'
  | 'FEATURE_FLAG'
  | 'OPERATIONAL_CONFIGURATION'
  | 'CAPACITY_LIMIT'
  | 'USAGE_QUOTA';

export type ConfigurationSchemaRecord = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  productId: string | null;
  schemaVersion: number;
  jsonSchema: Record<string, unknown>;
  checksum: string;
  status: ConfigurationSchemaStatus | string;
  metadata: Record<string, unknown>;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
};

export type ConfigurationTemplateRecord = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  productId: string | null;
  schemaId: string;
  runtimeProfileCode: string | null;
  deploymentProfileCode: string | null;
  templateStatus: ConfigurationTemplateStatus | string;
  latestVersion: number;
  metadata: Record<string, unknown>;
  createdBy: string;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
};

export type ConfigurationTemplateVersionRecord = {
  id: string;
  templateId: string;
  versionNumber: number;
  payload: Record<string, unknown>;
  checksum: string;
  status: VersionRecordStatus | string;
  publishedAt: Date | null;
  createdBy: string;
  createdAt: Date;
};

export type ConfigurationBundleRecord = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  productId: string | null;
  bundleStatus: ConfigurationBundleStatus | string;
  latestVersion: number;
  metadata: Record<string, unknown>;
  createdBy: string;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
};

export type ConfigurationBundleVersionRecord = {
  id: string;
  bundleId: string;
  versionNumber: number;
  templateRefs: Array<{ templateId: string; versionNumber: number }>;
  dependencyRefs: string[];
  payload: Record<string, unknown>;
  checksum: string;
  status: VersionRecordStatus | string;
  rolloutPolicy: Record<string, unknown>;
  publishedAt: Date | null;
  createdBy: string;
  createdAt: Date;
};

export type TenantConfigurationAssignmentRecord = {
  id: string;
  tenantId: string;
  productId: string;
  subscriptionId: string | null;
  accountId: string | null;
  bundleId: string;
  bundleVersion: number;
  bundleChecksum: string;
  assignmentStatus: AssignmentStatus | string;
  desiredConfig: Record<string, unknown>;
  appliedConfig: Record<string, unknown>;
  appliedChecksum: string | null;
  entitlementSnapshotRef: string | null;
  entitlementVersion: string | null;
  authorizationRowId: string | null;
  authorizationVersion: number | null;
  provisioningRequestId: string | null;
  workflowId: string | null;
  deploymentStrategy: DeploymentStrategy | string;
  driftStatus: ConfigurationDriftStatus | string;
  lastDeployedAt: Date | null;
  lastReconciledAt: Date | null;
  metadata: Record<string, unknown>;
  createdBy: string;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
};

export type EntitlementDeploymentRecord = {
  id: string;
  assignmentId: string;
  tenantId: string;
  productId: string;
  subscriptionId: string | null;
  entitlementSnapshotRef: string;
  entitlementVersion: string;
  payloadDigest: string;
  capabilities: Record<string, unknown>;
  featureFlags: Record<string, unknown>;
  quotas: Record<string, unknown>;
  limits: Record<string, unknown>;
  deploymentStatus: EntitlementDeploymentStatus | string;
  source: string;
  workflowId: string | null;
  evidence: Record<string, unknown>;
  deployedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
};

export type ConfigurationDeploymentRunRecord = {
  id: string;
  assignmentId: string;
  tenantId: string;
  productId: string;
  operation: DeploymentOperation | string;
  strategy: string;
  workflowId: string | null;
  fromBundleVersion: number | null;
  toBundleVersion: number | null;
  outcome: DeploymentRunOutcome | string;
  errorCode: string | null;
  errorMessage: string | null;
  observedState: Record<string, unknown>;
  evidence: Record<string, unknown>;
  startedAt: Date;
  finishedAt: Date | null;
  performedBy: string | null;
  correlationId: string | null;
  createdAt: Date;
};

export type ConfigurationEvidenceRecord = {
  id: string;
  assignmentId: string | null;
  tenantId: string | null;
  workflowId: string | null;
  stepKey: string | null;
  operation: string;
  outcome: string;
  evidence: Record<string, unknown>;
  errorCode: string | null;
  errorMessage: string | null;
  durationMs: number | null;
  performedBy: string | null;
  createdAt: Date;
};

export const CONFIGURATION_HANDLER_KEYS = [
  'configuration.validate_bundle',
  'configuration.deploy_bundle',
  'configuration.verify_deployment',
  'configuration.apply_entitlements',
  'configuration.rollback_bundle',
  'configuration.reconcile_entitlements',
] as const;

export type ConfigurationHandlerKey = (typeof CONFIGURATION_HANDLER_KEYS)[number];
