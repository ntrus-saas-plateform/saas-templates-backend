import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import { PaymentIntentStatus } from './billing.entity.js';

/**
 * RGOM-E8 — payment failure must never silently unlock activation / billingConfirmed.
 */

export function isPaymentCollectedProof(status: string | null | undefined): boolean {
  const s = String(status ?? '').toUpperCase();
  return s === PaymentIntentStatus.SUCCEEDED || s === 'PAID';
}

export function isPaymentFailed(status: string | null | undefined): boolean {
  return String(status ?? '').toUpperCase() === PaymentIntentStatus.FAILED;
}

/**
 * Fail-closed: when billing is required, at least one SUCCEEDED payment must exist.
 * Failed-only intents explicitly block confirmation (no silent activation path).
 */
export function assertBillingConfirmRequiresCollectedPayment(input: {
  billingRequired: boolean;
  paymentIntentStatuses: readonly string[];
  allowWithoutCollectedCash?: boolean;
}): void {
  if (!input.billingRequired) return;
  if (input.allowWithoutCollectedCash) return;

  const statuses = input.paymentIntentStatuses.map((s) => String(s).toUpperCase());
  const hasCollected = statuses.some((s) => isPaymentCollectedProof(s));
  if (hasCollected) return;

  const hasFailed = statuses.some((s) => isPaymentFailed(s));
  if (hasFailed) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      'Cannot confirm billing coordination after payment failure without SUCCEEDED collection',
      [{ code: 'PAYMENT_FAILED_BLOCKS_BILLING_CONFIRM' }],
    );
  }

  throw new DomainError(
    ErrorCode.VALIDATION_ERROR,
    'Cannot confirm billing coordination without collected payment proof (SUCCEEDED)',
    [{ code: 'BILLING_CONFIRM_REQUIRES_COLLECTED_PAYMENT' }],
  );
}

/** Activate path: billingRequired implies billingConfirmed already, but never treat FAILED as paid. */
export function assertActivationNotAfterFailedPaymentOnly(input: {
  billingRequired: boolean;
  paymentIntentStatuses: readonly string[];
}): void {
  if (!input.billingRequired) return;
  const statuses = input.paymentIntentStatuses.map((s) => String(s).toUpperCase());
  if (statuses.length === 0) return;
  const hasCollected = statuses.some((s) => isPaymentCollectedProof(s));
  if (hasCollected) return;
  if (statuses.every((s) => isPaymentFailed(s))) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      'Cannot activate subscription when linked payments all FAILED',
      [{ code: 'PAYMENT_FAILED_BLOCKS_ACTIVATION' }],
    );
  }
}
