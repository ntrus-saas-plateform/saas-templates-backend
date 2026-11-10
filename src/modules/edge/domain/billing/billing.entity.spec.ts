import { describe, expect, it } from 'vitest';
import { DomainError } from '../../../../core/domain/errors/domain-error.js';
import {
  InvoiceStatus,
  PaymentIntentStatus,
  assertAllocationDoesNotExceed,
  assertInvoiceMutable,
  assertInvoiceStatusTransition,
  assertInvoiceTotalsConsistent,
  assertNoSelfApproval,
  assertPaymentStatusTransition,
  assertRefundDoesNotExceed,
  formatCents,
  parseMoneyToCents,
  sumInvoiceTotals,
} from './billing.entity.js';

describe('invoice status transitions', () => {
  it('allows DRAFT → PENDING_APPROVAL → APPROVED → ISSUED', () => {
    assertInvoiceStatusTransition(InvoiceStatus.DRAFT, InvoiceStatus.PENDING_APPROVAL);
    assertInvoiceStatusTransition(InvoiceStatus.PENDING_APPROVAL, InvoiceStatus.APPROVED);
    assertInvoiceStatusTransition(InvoiceStatus.APPROVED, InvoiceStatus.ISSUED);
  });

  it('allows ISSUED → PARTIALLY_PAID → PAID', () => {
    assertInvoiceStatusTransition(InvoiceStatus.ISSUED, InvoiceStatus.PARTIALLY_PAID);
    assertInvoiceStatusTransition(InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.PAID);
  });

  it('rejects PAID → DRAFT', () => {
    expect(() =>
      assertInvoiceStatusTransition(InvoiceStatus.PAID, InvoiceStatus.DRAFT),
    ).toThrow(DomainError);
  });
});

describe('invoice immutability', () => {
  it('blocks financial edits on ISSUED', () => {
    expect(() => assertInvoiceMutable(InvoiceStatus.ISSUED)).toThrow(/immutable/i);
  });

  it('allows DRAFT edits', () => {
    expect(() => assertInvoiceMutable(InvoiceStatus.DRAFT)).not.toThrow();
  });

  it('blocks PAID updates', () => {
    expect(() => assertInvoiceMutable(InvoiceStatus.PAID)).toThrow(DomainError);
  });
});

describe('payment intent transitions', () => {
  it('allows CREATED → SUCCEEDED', () => {
    assertPaymentStatusTransition(PaymentIntentStatus.CREATED, PaymentIntentStatus.SUCCEEDED);
  });

  it('rejects SUCCEEDED → CREATED', () => {
    expect(() =>
      assertPaymentStatusTransition(PaymentIntentStatus.SUCCEEDED, PaymentIntentStatus.CREATED),
    ).toThrow(DomainError);
  });
});

describe('allocation and refund caps', () => {
  it('rejects over-allocation', () => {
    expect(() =>
      assertAllocationDoesNotExceed('100.00', ['60.00', '50.00'], 'USD'),
    ).toThrow(/exceeds/i);
  });

  it('allows allocation within cap', () => {
    expect(() =>
      assertAllocationDoesNotExceed('100.00', ['40.00', '60.00'], 'USD'),
    ).not.toThrow();
  });

  it('rejects refund above refundable', () => {
    expect(() => assertRefundDoesNotExceed('50.00', '51.00', 'USD')).toThrow(/exceeds/i);
  });
});

describe('invoice totals', () => {
  it('sums lines and tax', () => {
    const t = sumInvoiceTotals({
      currency: 'USD',
      lines: [
        { quantity: 2, unitPrice: '10.00', taxAmount: '2.00' },
        { quantity: 1, unitPrice: '5.00', discountAmount: '1.00', taxAmount: '0.50' },
      ],
    });
    expect(t.subtotal).toBe('24.00');
    expect(t.taxTotal).toBe('2.50');
    expect(t.total).toBe('26.50');
  });

  it('asserts consistency', () => {
    expect(() =>
      assertInvoiceTotalsConsistent({
        currency: 'USD',
        subtotal: '24.00',
        taxTotal: '2.50',
        total: '26.50',
        lines: [
          { quantity: 2, unitPrice: '10.00', taxAmount: '2.00' },
          { quantity: 1, unitPrice: '5.00', discountAmount: '1.00', taxAmount: '0.50' },
        ],
      }),
    ).not.toThrow();
  });

  it('rejects inconsistent totals', () => {
    expect(() =>
      assertInvoiceTotalsConsistent({
        currency: 'USD',
        subtotal: '24.00',
        taxTotal: '2.50',
        total: '99.00',
        lines: [{ quantity: 1, unitPrice: '24.00', taxAmount: '2.50' }],
      }),
    ).toThrow(DomainError);
  });
});

describe('money cents helpers', () => {
  it('round-trips cents', () => {
    expect(formatCents(parseMoneyToCents('19.99'), 'USD')).toBe('19.99');
  });
});

describe('self-approval', () => {
  it('forbids same actor', () => {
    expect(() =>
      assertNoSelfApproval({ requesterId: 'user-1', decisionBy: 'user-1' }),
    ).toThrow(DomainError);
  });
});
