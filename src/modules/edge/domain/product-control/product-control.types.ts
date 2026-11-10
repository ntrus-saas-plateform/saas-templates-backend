/** P7.5 Product Control Integration — domain vocabulary. */

export enum ProductControlEndpointStatus {
  PENDING_VALIDATION = 'PENDING_VALIDATION',
  VALIDATING = 'VALIDATING',
  ACTIVE = 'ACTIVE',
  DEGRADED = 'DEGRADED',
  UNAVAILABLE = 'UNAVAILABLE',
  QUARANTINED = 'QUARANTINED',
  REVOKED = 'REVOKED',
}

export enum ProductControlAuthProfile {
  OAUTH2_CC = 'OAUTH2_CC',
  MTLS = 'MTLS',
  OAUTH2_CC_MTLS = 'OAUTH2_CC_MTLS',
  HMAC_SIGNED = 'HMAC_SIGNED',
  CUSTOM = 'CUSTOM',
}

export enum NegotiatedContractStatus {
  DISCOVERED = 'DISCOVERED',
  VALIDATING = 'VALIDATING',
  COMPATIBLE = 'COMPATIBLE',
  INCOMPATIBLE = 'INCOMPATIBLE',
  DEPRECATED = 'DEPRECATED',
  REVOKED = 'REVOKED',
}

export enum ControlExchangeStatus {
  CREATED = 'CREATED',
  QUEUED = 'QUEUED',
  SENDING = 'SENDING',
  SENT = 'SENT',
  ACKNOWLEDGED = 'ACKNOWLEDGED',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
  RETRY_PENDING = 'RETRY_PENDING',
  UNKNOWN_OUTCOME = 'UNKNOWN_OUTCOME',
  RECONCILIATION_REQUIRED = 'RECONCILIATION_REQUIRED',
  RECONCILED = 'RECONCILED',
  CANCELLED = 'CANCELLED',
}

export enum ExchangeReconciliationStatus {
  NONE = 'NONE',
  REQUIRED = 'REQUIRED',
  IN_PROGRESS = 'IN_PROGRESS',
  RECONCILED = 'RECONCILED',
  ABANDONED = 'ABANDONED',
}

export enum ControlCallbackStatus {
  RECEIVED = 'RECEIVED',
  VALIDATED = 'VALIDATED',
  REJECTED = 'REJECTED',
  DUPLICATE = 'DUPLICATE',
  APPLIED = 'APPLIED',
  EXPIRED = 'EXPIRED',
}

export enum HealthCheckResult {
  HEALTHY = 'HEALTHY',
  DEGRADED = 'DEGRADED',
  UNAVAILABLE = 'UNAVAILABLE',
  UNKNOWN = 'UNKNOWN',
}

export enum CredentialBindingStatus {
  ACTIVE = 'ACTIVE',
  ROTATING = 'ROTATING',
  REVOKED = 'REVOKED',
  EXPIRED = 'EXPIRED',
}

export enum ProductControlHistoryResourceType {
  ENDPOINT = 'ENDPOINT',
  NEGOTIATED_CONTRACT = 'NEGOTIATED_CONTRACT',
  CAPABILITY = 'CAPABILITY',
  EXCHANGE = 'EXCHANGE',
  CALLBACK = 'CALLBACK',
  HEALTH_CHECK = 'HEALTH_CHECK',
  RECONCILIATION = 'RECONCILIATION',
  CREDENTIAL_BINDING = 'CREDENTIAL_BINDING',
}

/** Mandate error taxonomy — used for classification & retry eligibility. */
export enum ProductControlErrorCode {
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
  AUTHORIZATION_FAILED = 'AUTHORIZATION_FAILED',
  CONTRACT_INCOMPATIBLE = 'CONTRACT_INCOMPATIBLE',
  CAPABILITY_UNSUPPORTED = 'CAPABILITY_UNSUPPORTED',
  ENDPOINT_UNAVAILABLE = 'ENDPOINT_UNAVAILABLE',
  TLS_VALIDATION_FAILED = 'TLS_VALIDATION_FAILED',
  SIGNATURE_INVALID = 'SIGNATURE_INVALID',
  REQUEST_EXPIRED = 'REQUEST_EXPIRED',
  RATE_LIMITED = 'RATE_LIMITED',
  TIMEOUT = 'TIMEOUT',
  UNKNOWN_OUTCOME = 'UNKNOWN_OUTCOME',
  INVALID_RESPONSE = 'INVALID_RESPONSE',
  OPERATION_NOT_IMPLEMENTED = 'OPERATION_NOT_IMPLEMENTED',
  DEPENDENCY_UNAVAILABLE = 'DEPENDENCY_UNAVAILABLE',
  VALIDATION = 'VALIDATION',
}

/** Non-mutative foundation operations wired into P7.4. */
export const PRODUCT_CONTROL_FOUNDATION_HANDLER_KEYS = [
  'product_control.handshake',
  'product_control.discover_contract',
  'product_control.discover_capabilities',
  'product_control.verify_connectivity',
  'product_control.verify_health',
  'product_control.verify_conformance',
] as const;

export type ProductControlFoundationHandlerKey =
  (typeof PRODUCT_CONTROL_FOUNDATION_HANDLER_KEYS)[number];

/** Mutative / future keys — must stay OPERATION_NOT_IMPLEMENTED. */
export const PRODUCT_CONTROL_UNIMPLEMENTED_HANDLER_KEYS = [
  'unavailable:p75',
  'unavailable:p76',
  'unavailable:p77',
  'p7.5.product_control.provision',
  'p7.5.product_control.activate',
  'p7.6.infra.provision',
  'p7.6.database.provision',
  'p7.6.dns.provision',
  'p7.7.keycloak.realm.create',
  'p7.7.keycloak.org.create',
] as const;

export type ProductControlEndpointRecord = {
  id: string;
  productRegistryId: string;
  productId: string;
  platformId: string;
  environmentId: string | null;
  deploymentProfileId: string | null;
  registryContractId: string | null;
  code: string;
  baseUrl: string;
  apiVersion: string;
  contractVersion: string;
  authProfile: ProductControlAuthProfile | string;
  credentialRef: string;
  allowedScopes: unknown[];
  status: ProductControlEndpointStatus;
  contractFingerprint: string | null;
  identityFingerprint: string | null;
  registrationSource: string;
  lastHandshakeAt: Date | null;
  lastHandshakeStatus: string | null;
  lastHandshakeError: string | null;
  lastHealthCheckAt: Date | null;
  lastHealthStatus: string | null;
  metadata: Record<string, unknown>;
  version: number;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type NegotiatedContractRecord = {
  id: string;
  endpointId: string;
  contractVersion: string;
  fingerprint: string;
  schemaSnapshot: Record<string, unknown>;
  supportedVersions: unknown[];
  status: NegotiatedContractStatus;
  discoveredAt: Date;
  validatedAt: Date | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

export type ProductControlCapabilityRecord = {
  id: string;
  endpointId: string;
  capabilityCode: string;
  declaredAt: Date;
  metadata: Record<string, unknown>;
  createdAt: Date;
};

export type ControlExchangeRecord = {
  id: string;
  productId: string;
  endpointId: string;
  workflowId: string | null;
  stepId: string | null;
  operationCode: string;
  contractVersion: string;
  requestId: string;
  correlationId: string;
  causationId: string | null;
  idempotencyKey: string;
  requestDigest: string | null;
  responseDigest: string | null;
  requestTimestamp: Date;
  responseTimestamp: Date | null;
  status: ControlExchangeStatus;
  attemptCount: number;
  httpStatus: number | null;
  errorClassification: ProductControlErrorCode | string | null;
  durationMs: number | null;
  retryEligible: boolean;
  reconciliationStatus: ExchangeReconciliationStatus;
  requestPayload: Record<string, unknown>;
  responsePayload: Record<string, unknown>;
  diagnostics: Record<string, unknown>;
  version: number;
  createdAt: Date;
  updatedAt: Date;
};

/** Canonical discovery document returned by Product Control. */
export type ProductControlDiscoveryDocument = {
  productId: string;
  productCode: string;
  productControlId: string;
  productControlVersion: string;
  supportedProtocolVersions: string[];
  supportedContractVersions: string[];
  supportedCapabilities: string[];
  supportedOperationTypes: string[];
  authenticationMethods: string[];
  signatureAlgorithms: string[];
  callbackSupport: boolean;
  idempotencySupport: boolean;
  correlationSupport: boolean;
  healthStatus: string;
  contractFingerprint: string;
  issuedAt: string;
  expiresAt: string;
};

export type ControlCallbackRecord = {
  id: string;
  endpointId: string;
  exchangeId: string | null;
  callbackId: string;
  correlationId: string | null;
  requestId: string | null;
  receivedAt: Date;
  signatureValid: boolean | null;
  payload: Record<string, unknown>;
  status: ControlCallbackStatus;
  rejectionReason: string | null;
  idempotencyKey: string;
  createdAt: Date;
};

export type ProductControlHealthCheckRecord = {
  id: string;
  endpointId: string;
  checkedAt: Date;
  result: HealthCheckResult | string;
  latencyMs: number | null;
  httpStatus: number | null;
  errorClassification: string | null;
  details: Record<string, unknown>;
  createdAt: Date;
};

export type ProductControlReconciliationRecord = {
  id: string;
  exchangeId: string;
  endpointId: string;
  reason: string;
  status: string;
  openedAt: Date;
  resolvedAt: Date | null;
  resolvedBy: string | null;
  resolutionNotes: string | null;
  details: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

export type CredentialBindingRecord = {
  id: string;
  endpointId: string;
  credentialRef: string;
  authProfile: string;
  status: CredentialBindingStatus | string;
  boundAt: Date;
  expiresAt: Date | null;
  revokedAt: Date | null;
  revokedBy: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};
