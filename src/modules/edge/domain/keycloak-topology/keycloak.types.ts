/** P7.7 Keycloak Topology Provisioning — domain vocabulary. */

export enum KeycloakTopologyType {
  /** Model A — one isolated realm per tenant. */
  DEDICATED_REALM = 'DEDICATED_REALM',
  /** Model B — shared realm, one Keycloak organization per tenant. */
  SHARED_REALM_ORGANIZATIONS = 'SHARED_REALM_ORGANIZATIONS',
  /** Model C — external / specific topology, adapter + explicit contract only. */
  EXTERNAL_SPECIFIC = 'EXTERNAL_SPECIFIC',
}

/** Lifecycle statuses mandated by P7.7 §12. */
export enum KeycloakTopologyStatus {
  PLANNED = 'PLANNED',
  PENDING = 'PENDING',
  PROVISIONING = 'PROVISIONING',
  CONFIGURING = 'CONFIGURING',
  VERIFYING = 'VERIFYING',
  READY = 'READY',
  DEGRADED = 'DEGRADED',
  FAILED = 'FAILED',
  RECONCILIATION_REQUIRED = 'RECONCILIATION_REQUIRED',
  QUARANTINED = 'QUARANTINED',
  DEPROVISIONING_PENDING = 'DEPROVISIONING_PENDING',
  DEPROVISIONED = 'DEPROVISIONED',
}

export enum KeycloakProviderKind {
  KEYCLOAK_MANAGED = 'KEYCLOAK_MANAGED',
  KEYCLOAK_EXTERNAL = 'KEYCLOAK_EXTERNAL',
  KEYCLOAK_HYBRID = 'KEYCLOAK_HYBRID',
}

export enum KeycloakOperationalStatus {
  ACTIVE = 'ACTIVE',
  DEGRADED = 'DEGRADED',
  UNAVAILABLE = 'UNAVAILABLE',
  RETIRED = 'RETIRED',
}

export enum KeycloakClientKind {
  CONFIDENTIAL = 'CONFIDENTIAL',
  PUBLIC = 'PUBLIC',
  SERVICE_ACCOUNT = 'SERVICE_ACCOUNT',
}

export enum KeycloakErrorCode {
  VALIDATION = 'VALIDATION',
  AUTHORIZATION_FAILED = 'AUTHORIZATION_FAILED',
  AUTHORIZATION_REVOKED = 'AUTHORIZATION_REVOKED',
  AUTHORIZATION_EXPIRED = 'AUTHORIZATION_EXPIRED',
  PLACEMENT_INVALID = 'PLACEMENT_INVALID',
  PROVIDER_UNAVAILABLE = 'PROVIDER_UNAVAILABLE',
  SERVER_UNAVAILABLE = 'SERVER_UNAVAILABLE',
  CAPABILITY_UNSUPPORTED = 'CAPABILITY_UNSUPPORTED',
  TOPOLOGY_UNSUPPORTED = 'TOPOLOGY_UNSUPPORTED',
  TOPOLOGY_COLLISION = 'TOPOLOGY_COLLISION',
  RESOURCE_NOT_READY = 'RESOURCE_NOT_READY',
  RESOURCE_MISSING = 'RESOURCE_MISSING',
  DISCOVERY_INVALID = 'DISCOVERY_INVALID',
  SSRF_BLOCKED = 'SSRF_BLOCKED',
  CONFLICT = 'CONFLICT',
  ISOLATION_VIOLATION = 'ISOLATION_VIOLATION',
  DRIFT_DETECTED = 'DRIFT_DETECTED',
  DEPROVISION_FORBIDDEN = 'DEPROVISION_FORBIDDEN',
  UNKNOWN_OUTCOME = 'UNKNOWN_OUTCOME',
  UNSAFE_COMPENSATION = 'UNSAFE_COMPENSATION',
  OPERATION_NOT_IMPLEMENTED = 'OPERATION_NOT_IMPLEMENTED',
  DEPENDENCY_UNAVAILABLE = 'DEPENDENCY_UNAVAILABLE',
  TIMEOUT = 'TIMEOUT',
}

/** P7.7 mandate workflow handler keys (real implementations). */
export const KEYCLOAK_HANDLER_KEYS = [
  'keycloak.validate_plan',
  'keycloak.discover_capabilities',
  'keycloak.provision_realm',
  'keycloak.provision_organization',
  'keycloak.configure_oidc',
  'keycloak.create_technical_client',
  'keycloak.verify_topology',
  'keycloak.reconcile_topology',
  'keycloak.deprovision_topology',
] as const;

export type KeycloakHandlerKey = (typeof KEYCLOAK_HANDLER_KEYS)[number];

/** Destructive / quarantined-only keys. */
export const KEYCLOAK_RESTRICTED_HANDLER_KEYS = [
  'keycloak.deprovision_topology',
] as const;

export const KEYCLOAK_MANAGED_PROVIDER_CODE = 'keycloak-managed-v1';

/** Table name expectations enforced by tests (mandate §13). */
export const KEYCLOAK_TABLES = [
  'edge_p7_keycloak_providers',
  'edge_p7_keycloak_servers',
  'edge_p7_keycloak_capabilities',
  'edge_p7_keycloak_topologies',
  'edge_p7_keycloak_topology_versions',
  'edge_p7_keycloak_realms',
  'edge_p7_keycloak_organizations',
  'edge_p7_keycloak_clients',
  'edge_p7_keycloak_oidc_configurations',
  'edge_p7_keycloak_resource_references',
  'edge_p7_keycloak_health_checks',
  'edge_p7_keycloak_reconciliation_runs',
  'edge_p7_keycloak_provisioning_history',
  'edge_p7_keycloak_operation_evidence',
] as const;

// ---------------------------------------------------------------------------
// Records
// ---------------------------------------------------------------------------

export type KeycloakProviderCapabilities = {
  realms: boolean;
  organizations: boolean;
  technicalClients: boolean;
  oidcDiscovery: boolean;
  reconciliation: boolean;
  serviceAccountAuth: boolean;
  tlsRequired: boolean;
};

export type KeycloakProviderRecord = {
  id: string;
  code: string;
  name: string;
  providerVersion: string;
  providerKind: KeycloakProviderKind | string;
  operationalStatus: KeycloakOperationalStatus | string;
  supportedTopologyTypes: string[];
  capabilities: KeycloakProviderCapabilities | Record<string, unknown>;
  constraints: Record<string, unknown>;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

export type KeycloakServerRecord = {
  id: string;
  providerId: string;
  code: string;
  name: string;
  baseUrl: string;
  adminRealm: string;
  adminClientId: string;
  /** Opaque vault ref — never plaintext secret. */
  adminCredentialRef: string | null;
  tlsMode: string;
  allowPrivateNetwork: boolean;
  environment: string;
  operationalStatus: string;
  discoveredVersion: string | null;
  lastConnectivityStatus: string | null;
  lastConnectivityAt: Date | null;
  metadata: Record<string, unknown>;
  version: number;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type KeycloakCapabilitiesRecord = {
  id: string;
  serverId: string;
  keycloakVersion: string | null;
  features: Record<string, unknown>;
  organizationsSupported: boolean;
  realmsSupported: boolean;
  adminApiReachable: boolean;
  discoverySource: string;
  rawEvidence: Record<string, unknown>;
  verifiedAt: Date;
  createdAt: Date;
};

export type KeycloakTopologyRecord = {
  id: string;
  tenantId: string;
  productId: string;
  subscriptionId: string | null;
  authorizationId: string | null;
  authorizationVersion: number | null;
  placementDecisionId: string | null;
  deploymentProfileId: string | null;
  deploymentProfileVersion: number | null;
  runtimeProfileId: string | null;
  providerId: string;
  serverId: string;
  topologyType: KeycloakTopologyType | string;
  /** Internal refs (UUIDs) — distinct from external Keycloak ids. */
  realmRef: string | null;
  organizationRef: string | null;
  oidcConfigurationRef: string | null;
  externalRealmId: string | null;
  externalOrganizationId: string | null;
  keycloakVersion: string | null;
  desiredConfigVersion: number;
  appliedConfigVersion: number | null;
  resourceFingerprint: string | null;
  status: KeycloakTopologyStatus | string;
  statusReason: string | null;
  lastHealthCheckAt: Date | null;
  lastReconciliationAt: Date | null;
  workflowId: string | null;
  deletionProtection: boolean;
  metadata: Record<string, unknown>;
  version: number;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type KeycloakRealmRecord = {
  id: string;
  topologyId: string;
  tenantId: string;
  realmName: string;
  externalRealmId: string | null;
  managedByEdge: boolean;
  sslRequired: string;
  ssoSessionIdleSeconds: number;
  ssoSessionMaxSeconds: number;
  accessTokenLifespanSeconds: number;
  passwordPolicy: string | null;
  revokeRefreshToken: boolean;
  refreshTokenMaxReuse: number;
  desiredFingerprint: string | null;
  appliedFingerprint: string | null;
  status: string;
  workflowId: string | null;
  evidence: Record<string, unknown>;
  version: number;
  createdAt: Date;
  updatedAt: Date;
};

export type KeycloakOrganizationRecord = {
  id: string;
  topologyId: string;
  realmId: string;
  tenantId: string;
  orgAlias: string;
  orgName: string;
  externalOrganizationId: string | null;
  technicalPurpose: string;
  status: string;
  workflowId: string | null;
  evidence: Record<string, unknown>;
  version: number;
  createdAt: Date;
  updatedAt: Date;
};

export type KeycloakClientRecord = {
  id: string;
  topologyId: string;
  realmId: string;
  tenantId: string;
  clientId: string;
  clientUuid: string | null;
  clientKind: KeycloakClientKind | string;
  ownerFunction: string;
  documentedUsage: string;
  redirectUris: string[];
  webOrigins: string[];
  scopes: string[];
  /** Opaque vault ref — never plaintext secret. */
  secretCredentialRef: string | null;
  secretRotatedAt: Date | null;
  standardFlowEnabled: boolean;
  directAccessGrantsEnabled: boolean;
  serviceAccountsEnabled: boolean;
  pkceRequired: boolean;
  complianceStatus: string;
  status: string;
  workflowId: string | null;
  evidence: Record<string, unknown>;
  version: number;
  createdAt: Date;
  updatedAt: Date;
};

export type KeycloakOidcConfigurationRecord = {
  id: string;
  topologyId: string;
  realmId: string;
  tenantId: string;
  issuer: string;
  authorizationEndpoint: string | null;
  tokenEndpoint: string;
  jwksUri: string;
  userinfoEndpoint: string | null;
  endSessionEndpoint: string | null;
  supportedScopes: string[];
  supportedResponseTypes: string[];
  supportedSigningAlgs: string[];
  discoveryDocument: Record<string, unknown>;
  discoveryValidated: boolean;
  jwksValidated: boolean;
  validatedAt: Date | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

export type KeycloakResourceReferenceRecord = {
  id: string;
  topologyId: string;
  tenantId: string;
  resourceKind: 'REALM' | 'ORGANIZATION' | 'CLIENT' | 'OIDC_CONFIGURATION' | 'SERVER';
  internalRef: string;
  externalId: string;
  externalKind: string;
  verified: boolean;
  verifiedAt: Date | null;
  createdAt: Date;
};

export type KeycloakHealthCheckRecord = {
  id: string;
  topologyId: string | null;
  serverId: string;
  checkType: string;
  outcome: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' | 'UNKNOWN';
  latencyMs: number | null;
  details: Record<string, unknown>;
  checkedAt: Date;
};

export type KeycloakReconciliationRunRecord = {
  id: string;
  topologyId: string;
  tenantId: string;
  workflowId: string | null;
  trigger: string;
  observedState: Record<string, unknown>;
  driftDetected: boolean;
  driftClassification: string | null;
  driftDetails: unknown[];
  actionTaken: string | null;
  outcome: 'PENDING' | 'NO_DRIFT' | 'REMEDIATED' | 'QUARANTINED' | 'FAILED';
  startedAt: Date;
  completedAt: Date | null;
};

export type KeycloakHistoryRecord = {
  id: string;
  resourceType: string;
  resourceId: string;
  topologyId: string | null;
  workflowId: string | null;
  fromStatus: string | null;
  toStatus: string | null;
  action: string;
  reason: string | null;
  actorId: string;
  details: Record<string, unknown>;
  createdAt: Date;
};

export type KeycloakOperationEvidenceRecord = {
  id: string;
  topologyId: string;
  tenantId: string;
  workflowId: string | null;
  stepKey: string | null;
  operation: string;
  outcome: 'SUCCEEDED' | 'FAILED' | 'SKIPPED';
  evidence: Record<string, unknown>;
  errorCode: string | null;
  errorMessage: string | null;
  durationMs: number | null;
  performedBy: string | null;
  performedAt: Date;
};

// ---------------------------------------------------------------------------
// Discovered capabilities (verified feature matrix)
// ---------------------------------------------------------------------------

export type KeycloakServerCapabilities = {
  serverId: string;
  keycloakVersion: string | null;
  organizationsSupported: boolean;
  realmsSupported: boolean;
  adminApiReachable: boolean;
  features: Record<string, boolean>;
  discoverySource: string;
  verifiedAt: string;
  rawEvidence?: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// Plan (immutable provisioning intent built by the domain)
// ---------------------------------------------------------------------------

export type KeycloakPlanInput = {
  tenantId: string;
  productId: string;
  subscriptionId?: string | null;
  authorizationId?: string | null;
  authorizationVersion?: number | null;
  placementDecisionId?: string | null;
  deploymentProfileId?: string | null;
  deploymentProfileVersion?: number | null;
  runtimeProfileId?: string | null;
  providerId: string;
  serverId: string;
  topologyType: KeycloakTopologyType | string;
  /** Options coming from P7.2 profiles/contract — never raw user input. */
  profileOptions?: Record<string, unknown>;
  securityClassifications?: string[];
  metadata?: Record<string, unknown>;
};

export type KeycloakPlanValidationIssue = {
  code: string;
  message: string;
  field?: string;
};

export type KeycloakPlanValidationResult = {
  valid: boolean;
  issues: KeycloakPlanValidationIssue[];
  resolvedRealmName?: string;
  resolvedOrgAlias?: string;
  topologyType?: KeycloakTopologyType | string;
};