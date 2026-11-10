export enum RegistryLifecycleStatus {
  DRAFT = 'DRAFT',
  VALIDATING = 'VALIDATING',
  CERTIFIED = 'CERTIFIED',
  SUSPENDED = 'SUSPENDED',
  DEPRECATED = 'DEPRECATED',
  RETIRED = 'RETIRED',
}

export enum CertificationStatus {
  UNCERTIFIED = 'UNCERTIFIED',
  PENDING = 'PENDING',
  CERTIFIED = 'CERTIFIED',
  REVOKED = 'REVOKED',
}

export enum TechnicalVersionStatus {
  DRAFT = 'DRAFT',
  VALIDATING = 'VALIDATING',
  PUBLISHED = 'PUBLISHED',
  DEPRECATED = 'DEPRECATED',
  RETIRED = 'RETIRED',
}

export enum PlatformType {
  SHARED_SAAS_PLATFORM = 'SHARED_SAAS_PLATFORM',
  DEDICATED_PLATFORM = 'DEDICATED_PLATFORM',
  PRIVATE_PLATFORM = 'PRIVATE_PLATFORM',
  ON_PREMISE_PLATFORM = 'ON_PREMISE_PLATFORM',
}

export enum PlatformOperationalStatus {
  DRAFT = 'DRAFT',
  VALIDATING = 'VALIDATING',
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  DEPRECATED = 'DEPRECATED',
  RETIRED = 'RETIRED',
}

export enum RuntimeEnvironmentType {
  DEVELOPMENT = 'DEVELOPMENT',
  TEST = 'TEST',
  STAGING = 'STAGING',
  PRODUCTION = 'PRODUCTION',
}

export enum EnvironmentStatus {
  DRAFT = 'DRAFT',
  VALIDATING = 'VALIDATING',
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  DEPRECATED = 'DEPRECATED',
  RETIRED = 'RETIRED',
}

export enum DeploymentProfileCode {
  SHARED_SAAS = 'SHARED_SAAS',
  DEDICATED_DATA = 'DEDICATED_DATA',
  DEDICATED_RUNTIME = 'DEDICATED_RUNTIME',
  PRIVATE_CLOUD = 'PRIVATE_CLOUD',
  ON_PREMISE = 'ON_PREMISE',
}

export enum ProfileStatus {
  DRAFT = 'DRAFT',
  VALIDATING = 'VALIDATING',
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  DEPRECATED = 'DEPRECATED',
  RETIRED = 'RETIRED',
}

export enum ControlContractStatus {
  DRAFT = 'DRAFT',
  VALIDATING = 'VALIDATING',
  CERTIFIED = 'CERTIFIED',
  PUBLISHED = 'PUBLISHED',
  DEPRECATED = 'DEPRECATED',
  RETIRED = 'RETIRED',
}

export enum CompatibilityResult {
  COMPATIBLE = 'COMPATIBLE',
  INCOMPATIBLE = 'INCOMPATIBLE',
  REQUIRES_REVIEW = 'REQUIRES_REVIEW',
}

export enum RegistryResourceType {
  PRODUCT_REGISTRY = 'PRODUCT_REGISTRY',
  PRODUCT_TECHNICAL_VERSION = 'PRODUCT_TECHNICAL_VERSION',
  PRODUCT_PLATFORM = 'PRODUCT_PLATFORM',
  RUNTIME_ENVIRONMENT = 'RUNTIME_ENVIRONMENT',
  DEPLOYMENT_PROFILE = 'DEPLOYMENT_PROFILE',
  PRODUCT_CONTROL_CONTRACT = 'PRODUCT_CONTROL_CONTRACT',
  COMPATIBILITY_EVALUATION = 'COMPATIBILITY_EVALUATION',
}

export type ProductRegistryRecord = {
  id: string;
  productId: string;
  code: string;
  name: string;
  description: string | null;
  verticalCategory: string | null;
  registryStatus: RegistryLifecycleStatus;
  certificationStatus: CertificationStatus;
  provisionable: boolean;
  technicalConstraints: Record<string, unknown>;
  declaredCapabilities: unknown[];
  compatiblePlatformIds: string[];
  compatibleEnvironmentIds: string[];
  compatibleProfileIds: string[];
  compatibleContractIds: string[];
  metadata: Record<string, unknown>;
  version: number;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ProductTechnicalVersion = {
  id: string;
  productRegistryId: string;
  technicalVersion: string;
  releaseChannel: string;
  versionStatus: TechnicalVersionStatus;
  compatibleContractVersions: unknown[];
  compatibleProfileCodes: unknown[];
  compatibleRuntimeTypes: unknown[];
  schemaCompatibility: Record<string, unknown>;
  apiCompatibility: Record<string, unknown>;
  availableFrom: Date | null;
  supportEndsAt: Date | null;
  certificationMetadata: Record<string, unknown>;
  changeSummary: string | null;
  immutableAfterPublish: boolean;
  metadata: Record<string, unknown>;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ProductPlatform = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  platformType: PlatformType;
  businessBackendId: string | null;
  allowedProductIds: string[];
  supportedEnvironmentTypes: unknown[];
  supportedProfileCodes: unknown[];
  connectivityReference: string | null;
  /** Opaque handle only — never plaintext secrets. */
  secureConfigRef: string | null;
  integrationProtocolVersion: string | null;
  controlContractVersion: string | null;
  certificationStatus: CertificationStatus;
  operationalStatus: PlatformOperationalStatus;
  declaredCapabilities: unknown[];
  constraints: Record<string, unknown>;
  metadata: Record<string, unknown>;
  version: number;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type RuntimeEnvironment = {
  id: string;
  platformId: string;
  code: string;
  name: string;
  environmentType: RuntimeEnvironmentType;
  region: string | null;
  geoZone: string | null;
  securityClassification: string | null;
  dataClassification: string | null;
  availableCapabilities: unknown[];
  dataResidencyConstraints: Record<string, unknown>;
  backupPolicy: Record<string, unknown>;
  availabilityPolicy: Record<string, unknown>;
  allowedProfileCodes: unknown[];
  environmentStatus: EnvironmentStatus;
  governanceMetadata: Record<string, unknown>;
  metadata: Record<string, unknown>;
  version: number;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type DeploymentProfile = {
  id: string;
  code: DeploymentProfileCode | string;
  name: string;
  description: string | null;
  technicalRequirements: Record<string, unknown>;
  securityRequirements: Record<string, unknown>;
  isolationModel: string;
  connectivityModel: string;
  networkConstraints: Record<string, unknown>;
  dataResidencyConstraints: Record<string, unknown>;
  backupRequirements: Record<string, unknown>;
  availabilityRequirements: Record<string, unknown>;
  disasterRecoveryRequirements: Record<string, unknown>;
  compatibleProductIds: string[];
  compatiblePlatformTypes: unknown[];
  compatibleEnvironmentTypes: unknown[];
  certificationStatus: CertificationStatus;
  profileStatus: ProfileStatus;
  profileVersion: number;
  metadata: Record<string, unknown>;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ProductControlContract = {
  id: string;
  productId: string;
  platformId: string;
  contractCode: string;
  contractVersion: string;
  schemaVersion: string;
  supportedCapabilities: unknown[];
  supportedControlOperations: unknown[];
  connectivityModel: string;
  s2sAuthPolicy: Record<string, unknown>;
  signatureRequirements: Record<string, unknown>;
  publishedEvents: unknown[];
  consumedEvents: unknown[];
  backwardCompatible: boolean;
  forwardCompatible: boolean;
  versioningPolicy: Record<string, unknown>;
  effectiveFrom: Date | null;
  deprecatedAt: Date | null;
  contractStatus: ControlContractStatus;
  certificationEvidence: Record<string, unknown>;
  immutable: boolean;
  metadata: Record<string, unknown>;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CompatibilityEvaluation = {
  id: string;
  correlationId: string;
  productRegistryId: string | null;
  technicalVersionId: string | null;
  platformId: string | null;
  environmentId: string | null;
  profileId: string | null;
  contractId: string | null;
  result: CompatibilityResult;
  rulesApplied: string[];
  reasons: string[];
  examinedRefs: Record<string, unknown>;
  evaluatedBy: string | null;
  evaluatedAt: Date;
  createdAt: Date;
};

export type RegistryHistoryEntry = {
  id: string;
  resourceType: RegistryResourceType;
  resourceId: string;
  fromStatus: string | null;
  toStatus: string | null;
  action: string;
  reason: string | null;
  actorId: string;
  details: Record<string, unknown>;
  createdAt: Date;
};
