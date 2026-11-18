import { describe, expect, it } from 'vitest';
import { DomainError } from '../../../../core/domain/errors/domain-error.js';
import {
  assertActivationNotAfterFailedPaymentOnly,
  assertBillingConfirmRequiresCollectedPayment,
} from './payment-activation-guard.js';

describe('payment-activation-guard', () => {
  it('blocks billing confirm when only FAILED intents exist', () => {
    expect(() =>
      assertBillingConfirmRequiresCollectedPayment({
        billingRequired: true,
        paymentIntentStatuses: ['FAILED'],
      }),
    ).toThrow(DomainError);
  });

  it('allows billing confirm with SUCCEEDED proof', () => {
    expect(() =>
      assertBillingConfirmRequiresCollectedPayment({
        billingRequired: true,
        paymentIntentStatuses: ['FAILED', 'SUCCEEDED'],
      }),
    ).not.toThrow();
  });

  it('blocks activation when all linked payments FAILED', () => {
    expect(() =>
      assertActivationNotAfterFailedPaymentOnly({
        billingRequired: true,
        paymentIntentStatuses: ['FAILED', 'FAILED'],
      }),
    ).toThrow(/linked payments all FAILED/);
  });
});
