export enum ServiceCategory {
  CONTROL_PLANE = 'CONTROL_PLANE',
  ADMIN_CONSOLE = 'ADMIN_CONSOLE',
  TENANT_REGISTRY = 'TENANT_REGISTRY',
  PROVISIONING = 'PROVISIONING',
  WORKFLOW = 'WORKFLOW',
  PRODUCT_CONTROL = 'PRODUCT_CONTROL',
  INFRASTRUCTURE = 'INFRASTRUCTURE',
  IDENTITY = 'IDENTITY',
  CONFIGURATION = 'CONFIGURATION',
  LIFECYCLE = 'LIFECYCLE',
  NOTIFICATION = 'NOTIFICATION',
  BILLING = 'BILLING',
  PAYMENT = 'PAYMENT',
  AUDIT = 'AUDIT',
  MESSAGING = 'MESSAGING',
  DATABASE = 'DATABASE',
  STORAGE = 'STORAGE',
  NETWORK = 'NETWORK',
  CONNECTIVITY = 'CONNECTIVITY',
  EXTERNAL = 'EXTERNAL',
  OTHER = 'OTHER',
  PLATFORM = 'PLATFORM',
}

export enum ServiceType {
  INTERNAL = 'INTERNAL',
  EXTERNAL = 'EXTERNAL',
  SHARED = 'SHARED',
  PRODUCT_CONTROL = 'PRODUCT_CONTROL',
  INFRASTRUCTURE = 'INFRASTRUCTURE',
  DATA = 'DATA',
}

export enum ServiceLifecycleStatus {
  PLANNED = 'PLANNED',
  CONFIGURED = 'CONFIGURED',
  DISCOVERED = 'DISCOVERED',
  OBSERVED = 'OBSERVED',
  VERIFIED = 'VERIFIED',
  DEPRECATED = 'DEPRECATED',
  RETIRED = 'RETIRED',
}

/** Observation honesty — never promote UNKNOWN silently to healthy elsewhere. */
export enum ServiceObservationStatus {
  CONFIGURED = 'CONFIGURED',
  DISCOVERED = 'DISCOVERED',
  OBSERVED = 'OBSERVED',
  VERIFIED = 'VERIFIED',
  UNAVAILABLE = 'UNAVAILABLE',
  UNKNOWN = 'UNKNOWN',
}

export enum ServiceCriticality {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum ServiceEnvironment {
  DEVELOPMENT = 'DEVELOPMENT',
  TEST = 'TEST',
  STAGING = 'STAGING',
  PRODUCTION = 'PRODUCTION',
  DR = 'DR',
  ENTERPRISE = 'ENTERPRISE',
  UNKNOWN = 'UNKNOWN',
}

export enum ServiceDependencyType {
  RUNTIME = 'RUNTIME',
  DATA = 'DATA',
  NETWORK = 'NETWORK',
  MESSAGING = 'MESSAGING',
  IDENTITY = 'IDENTITY',
  EXTERNAL = 'EXTERNAL',
  BUILD = 'BUILD',
  OTHER = 'OTHER',
}

export type PlatformServiceRecord = {
  id: string;
  serviceCode: string;
  serviceSlug: string;
  displayName: string;
  description: string | null;
  category: ServiceCategory | string;
  serviceType: ServiceType | string;
  lifecycleStatus: ServiceLifecycleStatus | string;
  observationStatus: ServiceObservationStatus | string;
  businessCriticality: ServiceCriticality | string;
  technicalCriticality: ServiceCriticality | string;
  environment: ServiceEnvironment | string;
  region: string | null;
  deploymentProfile: string | null;
  runtimeTechnology: string | null;
  currentVersion: string | null;
  serviceOwnerId: string | null;
  technicalOwnerId: string | null;
  operationalTeam: string | null;
  supportGroup: string | null;
  escalationPolicyRef: string | null;
  healthCheckRef: string | null;
  monitoringConfigRef: string | null;
  sloRef: string | null;
  runbookRef: string | null;
  rpoMinutes: number | null;
  rtoMinutes: number | null;
  maintenancePolicyRef: string | null;
  dataClassification: string | null;
  securityClassification: string | null;
  supportHours: string | null;
  documentationUrl: string | null;
  p7ResourceRef: string | null;
  p8ProjectionNote: string | null;
  metadata: Record<string, unknown>;
  createdBy: string;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
};

export type ServiceDependencyRecord = {
  id: string;
  serviceId: string;
  dependsOnServiceId: string;
  dependencyType: ServiceDependencyType | string;
  criticality: ServiceCriticality | string;
  description: string | null;
  createdBy: string;
  createdAt: Date;
};

export type ServiceCatalogSearchFilter = {
  q?: string;
  category?: string;
  lifecycleStatus?: string;
  observationStatus?: string;
  environment?: string;
  region?: string;
  operationalTeam?: string;
  limit?: number;
  offset?: number;
};

export type PlatformServiceDetail = {
  service: PlatformServiceRecord;
  dependencies: ServiceDependencyRecord[];
  dependents: ServiceDependencyRecord[];
};
