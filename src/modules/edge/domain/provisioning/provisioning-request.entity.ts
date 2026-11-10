import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import {
  PROVISIONING_REQUEST_TRANSITIONS,
  ProvisioningEnvironmentSlot,
  ProvisioningRequestStatus,
} from './provisioning.types.js';

export type ProvisioningRequestProps = {
  id: string;
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
  environmentSlot: ProvisioningEnvironmentSlot;
  idempotencyKey: string;
  deduplicationReference: string | null;
  payloadDigest: string | null;
  entitlementSnapshotReference: string | null;
  policyVersion: string | null;
  rejectionReasonCode: string | null;
  cancellationReason: string | null;
  source: string;
  createdBy: string | null;
  lastActor: string | null;
  metadata: Record<string, unknown>;
  receivedAt: Date;
  acceptedAt: Date | null;
  rejectedAt: Date | null;
  cancelledAt: Date | null;
  failedAt: Date | null;
  lastTransitionAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

export function assertProvisioningRequestTransition(
  from: ProvisioningRequestStatus,
  to: ProvisioningRequestStatus,
): void {
  if (from === to) return;
  const allowed = PROVISIONING_REQUEST_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw new DomainError(
      ErrorCode.INVALID_STATE_TRANSITION,
      `Provisioning request transition ${from} → ${to} is not allowed`,
      [{ from, to }],
    );
  }
}

/** P7.1 must never represent technical ACTIVE tenant state. */
export function assertNotTechnicalActiveLabel(status: string): void {
  if (status === 'ACTIVE' || status === 'PROVISIONING' || status === 'READY') {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      'P7.1 request status must not use technical ACTIVE/PROVISIONING/READY labels',
      [{ status }],
    );
  }
}

export function assertEnvironmentSlotRules(input: {
  slot: ProvisioningEnvironmentSlot;
  slotEntitled?: boolean | null;
}): void {
  if (input.slot === ProvisioningEnvironmentSlot.PROD) return;
  if (input.slotEntitled !== true) {
    throw new DomainError(
      ErrorCode.FORBIDDEN,
      'Non-PROD environment slots require explicit P5 entitlement',
      [{ slot: input.slot }],
    );
  }
}

export function assertAccountProductIntegrity(input: {
  authAccountId: string;
  authProductId: string;
  authSubscriptionId: string;
  requestAccountId: string;
  requestProductId: string;
  requestSubscriptionId: string;
}): void {
  if (input.authAccountId !== input.requestAccountId) {
    throw new DomainError(ErrorCode.FORBIDDEN, 'Authorization account mismatch', [
      { field: 'account_id' },
    ]);
  }
  if (input.authProductId !== input.requestProductId) {
    throw new DomainError(ErrorCode.FORBIDDEN, 'Authorization product mismatch', [
      { field: 'product_id' },
    ]);
  }
  if (input.authSubscriptionId !== input.requestSubscriptionId) {
    throw new DomainError(ErrorCode.FORBIDDEN, 'Authorization subscription mismatch', [
      { field: 'subscription_id' },
    ]);
  }
}

/**
 * Tenant reuse is never automatic (OQ-02). P7.1 only records eligibility intent;
 * it does not create or bind infrastructure.
 */
export function evaluateConditionalTenantReuse(input: {
  proposedProductTenantId: string | null | undefined;
  sameAccount: boolean;
  sameProduct: boolean;
  lifecycleCompatible: boolean;
  legalHold: boolean;
  securityHold: boolean;
  explicitReuseApproved: boolean;
}): { reuse: boolean; reasonCode: string } {
  if (!input.proposedProductTenantId) {
    return { reuse: false, reasonCode: 'NO_EXISTING_TENANT' };
  }
  if (!input.sameAccount || !input.sameProduct) {
    return { reuse: false, reasonCode: 'ACCOUNT_OR_PRODUCT_MISMATCH' };
  }
  if (input.legalHold) return { reuse: false, reasonCode: 'LEGAL_HOLD' };
  if (input.securityHold) return { reuse: false, reasonCode: 'SECURITY_HOLD' };
  if (!input.lifecycleCompatible) {
    return { reuse: false, reasonCode: 'LIFECYCLE_INCOMPATIBLE' };
  }
  if (!input.explicitReuseApproved) {
    return { reuse: false, reasonCode: 'REUSE_NOT_EXPLICITLY_APPROVED' };
  }
  return { reuse: true, reasonCode: 'CONDITIONAL_REUSE_ELIGIBLE' };
}
