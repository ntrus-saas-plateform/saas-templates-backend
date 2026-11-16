/** P7.9 — Product Experience Provisioning domain vocabulary. */

export enum ExperienceProfileStatus {
  DRAFT = 'DRAFT',
  VALIDATED = 'VALIDATED',
  PUBLISHED = 'PUBLISHED',
  DEPRECATED = 'DEPRECATED',
  RETIRED = 'RETIRED',
}

export enum ApplicationKind {
  WEB = 'WEB',
  MOBILE = 'MOBILE',
  DESKTOP = 'DESKTOP',
  POS = 'POS',
  OPERATIONS = 'OPERATIONS',
  CUSTOMER = 'CUSTOMER',
  KIOSK = 'KIOSK',
  DISPLAY = 'DISPLAY',
  DEVICE = 'DEVICE',
  OTHER = 'OTHER',
}

export enum ApplicationStatus {
  DRAFT = 'DRAFT',
  VALIDATED = 'VALIDATED',
  PUBLISHED = 'PUBLISHED',
  DEPRECATED = 'DEPRECATED',
  RETIRED = 'RETIRED',
}

export enum ExperienceVersionStatus {
  DRAFT = 'DRAFT',
  VALIDATED = 'VALIDATED',
  PUBLISHED = 'PUBLISHED',
  SUPERSEDED = 'SUPERSEDED',
}

export enum ExperienceAssignmentStatus {
  ASSIGNED = 'ASSIGNED',
  PROVISIONING = 'PROVISIONING',
  READY = 'READY',
  FAILED = 'FAILED',
  DEACTIVATING = 'DEACTIVATING',
  DEACTIVATED = 'DEACTIVATED',
  SUPERSEDED = 'SUPERSEDED',
}

export enum ApplicationBindingStatus {
  PENDING = 'PENDING',
  PROVISIONING = 'PROVISIONING',
  ACTIVE = 'ACTIVE',
  FAILED = 'FAILED',
  REVOKED = 'REVOKED',
}

export enum ExperienceClientKind {
  PUBLIC = 'PUBLIC',
  CONFIDENTIAL = 'CONFIDENTIAL',
  SERVICE_ACCOUNT = 'SERVICE_ACCOUNT',
}

export enum ClientRegistrationStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  FAILED = 'FAILED',
  REVOKED = 'REVOKED',
}

export enum DomainKind {
  SUBDOMAIN = 'SUBDOMAIN',
  CUSTOM = 'CUSTOM',
}

export enum DomainOwnershipStatus {
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  FAILED = 'FAILED',
  REVOKED = 'REVOKED',
}

export enum DnsStatus {
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  FAILED = 'FAILED',
  NOT_REQUIRED = 'NOT_REQUIRED',
}

export enum TlsStatus {
  PENDING = 'PENDING',
  PROVISIONING = 'PROVISIONING',
  ACTIVE = 'ACTIVE',
  FAILED = 'FAILED',
  EXPIRED = 'EXPIRED',
  REVOKED = 'REVOKED',
}

export enum RouteStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  FAILED = 'FAILED',
  DEACTIVATED = 'DEACTIVATED',
}

export enum DomainBindingStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  FAILED = 'FAILED',
  DEACTIVATED = 'DEACTIVATED',
}

export enum ExperienceDriftStatus {
  NONE = 'NONE',
  DETECTED = 'DETECTED',
  REMEDIATING = 'REMEDIATING',
  RESOLVED = 'RESOLVED',
  UNKNOWN = 'UNKNOWN',
}

export enum ExperienceErrorCode {
  VALIDATION = 'VALIDATION',
  AUTHORIZATION_FAILED = 'AUTHORIZATION_FAILED',
  REDIRECT_URI_INVALID = 'REDIRECT_URI_INVALID',
  WEB_ORIGIN_INVALID = 'WEB_ORIGIN_INVALID',
  DOMAIN_TAKEOVER_RISK = 'DOMAIN_TAKEOVER_RISK',
  DOMAIN_OWNERSHIP_UNVERIFIED = 'DOMAIN_OWNERSHIP_UNVERIFIED',
  HOSTNAME_CONFLICT = 'HOSTNAME_CONFLICT',
  COMPATIBILITY_MISMATCH = 'COMPATIBILITY_MISMATCH',
  PROFILE_NOT_PUBLISHED = 'PROFILE_NOT_PUBLISHED',
  APPLICATION_NOT_PUBLISHED = 'APPLICATION_NOT_PUBLISHED',
  CROSS_TENANT_ROUTING = 'CROSS_TENANT_ROUTING',
  SECRET_PLAINTEXT_FORBIDDEN = 'SECRET_PLAINTEXT_FORBIDDEN',
  PROVIDER_UNAVAILABLE = 'PROVIDER_UNAVAILABLE',
  CONFLICT = 'CONFLICT',
}

export type ExperienceProfileRecord = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  productId: string | null;
  profileStatus: ExperienceProfileStatus | string;
  compatibleRuntimeCodes: string[];
  compatibleDeploymentProfileCodes: string[];
  metadata: Record<string, unknown>;
  createdBy: string;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
};

export type ExperienceApplicationRecord = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  productId: string | null;
  applicationKind: ApplicationKind | string;
  experienceProfileId: string | null;
  applicationStatus: ApplicationStatus | string;
  latestVersion: number;
  metadata: Record<string, unknown>;
  createdBy: string;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
};

export type ExperienceApplicationVersionRecord = {
  id: string;
  applicationId: string;
  versionNumber: number;
  productVersion: string | null;
  runtimeVersion: string | null;
  apiCompatibilityVersion: string | null;
  deploymentProfileCode: string | null;
  configurationBundleCode: string | null;
  entitlementSnapshotVersion: string | null;
  manifest: Record<string, unknown>;
  checksum: string;
  status: ExperienceVersionStatus | string;
  publishedAt: Date | null;
  createdBy: string;
  createdAt: Date;
};

export type TenantExperienceAssignmentRecord = {
  id: string;
  tenantId: string;
  productId: string;
  subscriptionId: string | null;
  accountId: string | null;
  experienceProfileId: string | null;
  assignmentStatus: ExperienceAssignmentStatus | string;
  authorizationRowId: string | null;
  authorizationVersion: number | null;
  provisioningRequestId: string | null;
  workflowId: string | null;
  desiredManifest: Record<string, unknown>;
  appliedManifest: Record<string, unknown>;
  appliedChecksum: string | null;
  driftStatus: ExperienceDriftStatus | string;
  lastDeployedAt: Date | null;
  metadata: Record<string, unknown>;
  createdBy: string;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
};

export type TenantApplicationBindingRecord = {
  id: string;
  assignmentId: string;
  tenantId: string;
  applicationId: string;
  applicationVersion: number;
  bindingStatus: ApplicationBindingStatus | string;
  clientRegistrationId: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

export type ExperienceClientRegistrationRecord = {
  id: string;
  assignmentId: string;
  tenantId: string;
  applicationBindingId: string | null;
  clientId: string;
  clientKind: ExperienceClientKind | string;
  keycloakTopologyId: string | null;
  keycloakClientRef: string | null;
  redirectUris: string[];
  postLogoutRedirectUris: string[];
  webOrigins: string[];
  audiences: string[];
  scopes: string[];
  credentialRef: string | null;
  registrationStatus: ClientRegistrationStatus | string;
  metadata: Record<string, unknown>;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  version: number;
};

export type ExperienceDomainBindingRecord = {
  id: string;
  assignmentId: string;
  tenantId: string;
  hostname: string;
  domainKind: DomainKind | string;
  ownershipStatus: DomainOwnershipStatus | string;
  ownershipToken: string | null;
  dnsStatus: DnsStatus | string;
  tlsStatus: TlsStatus | string;
  certificateRef: string | null;
  routeStatus: RouteStatus | string;
  bindingStatus: DomainBindingStatus | string;
  metadata: Record<string, unknown>;
  createdBy: string;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
};

export type ExperienceCertificateRecord = {
  id: string;
  domainBindingId: string;
  tenantId: string;
  certificateRef: string;
  issuer: string | null;
  notBefore: Date | null;
  notAfter: Date | null;
  fingerprintSha256: string | null;
  certificateStatus: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

export type ExperienceDeploymentRunRecord = {
  id: string;
  assignmentId: string;
  tenantId: string;
  productId: string;
  operation: string;
  workflowId: string | null;
  outcome: string;
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

export type ExperienceEvidenceRecord = {
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

export const EXPERIENCE_HANDLER_KEYS = [
  'experience.validate_plan',
  'experience.bind_applications',
  'experience.register_clients',
  'experience.bind_domains',
  'experience.provision_tls',
  'experience.verify_experience',
  'experience.deactivate',
] as const;

export type ExperienceHandlerKey = (typeof EXPERIENCE_HANDLER_KEYS)[number];
