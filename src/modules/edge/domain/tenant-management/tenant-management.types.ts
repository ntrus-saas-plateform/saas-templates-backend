/** P8 — Advanced Tenant Management & Governance domain vocabulary. */

export enum TenantClassification {
  STANDARD = 'STANDARD',
  PROFESSIONAL = 'PROFESSIONAL',
  ENTERPRISE = 'ENTERPRISE',
  DEDICATED = 'DEDICATED',
  PRIVATE_CLOUD = 'PRIVATE_CLOUD',
  ON_PREMISES = 'ON_PREMISES',
  REGULATED = 'REGULATED',
  STRATEGIC = 'STRATEGIC',
  INTERNAL_TEST = 'INTERNAL_TEST',
}

export enum EnvironmentClassification {
  PRODUCTION = 'PRODUCTION',
  STAGING = 'STAGING',
  SANDBOX = 'SANDBOX',
  DEVELOPMENT = 'DEVELOPMENT',
  DR = 'DR',
  UNKNOWN = 'UNKNOWN',
}

export enum AdministrativeStatus {
  PENDING_REVIEW = 'PENDING_REVIEW',
  ACTIVE = 'ACTIVE',
  RESTRICTED = 'RESTRICTED',
  SUSPENDED = 'SUSPENDED',
  DEACTIVATION_REQUESTED = 'DEACTIVATION_REQUESTED',
  DEACTIVATED = 'DEACTIVATED',
  TERMINATION_REQUESTED = 'TERMINATION_REQUESTED',
  TERMINATED = 'TERMINATED',
  ARCHIVED = 'ARCHIVED',
}

export enum TechnicalStatus {
  NOT_PROVISIONED = 'NOT_PROVISIONED',
  PROVISIONING = 'PROVISIONING',
  PROVISIONED = 'PROVISIONED',
  CONFIGURING = 'CONFIGURING',
  DEPLOYING = 'DEPLOYING',
  READINESS_PENDING = 'READINESS_PENDING',
  READY = 'READY',
  ACTIVE = 'ACTIVE',
  DEGRADED = 'DEGRADED',
  UNAVAILABLE = 'UNAVAILABLE',
  RECOVERING = 'RECOVERING',
  MIGRATING = 'MIGRATING',
  DEPROVISIONING = 'DEPROVISIONING',
  FAILED = 'FAILED',
  UNKNOWN = 'UNKNOWN',
}

export enum GovernanceStatus {
  COMPLIANT = 'COMPLIANT',
  REVIEW_REQUIRED = 'REVIEW_REQUIRED',
  EXCEPTION_PENDING = 'EXCEPTION_PENDING',
  NON_COMPLIANT = 'NON_COMPLIANT',
  RESTRICTED = 'RESTRICTED',
  UNDER_INVESTIGATION = 'UNDER_INVESTIGATION',
}

export enum HealthStatus {
  HEALTHY = 'HEALTHY',
  DEGRADED = 'DEGRADED',
  CRITICAL = 'CRITICAL',
  UNAVAILABLE = 'UNAVAILABLE',
  UNKNOWN = 'UNKNOWN',
  STALE = 'STALE',
}

export enum RiskLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
  UNKNOWN = 'UNKNOWN',
}

export enum LifecycleRequestType {
  SUSPEND = 'SUSPEND',
  RESUME = 'RESUME',
  RESTRICT = 'RESTRICT',
  UNRESTRICT = 'UNRESTRICT',
  DEACTIVATE = 'DEACTIVATE',
  REACTIVATE = 'REACTIVATE',
  MIGRATE = 'MIGRATE',
  RECOVER = 'RECOVER',
  TERMINATE = 'TERMINATE',
  ARCHIVE = 'ARCHIVE',
}

export enum LegalHoldChangeAction {
  RAISE = 'RAISE',
  LIFT = 'LIFT',
}

export enum GovernanceRequestStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  WAITING_APPROVAL = 'WAITING_APPROVAL',
}

export enum ExceptionType {
  PROVISIONING = 'PROVISIONING',
  RESOURCE = 'RESOURCE',
  REGION = 'REGION',
  POLICY = 'POLICY',
  COMPLIANCE = 'COMPLIANCE',
  CAPACITY = 'CAPACITY',
  TEMPORARY_RESTRICTION = 'TEMPORARY_RESTRICTION',
  OPERATIONAL = 'OPERATIONAL',
  ENTERPRISE = 'ENTERPRISE',
}

export enum ExceptionStatus {
  REQUESTED = 'REQUESTED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  REVOKED = 'REVOKED',
  SUPERSEDED = 'SUPERSEDED',
}

export enum MigrationType {
  INFRASTRUCTURE = 'INFRASTRUCTURE',
  REGION = 'REGION',
  PROVIDER = 'PROVIDER',
  DEPLOYMENT_PROFILE = 'DEPLOYMENT_PROFILE',
  DATABASE = 'DATABASE',
  RUNTIME = 'RUNTIME',
  PRODUCT_VERSION = 'PRODUCT_VERSION',
}

export enum MigrationRequestStatus {
  REQUESTED = 'REQUESTED',
  ASSESSING = 'ASSESSING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  SCHEDULED = 'SCHEDULED',
  IN_PROGRESS = 'IN_PROGRESS',
  SUCCEEDED = 'SUCCEEDED',
  PARTIAL = 'PARTIAL',
  FAILED = 'FAILED',
  ROLLED_BACK = 'ROLLED_BACK',
  CANCELLED = 'CANCELLED',
}

export enum RecoveryType {
  DATABASE = 'DATABASE',
  INFRASTRUCTURE = 'INFRASTRUCTURE',
  APPLICATION = 'APPLICATION',
  CONFIGURATION = 'CONFIGURATION',
  DISASTER = 'DISASTER',
  PARTIAL_TENANT = 'PARTIAL_TENANT',
  FULL_TENANT = 'FULL_TENANT',
}

export enum RecoveryRequestStatus {
  REQUESTED = 'REQUESTED',
  AUTHORIZED = 'AUTHORIZED',
  REJECTED = 'REJECTED',
  IN_PROGRESS = 'IN_PROGRESS',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
  PARTIAL = 'PARTIAL',
  CANCELLED = 'CANCELLED',
}

export enum RecoveryPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum TerminationRequestStatus {
  REQUESTED = 'REQUESTED',
  ELIGIBILITY_CHECK = 'ELIGIBILITY_CHECK',
  WAITING_APPROVAL = 'WAITING_APPROVAL',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  EXPORTING = 'EXPORTING',
  DEACTIVATING = 'DEACTIVATING',
  DEPROVISIONING = 'DEPROVISIONING',
  ARCHIVING = 'ARCHIVING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  BLOCKED_LEGAL_HOLD = 'BLOCKED_LEGAL_HOLD',
}

export enum ReconciliationFindingType {
  MISSING_TENANT = 'MISSING_TENANT',
  ORPHAN_TENANT = 'ORPHAN_TENANT',
  DUPLICATE_REFERENCE = 'DUPLICATE_REFERENCE',
  STALE_SUBSCRIPTION_REFERENCE = 'STALE_SUBSCRIPTION_REFERENCE',
  UNAUTHORIZED_RESOURCE = 'UNAUTHORIZED_RESOURCE',
  MISSING_RESOURCE = 'MISSING_RESOURCE',
  UNEXPECTED_RESOURCE = 'UNEXPECTED_RESOURCE',
  INCONSISTENT_LIFECYCLE_STATE = 'INCONSISTENT_LIFECYCLE_STATE',
  INVALID_PRODUCT_ASSOCIATION = 'INVALID_PRODUCT_ASSOCIATION',
  WRONG_DEPLOYMENT_REFERENCE = 'WRONG_DEPLOYMENT_REFERENCE',
  STALE_HEALTH_STATE = 'STALE_HEALTH_STATE',
  INCONSISTENT_TECHNICAL_ACTIVATION = 'INCONSISTENT_TECHNICAL_ACTIVATION',
  MISSING_EVIDENCE = 'MISSING_EVIDENCE',
}

export type TenantRegistryRecord = {
  id: string;
  productTenantId: string;
  tenantCode: string;
  tenantSlug: string;
  displayName: string;
  legalNameRef: string | null;
  productId: string;
  productCode: string | null;
  accountId: string | null;
  subscriptionId: string | null;
  classification: TenantClassification | string;
  segment: string | null;
  deploymentProfile: string | null;
  environmentClassification: EnvironmentClassification | string;
  region: string | null;
  administrativeStatus: AdministrativeStatus | string;
  technicalStatus: TechnicalStatus | string;
  governanceStatus: GovernanceStatus | string;
  healthStatus: HealthStatus | string;
  riskLevel: RiskLevel | string;
  platformTenantRef: string | null;
  provisioningRequestId: string | null;
  activationRecordId: string | null;
  lifecycleRecordId: string | null;
  internalOwnerId: string | null;
  operationalTeam: string | null;
  supportClassification: string | null;
  locale: string | null;
  timezone: string | null;
  defaultLanguage: string | null;
  dataResidencyRef: string | null;
  retentionPolicyRef: string | null;
  securityPolicyRef: string | null;
  legalHold: boolean;
  deletionProtection: boolean;
  lastAdminActivityAt: Date | null;
  lastSyncedAt: Date | null;
  technicalObservedAt: Date | null;
  healthObservedAt: Date | null;
  metadata: Record<string, unknown>;
  createdBy: string;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
};

export type TenantTagRecord = {
  id: string;
  tenantRegistryId: string;
  tagKey: string;
  tagValue: string;
  createdBy: string;
  createdAt: Date;
};

export type TenantNoteRecord = {
  id: string;
  tenantRegistryId: string;
  noteType: string;
  body: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
};

export type LegalHoldChangeRequestRecord = {
  id: string;
  tenantRegistryId: string;
  action: LegalHoldChangeAction | string;
  status: GovernanceRequestStatus | string;
  justification: string;
  requestedBy: string;
  approverId: string | null;
  approvedAt: Date | null;
  rejectedReason: string | null;
  correlationId: string | null;
  idempotencyKey: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
};

export type LifecycleRequestRecord = {
  id: string;
  tenantRegistryId: string;
  productTenantId: string;
  requestType: LifecycleRequestType | string;
  status: GovernanceRequestStatus | string;
  justification: string;
  riskAssessment: string | null;
  requestedBy: string;
  approverId: string | null;
  approvedAt: Date | null;
  rejectedReason: string | null;
  p7WorkflowId: string | null;
  p7LifecycleRecordId: string | null;
  p5SubscriptionId: string | null;
  correlationId: string | null;
  idempotencyKey: string;
  evidence: Record<string, unknown>;
  result: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  version: number;
};

export type ExceptionRecord = {
  id: string;
  tenantRegistryId: string;
  productTenantId: string;
  exceptionType: ExceptionType | string;
  status: ExceptionStatus | string;
  description: string;
  businessJustification: string;
  riskAssessment: string | null;
  scope: Record<string, unknown>;
  conditions: Record<string, unknown>;
  evidence: Record<string, unknown>;
  requesterId: string;
  approverId: string | null;
  startsAt: Date;
  expiresAt: Date;
  approvedAt: Date | null;
  revokedAt: Date | null;
  revokeReason: string | null;
  correlationId: string | null;
  idempotencyKey: string;
  createdAt: Date;
  updatedAt: Date;
  version: number;
};

export type MigrationRequestRecord = {
  id: string;
  tenantRegistryId: string;
  productTenantId: string;
  migrationType: MigrationType | string;
  status: MigrationRequestStatus | string;
  justification: string;
  impactAssessment: string | null;
  compatibilityAssessment: string | null;
  dataResidencyReview: string | null;
  downtimeAssessment: string | null;
  targetRef: Record<string, unknown>;
  scheduleAt: Date | null;
  requestedBy: string;
  approverId: string | null;
  approvedAt: Date | null;
  p7WorkflowId: string | null;
  evidence: Record<string, unknown>;
  result: Record<string, unknown>;
  correlationId: string | null;
  idempotencyKey: string;
  createdAt: Date;
  updatedAt: Date;
  version: number;
};

export type RecoveryRequestRecord = {
  id: string;
  tenantRegistryId: string;
  productTenantId: string;
  recoveryType: RecoveryType | string;
  status: RecoveryRequestStatus | string;
  priority: RecoveryPriority | string;
  scope: Record<string, unknown>;
  backupRef: string | null;
  restorePointRef: string | null;
  justification: string;
  rpoAssessment: string | null;
  rtoMeasurement: string | null;
  requestedBy: string;
  approverId: string | null;
  approvedAt: Date | null;
  p7WorkflowId: string | null;
  evidence: Record<string, unknown>;
  result: Record<string, unknown>;
  correlationId: string | null;
  idempotencyKey: string;
  createdAt: Date;
  updatedAt: Date;
  version: number;
};

export type TerminationRequestRecord = {
  id: string;
  tenantRegistryId: string;
  productTenantId: string;
  status: TerminationRequestStatus | string;
  justification: string;
  contractualCheck: Record<string, unknown>;
  financialCheck: Record<string, unknown>;
  retentionEvaluation: Record<string, unknown>;
  legalHold: boolean;
  dataExportRef: string | null;
  graceUntil: Date | null;
  requestedBy: string;
  approverId: string | null;
  approvedAt: Date | null;
  p7WorkflowId: string | null;
  evidence: Record<string, unknown>;
  result: Record<string, unknown>;
  correlationId: string | null;
  idempotencyKey: string;
  createdAt: Date;
  updatedAt: Date;
  version: number;
};

export type ReconciliationRunRecord = {
  id: string;
  mode: string;
  status: string;
  scope: Record<string, unknown>;
  summary: Record<string, unknown>;
  startedBy: string;
  startedAt: Date;
  finishedAt: Date | null;
  correlationId: string | null;
  createdAt: Date;
};

export type ReconciliationFindingRecord = {
  id: string;
  runId: string;
  tenantRegistryId: string | null;
  productTenantId: string | null;
  findingType: ReconciliationFindingType | string;
  severity: string;
  status: string;
  description: string;
  recommendedAction: string | null;
  evidence: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

export type ActivityEventRecord = {
  id: string;
  tenantRegistryId: string | null;
  productTenantId: string | null;
  eventType: string;
  action: string;
  actorId: string | null;
  actorType: string;
  source: string;
  outcome: string;
  reason: string | null;
  correlationId: string | null;
  causationId: string | null;
  beforeRef: Record<string, unknown> | null;
  afterRef: Record<string, unknown> | null;
  evidenceRef: string | null;
  details: Record<string, unknown>;
  createdAt: Date;
};

export type TenantSearchFilter = {
  q?: string;
  productId?: string;
  /** Workspace switch scope — only tenants whose product belongs to this vertical. */
  verticalId?: string;
  accountId?: string;
  subscriptionId?: string;
  region?: string;
  classification?: string;
  administrativeStatus?: string;
  technicalStatus?: string;
  governanceStatus?: string;
  healthStatus?: string;
  riskLevel?: string;
  tagKey?: string;
  tagValue?: string;
  /** Object-level operator portfolio restrictions (OR across dimensions). */
  operatorRegions?: string[];
  operatorAccountIds?: string[];
  operatorProductIds?: string[];
  operatorOwnerIds?: string[];
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
};

export type OperatorScopeRecord = {
  id: string;
  administratorId: string;
  region: string | null;
  accountId: string | null;
  productId: string | null;
  ownerSubjectId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type TenantPortfolioMetrics = {
  total: number;
  active: number;
  provisioning: number;
  suspended: number;
  degraded: number;
  pendingReview: number;
  exceptionsActive: number;
  reconciliationOpen: number;
  byProduct: Array<{ productId: string; productCode: string | null; count: number }>;
  byRegion: Array<{ region: string; count: number }>;
  byClassification: Array<{ classification: string; count: number }>;
  byAdministrativeStatus: Array<{ status: string; count: number }>;
  computedAt: string;
};

export type HealthSnapshotRecord = {
  id: string;
  tenantRegistryId: string;
  productTenantId: string;
  overallStatus: HealthStatus | string;
  indicators: Record<string, unknown>;
  sourceSystem: string;
  observedAt: Date;
  staleAfter: Date;
  createdAt: Date;
};

export type RiskAssessmentRecord = {
  id: string;
  tenantRegistryId: string;
  productTenantId: string;
  riskLevel: RiskLevel | string;
  score: number | null;
  ruleVersion: string;
  inputs: Record<string, unknown>;
  result: Record<string, unknown>;
  evidenceRefs: unknown[];
  reviewerId: string | null;
  evaluatedAt: Date;
  createdAt: Date;
};

export type BulkOperationRecord = {
  id: string;
  operationType: string;
  status: string;
  previewCount: number;
  filter: Record<string, unknown>;
  payload: Record<string, unknown>;
  results: unknown[];
  requestedBy: string;
  approverId: string | null;
  correlationId: string | null;
  idempotencyKey: string;
  createdAt: Date;
  updatedAt: Date;
};

export type TechnicalResourceRef = {
  id: string;
  type: string;
  status: string;
  region: string | null;
  provider: string | null;
};

export type ApplicationRef = {
  id: string;
  assignmentId: string | null;
  applicationId: string | null;
  status: string;
  version: number | null;
};

export type ConfigurationRef = {
  id: string;
  bundleId: string;
  status: string;
  bundleVersion: number;
  driftStatus: string;
};

export type CommercialProjection = {
  availability: 'AVAILABLE' | 'PARTIAL' | 'UNAVAILABLE';
  subscriptionStatus: string | null;
  planId: string | null;
  subscriptionNumber: string | null;
  billingFrequency: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
};

export type Tenant360Overview = {
  registry: TenantRegistryRecord;
  tags: TenantTagRecord[];
  notes: TenantNoteRecord[];
  commercial: {
    accountId: string | null;
    subscriptionId: string | null;
    productId: string;
    source: string;
    syncedAt: string | null;
    availability: 'AVAILABLE' | 'PARTIAL' | 'UNAVAILABLE';
  };
  commercialDetail: CommercialProjection;
  technical: {
    technicalStatus: string;
    lifecycleRecordId: string | null;
    activationRecordId: string | null;
    provisioningRequestId: string | null;
    observedAt: string | null;
    freshness: 'FRESH' | 'STALE' | 'UNKNOWN';
    source: string;
  };
  health: {
    status: string;
    observedAt: string | null;
    freshness: 'FRESH' | 'STALE' | 'UNKNOWN';
  };
  latestHealthSnapshot: HealthSnapshotRecord | null;
  latestRiskAssessment: RiskAssessmentRecord | null;
  resources: TechnicalResourceRef[];
  applications: ApplicationRef[];
  configuration: ConfigurationRef[];
  timeline: ActivityEventRecord[];
  openExceptions: number;
  pendingLifecycleRequests: number;
  openFindings: number;
};
