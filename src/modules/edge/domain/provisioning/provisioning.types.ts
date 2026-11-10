export const P7_AUTHORIZATION_AUDIENCE = 'okapi.edge.p7' as const;
export const P7_AUTHORIZATION_SCHEMA_VERSION = 'p5.provisioning_authorization.v1' as const;

export enum ProvisioningAuthorizationType {
  PROVISION = 'PROVISION',
  SUSPEND = 'SUSPEND',
  RESUME = 'RESUME',
  DECOMMISSION = 'DECOMMISSION',
  UPDATE = 'UPDATE',
  MIGRATE = 'MIGRATE',
}

export enum ProvisioningAuthorizationStatus {
  ISSUED = 'ISSUED',
  ACTIVE = 'ACTIVE',
  REVOKED = 'REVOKED',
  EXPIRED = 'EXPIRED',
  SUPERSEDED = 'SUPERSEDED',
}

export enum ProvisioningDecision {
  ALLOW = 'ALLOW',
  DENY = 'DENY',
}

export enum RevocationStatus {
  NOT_REVOKED = 'NOT_REVOKED',
  REVOKED = 'REVOKED',
}

export enum AuthorizationVerificationStatus {
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
  REVOKED = 'REVOKED',
  EXPIRED = 'EXPIRED',
}

export enum ProvisioningRequestStatus {
  REQUESTED = 'REQUESTED',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
  FAILED = 'FAILED',
}

export enum ProvisioningEnvironmentSlot {
  PROD = 'PROD',
  STAGING = 'STAGING',
  DR = 'DR',
  TEMP_TEST = 'TEMP_TEST',
}

export enum SignatureAlgorithm {
  EdDSA = 'EdDSA',
  RS256 = 'RS256',
  ES256 = 'ES256',
  NONE_DIGEST_ONLY = 'none_digest_only',
}

export type CanonicalProvisioningAuthorization = {
  readonly authorization_id: string;
  readonly authorization_version: number;
  readonly schema_version: typeof P7_AUTHORIZATION_SCHEMA_VERSION | string;
  readonly authorization_type: string;
  readonly operation: string;
  readonly account_id: string;
  readonly subscription_id: string;
  readonly product_id: string;
  readonly product_tenant_id?: string | null;
  readonly correlation_id: string;
  readonly causation_id?: string | null;
  readonly idempotency_key: string;
  readonly decision: string;
  readonly authorization_status: string;
  readonly decision_reason_code?: string | null;
  readonly decision_timestamp: string;
  readonly issued_at: string;
  readonly not_before?: string | null;
  readonly expires_at?: string | null;
  readonly entitlement_snapshot_reference: string;
  readonly entitlement_version: string;
  readonly subscription_version?: string | null;
  readonly commercial_policy_version?: string | null;
  readonly contract_reference?: string | null;
  readonly billing_evaluation_reference?: string | null;
  readonly issuer: string;
  readonly audience: string;
  readonly key_id: string;
  readonly signature_algorithm: string;
  readonly signature?: string | null;
  readonly payload_digest: string;
  readonly issued_by_service_identity: string;
  readonly revocation_status: string;
  readonly revocation_version?: number | null;
  readonly revoked_at?: string | null;
  readonly revocation_reason_code?: string | null;
  readonly revocation_reference?: string | null;
  readonly environment_slot?: string | null;
  readonly extra_prod_slot_entitled?: boolean | null;
};

export type AuthorizationVerificationResult = {
  readonly ok: boolean;
  readonly status: AuthorizationVerificationStatus;
  readonly reasonCode: string | null;
  readonly details?: Record<string, unknown>;
};

export const PROVISIONING_REQUEST_TRANSITIONS: Record<
  ProvisioningRequestStatus,
  readonly ProvisioningRequestStatus[]
> = {
  [ProvisioningRequestStatus.REQUESTED]: [
    ProvisioningRequestStatus.ACCEPTED,
    ProvisioningRequestStatus.REJECTED,
    ProvisioningRequestStatus.CANCELLED,
    ProvisioningRequestStatus.FAILED,
  ],
  [ProvisioningRequestStatus.ACCEPTED]: [
    ProvisioningRequestStatus.CANCELLED,
    ProvisioningRequestStatus.FAILED,
  ],
  [ProvisioningRequestStatus.REJECTED]: [],
  [ProvisioningRequestStatus.CANCELLED]: [],
  [ProvisioningRequestStatus.FAILED]: [],
};
