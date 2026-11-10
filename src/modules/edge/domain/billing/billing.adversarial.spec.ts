import { describe, expect, it } from 'vitest';
import { DomainError } from '../../../../core/domain/errors/domain-error.js';
import {
  InvoiceStatus,
  PaymentIntentStatus,
  assertAllocationDoesNotExceed,
  assertInvoiceMutable,
  assertInvoiceStatusTransition,
  assertNoSelfApproval,
  assertPaymentStatusTransition,
  assertRefundDoesNotExceed,
} from './billing.entity.js';
import { computeRecognizedRevenue } from './revenue-recognition.js';

describe('P6 adversarial financial invariants', () => {
  it('rejects silent mutation of issued invoice', () => {
    expect(() => assertInvoiceMutable(InvoiceStatus.ISSUED)).toThrow(/immutable/i);
    expect(() => assertInvoiceMutable(InvoiceStatus.PAID)).toThrow(DomainError);
  });

  it('rejects webhook-style payment regression SUCCEEDED → CREATED', () => {
    expect(() =>
      assertPaymentStatusTransition(PaymentIntentStatus.SUCCEEDED, PaymentIntentStatus.CREATED),
    ).toThrow(DomainError);
  });

  it('rejects over-allocation and over-refund', () => {
    expect(() => assertAllocationDoesNotExceed('100.00', ['80.00', '30.00'], 'USD')).toThrow(
      /exceed/i,
    );
    expect(() => assertRefundDoesNotExceed('40.00', '40.01', 'EUR')).toThrow(/exceed/i);
  });

  it('rejects self-approval of refunds', () => {
    expect(() =>
      assertNoSelfApproval({ requesterId: 'user-1', decisionBy: 'user-1' }),
    ).toThrow(DomainError);
  });

  it('rejects PAID → DRAFT (history rewrite)', () => {
    expect(() =>
      assertInvoiceStatusTransition(InvoiceStatus.PAID, InvoiceStatus.DRAFT),
    ).toThrow(DomainError);
  });

  it('does not treat billed as recognized under cash policy', () => {
    const r = computeRecognizedRevenue({
      method: 'CASH_BASED_NET',
      billedTotal: '9999.00',
      collectedTotal: '10.00',
      refundedTotal: '0.00',
      currency: 'USD',
    });
    expect(r.recognizedRevenue).toBe('10.00');
    expect(r.recognizedRevenue).not.toBe(r.components.billedTotal);
  });

  it('DEFERRED_MANUAL never invents recognized revenue', () => {
    const r = computeRecognizedRevenue({
      method: 'DEFERRED_MANUAL',
      billedTotal: '500.00',
      collectedTotal: '500.00',
      refundedTotal: '0.00',
      currency: 'XOF',
    });
    expect(r.recognizedRevenue).toBeNull();
  });
});
