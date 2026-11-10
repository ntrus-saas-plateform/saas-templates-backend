import type {
  AuthorizationVerificationStatus,
  CanonicalProvisioningAuthorization,
  ProvisioningEnvironmentSlot,
  ProvisioningRequestStatus,
  RevocationStatus,
} from './provisioning.types.js';
import type { ProvisioningRequestProps } from './provisioning-request.entity.js';

export const PROVISIONING_REPOSITORY_PORT = Symbol('PROVISIONING_REPOSITORY_PORT');

export type StoredProvisioningAuthorization = {
  id: string;
  authorizationId: string;
  authorizationVersion: number;
  schemaVersion: string;
  authorizationType: string;
  operation: string;
  accountId: string;
  subscriptionId: string;
  productId: string;
  productTenantId: string | null;
  correlationId: string;
  causationId: string | null;
  idempotencyKey: string;
  decision: string;
  authorizationStatus: string;
  decisionReasonCode: string | null;
  decisionTimestamp: Date;
  issuedAt: Date;
  notBefore: Date | null;
  expiresAt: Date | null;
  entitlementSnapshotReference: string;
  entitlementVersion: string;
  issuer: string;
  audience: string;
  keyId: string;
  signatureAlgorithm: string;
  payloadDigest: string;
  signaturePresent: boolean;
  issuedByServiceIdentity: string;
  revocationStatus: RevocationStatus | string;
  revocationVersion: number | null;
  revokedAt: Date | null;
  revocationReasonCode: string | null;
  revocationReference: string | null;
  environmentSlot: ProvisioningEnvironmentSlot | string;
  verificationStatus: AuthorizationVerificationStatus | string;
  verificationReasonCode: string | null;
  verifiedAt: Date | null;
  payloadSnapshot: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

export type ProvisioningRequestHistoryEntry = {
  id: string;
  requestId: string;
  previousStatus: string | null;
  newStatus: string;
  actorType: string;
  actorId: string | null;
  source: string;
  reasonCode: string | null;
  occurredAt: Date;
  correlationId: string | null;
  causationId: string | null;
  metadata: Record<string, unknown>;
};

export type ListProvisioningRequestsFilter = {
  status?: string;
  accountId?: string;
  productId?: string;
  subscriptionId?: string;
  environmentSlot?: string;
  from?: Date;
  to?: Date;
  limit: number;
  offset: number;
};

export type ProvisioningRequestStats = {
  total: number;
  requested: number;
  accepted: number;
  rejected: number;
  cancelled: number;
  failed: number;
};

export interface ProvisioningRepositoryPort {
  upsertAuthorization(input: {
    auth: CanonicalProvisioningAuthorization;
    environmentSlot: string;
    verificationStatus: string;
    verificationReasonCode: string | null;
    verifiedAt: Date | null;
    signaturePresent: boolean;
  }): Promise<StoredProvisioningAuthorization>;

  getAuthorizationByVersion(
    authorizationId: string,
    authorizationVersion: number,
  ): Promise<StoredProvisioningAuthorization | null>;

  getAuthorizationById(id: string): Promise<StoredProvisioningAuthorization | null>;

  markAuthorizationRevoked(input: {
    authorizationId: string;
    revocationVersion: number;
    revokedAt: Date;
    reasonCode: string | null;
    reference: string | null;
  }): Promise<StoredProvisioningAuthorization | null>;

  findRequestByAuthOpVersion(
    authorizationId: string,
    operation: string,
    authorizationVersion: number,
  ): Promise<ProvisioningRequestProps | null>;

  findRequestByIdempotencyKey(key: string): Promise<ProvisioningRequestProps | null>;

  getRequestById(id: string): Promise<ProvisioningRequestProps | null>;

  createRequest(input: {
    requestNumber: string;
    authorizationId: string;
    authorizationVersion: number;
    authorizationRowId: string | null;
    operation: string;
    accountId: string;
    productId: string;
    subscriptionId: string;
    productTenantId: string | null;
    correlationId: string;
    causationId: string | null;
    requestStatus: ProvisioningRequestStatus;
    environmentSlot: string;
    idempotencyKey: string;
    deduplicationReference: string | null;
    payloadDigest: string | null;
    entitlementSnapshotReference: string | null;
    policyVersion: string | null;
    rejectionReasonCode: string | null;
    source: string;
    createdBy: string | null;
    lastActor: string | null;
    metadata: Record<string, unknown>;
    acceptedAt?: Date | null;
    rejectedAt?: Date | null;
  }): Promise<ProvisioningRequestProps>;

  transitionRequest(input: {
    id: string;
    fromStatus: ProvisioningRequestStatus;
    toStatus: ProvisioningRequestStatus;
    actorType: string;
    actorId: string | null;
    source: string;
    reasonCode: string | null;
    correlationId: string | null;
    causationId: string | null;
    cancellationReason?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<ProvisioningRequestProps>;

  listRequests(
    filter: ListProvisioningRequestsFilter,
  ): Promise<{ items: ProvisioningRequestProps[]; total: number }>;

  listRequestHistory(requestId: string): Promise<ProvisioningRequestHistoryEntry[]>;

  getRequestStats(): Promise<ProvisioningRequestStats>;

  recordRevocationInbox(input: {
    eventId: string;
    authorizationId: string;
    revocationVersion: number;
    eventName: string;
    payload: Record<string, unknown>;
    outcome: string;
    rejectionReason: string | null;
  }): Promise<{ duplicate: boolean }>;

  /**
   * Atomically record inbox + apply revocation (monotonic version).
   * Stale/out-of-order versions → IGNORED_STALE (never reported as APPLIED).
   */
  applyRevocationAtomically(input: {
    eventId: string;
    authorizationId: string;
    revocationVersion: number;
    eventName: string;
    payload: Record<string, unknown>;
    revokedAt: Date;
    reasonCode: string | null;
    reference: string | null;
  }): Promise<{
    outcome: 'APPLIED' | 'DUPLICATE' | 'IGNORED_STALE';
    authorization: StoredProvisioningAuthorization | null;
  }>;
}
