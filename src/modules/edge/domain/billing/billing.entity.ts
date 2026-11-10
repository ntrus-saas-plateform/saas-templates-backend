import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import {
  addMoney,
  formatMoneyAmount,
  parseMoneyAmount,
} from '../commercial/pricing-math.js';

/** Aligns with edge_invoices.status CHECK (091). */
export enum InvoiceStatus {
  DRAFT = 'DRAFT',
  PENDING_VALIDATION = 'PENDING_VALIDATION',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  APPROVED = 'APPROVED',
  ISSUED = 'ISSUED',
  PARTIALLY_PAID = 'PARTIALLY_PAID',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
  DISPUTED = 'DISPUTED',
  VOIDED = 'VOIDED',
  WRITTEN_OFF = 'WRITTEN_OFF',
}

/** Aligns with edge_payment_intents.status CHECK (092). */
export enum PaymentIntentStatus {
  CREATED = 'CREATED',
  REQUIRES_ACTION = 'REQUIRES_ACTION',
  PROCESSING = 'PROCESSING',
  AUTHORIZED = 'AUTHORIZED',
  CAPTURED = 'CAPTURED',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
}

/** Aligns with edge_refunds.status CHECK (092). */
export enum RefundStatus {
  REQUESTED = 'REQUESTED',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  APPROVED = 'APPROVED',
  PROCESSING = 'PROCESSING',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

/** Aligns with edge_collection_cases.status CHECK (092). */
export enum CollectionCaseStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  ESCALATED = 'ESCALATED',
  RESOLVED = 'RESOLVED',
  WRITTEN_OFF = 'WRITTEN_OFF',
}

/** Aligns with edge_reconciliation_exceptions.status CHECK (092). */
export enum ReconciliationExceptionStatus {
  OPEN = 'OPEN',
  RESOLVED = 'RESOLVED',
}

const INVOICE_TRANSITIONS: Record<InvoiceStatus, readonly InvoiceStatus[]> = {
  [InvoiceStatus.DRAFT]: [
    InvoiceStatus.PENDING_VALIDATION,
    InvoiceStatus.PENDING_APPROVAL,
    InvoiceStatus.VOIDED,
  ],
  [InvoiceStatus.PENDING_VALIDATION]: [
    InvoiceStatus.DRAFT,
    InvoiceStatus.PENDING_APPROVAL,
    InvoiceStatus.VOIDED,
  ],
  [InvoiceStatus.PENDING_APPROVAL]: [
    InvoiceStatus.DRAFT,
    InvoiceStatus.APPROVED,
    InvoiceStatus.VOIDED,
  ],
  [InvoiceStatus.APPROVED]: [InvoiceStatus.ISSUED, InvoiceStatus.VOIDED],
  [InvoiceStatus.ISSUED]: [
    InvoiceStatus.PARTIALLY_PAID,
    InvoiceStatus.PAID,
    InvoiceStatus.OVERDUE,
    InvoiceStatus.DISPUTED,
    InvoiceStatus.VOIDED,
    InvoiceStatus.WRITTEN_OFF,
  ],
  [InvoiceStatus.PARTIALLY_PAID]: [
    InvoiceStatus.PAID,
    InvoiceStatus.OVERDUE,
    InvoiceStatus.DISPUTED,
    InvoiceStatus.WRITTEN_OFF,
  ],
  [InvoiceStatus.PAID]: [InvoiceStatus.DISPUTED],
  [InvoiceStatus.OVERDUE]: [
    InvoiceStatus.PARTIALLY_PAID,
    InvoiceStatus.PAID,
    InvoiceStatus.DISPUTED,
    InvoiceStatus.WRITTEN_OFF,
  ],
  [InvoiceStatus.DISPUTED]: [
    InvoiceStatus.ISSUED,
    InvoiceStatus.PARTIALLY_PAID,
    InvoiceStatus.PAID,
    InvoiceStatus.OVERDUE,
    InvoiceStatus.VOIDED,
    InvoiceStatus.WRITTEN_OFF,
  ],
  [InvoiceStatus.VOIDED]: [],
  [InvoiceStatus.WRITTEN_OFF]: [],
};

const PAYMENT_INTENT_TRANSITIONS: Record<
  PaymentIntentStatus,
  readonly PaymentIntentStatus[]
> = {
  [PaymentIntentStatus.CREATED]: [
    PaymentIntentStatus.REQUIRES_ACTION,
    PaymentIntentStatus.PROCESSING,
    PaymentIntentStatus.SUCCEEDED,
    PaymentIntentStatus.FAILED,
    PaymentIntentStatus.CANCELLED,
    PaymentIntentStatus.EXPIRED,
  ],
  [PaymentIntentStatus.REQUIRES_ACTION]: [
    PaymentIntentStatus.PROCESSING,
    PaymentIntentStatus.SUCCEEDED,
    PaymentIntentStatus.FAILED,
    PaymentIntentStatus.CANCELLED,
    PaymentIntentStatus.EXPIRED,
  ],
  [PaymentIntentStatus.PROCESSING]: [
    PaymentIntentStatus.AUTHORIZED,
    PaymentIntentStatus.CAPTURED,
    PaymentIntentStatus.SUCCEEDED,
    PaymentIntentStatus.FAILED,
    PaymentIntentStatus.CANCELLED,
  ],
  [PaymentIntentStatus.AUTHORIZED]: [
    PaymentIntentStatus.CAPTURED,
    PaymentIntentStatus.SUCCEEDED,
    PaymentIntentStatus.FAILED,
    PaymentIntentStatus.CANCELLED,
  ],
  [PaymentIntentStatus.CAPTURED]: [
    PaymentIntentStatus.SUCCEEDED,
    PaymentIntentStatus.FAILED,
  ],
  [PaymentIntentStatus.SUCCEEDED]: [],
  [PaymentIntentStatus.FAILED]: [PaymentIntentStatus.CREATED],
  [PaymentIntentStatus.CANCELLED]: [],
  [PaymentIntentStatus.EXPIRED]: [],
};

/** Invoice financial fields locked once issued (091 domain policy). */
const ISSUED_AND_BEYOND = new Set<InvoiceStatus>([
  InvoiceStatus.ISSUED,
  InvoiceStatus.PARTIALLY_PAID,
  InvoiceStatus.PAID,
  InvoiceStatus.OVERDUE,
  InvoiceStatus.DISPUTED,
  InvoiceStatus.VOIDED,
  InvoiceStatus.WRITTEN_OFF,
]);

export function assertInvoiceStatusTransition(
  from: InvoiceStatus | string,
  to: InvoiceStatus | string,
): void {
  const allowed = INVOICE_TRANSITIONS[from as InvoiceStatus] ?? [];
  if (!allowed.includes(to as InvoiceStatus)) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      `Invalid invoice transition ${from} → ${to}`,
    );
  }
}

export function assertInvoiceMutable(status: InvoiceStatus | string): void {
  if (ISSUED_AND_BEYOND.has(status as InvoiceStatus)) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      `Invoice in status ${status} is immutable — use credit note, void, or reversing entry`,
    );
  }
}

export function assertPaymentStatusTransition(
  from: PaymentIntentStatus | string,
  to: PaymentIntentStatus | string,
): void {
  const allowed = PAYMENT_INTENT_TRANSITIONS[from as PaymentIntentStatus] ?? [];
  if (!allowed.includes(to as PaymentIntentStatus)) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      `Invalid payment intent transition ${from} → ${to}`,
    );
  }
}

export function parseMoneyToCents(amount: string, currency = 'USD'): bigint {
  const money = parseMoneyAmount(amount, currency);
  return money.units / 10_000n;
}

export function formatCents(cents: bigint, currency = 'USD'): string {
  const money = { currency, units: cents * 10_000n };
  return formatMoneyAmount(money);
}

export function sumInvoiceTotals(input: {
  currency: string;
  lines: readonly {
    quantity: string | number;
    unitPrice: string;
    discountAmount?: string;
    taxAmount?: string;
    lineTotal?: string;
  }[];
  taxLines?: readonly { taxAmount: string }[];
}): { subtotal: string; taxTotal: string; total: string } {
  const cur = input.currency;
  let subtotal = parseMoneyAmount('0', cur);
  let taxFromLines = parseMoneyAmount('0', cur);

  for (const line of input.lines) {
    const qty =
      typeof line.quantity === 'number'
        ? line.quantity
        : Number.parseFloat(String(line.quantity));
    if (!Number.isFinite(qty) || qty < 0) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Invalid line quantity', [
        { quantity: line.quantity },
      ]);
    }
    const unit = parseMoneyAmount(line.unitPrice, cur);
    let lineAmount = { currency: cur, units: unit.units * BigInt(Math.round(qty * 1_000_000)) / 1_000_000n };
    const discount = parseMoneyAmount(line.discountAmount ?? '0', cur);
    lineAmount = addMoney(lineAmount, {
      currency: cur,
      units: -discount.units,
    });
    subtotal = addMoney(subtotal, lineAmount);
    taxFromLines = addMoney(
      taxFromLines,
      parseMoneyAmount(line.taxAmount ?? '0', cur),
    );
  }

  let taxTotal = taxFromLines;
  if (input.taxLines?.length) {
    taxTotal = parseMoneyAmount('0', cur);
    for (const t of input.taxLines) {
      taxTotal = addMoney(taxTotal, parseMoneyAmount(t.taxAmount, cur));
    }
  }

  const total = addMoney(subtotal, taxTotal);
  return {
    subtotal: formatMoneyAmount(subtotal),
    taxTotal: formatMoneyAmount(taxTotal),
    total: formatMoneyAmount(total),
  };
}

export function assertInvoiceTotalsConsistent(input: {
  currency: string;
  subtotal: string;
  taxTotal: string;
  total: string;
  discountTotal?: string;
  lines: readonly {
    quantity: string | number;
    unitPrice: string;
    discountAmount?: string;
    taxAmount?: string;
  }[];
  taxLines?: readonly { taxAmount: string }[];
}): void {
  const computed = sumInvoiceTotals({
    currency: input.currency,
    lines: input.lines,
    taxLines: input.taxLines,
  });
  const discount = parseMoneyAmount(input.discountTotal ?? '0', input.currency);
  let expectedTotal = parseMoneyAmount(computed.total, input.currency);
  expectedTotal = addMoney(expectedTotal, { currency: input.currency, units: -discount.units });

  const sub = parseMoneyAmount(input.subtotal, input.currency);
  const tax = parseMoneyAmount(input.taxTotal, input.currency);
  const total = parseMoneyAmount(input.total, input.currency);
  const compSub = parseMoneyAmount(computed.subtotal, input.currency);
  const compTax = parseMoneyAmount(computed.taxTotal, input.currency);

  if (sub.units !== compSub.units || tax.units !== compTax.units || total.units !== expectedTotal.units) {
    throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Invoice totals are inconsistent with lines', [
      {
        subtotal: input.subtotal,
        taxTotal: input.taxTotal,
        total: input.total,
        computed,
      },
    ]);
  }
}

export function assertAllocationDoesNotExceed(
  available: string,
  allocations: readonly string[],
  currency: string,
): void {
  let sum = parseMoneyAmount('0', currency);
  for (const a of allocations) {
    sum = addMoney(sum, parseMoneyAmount(a, currency));
  }
  const avail = parseMoneyAmount(available, currency);
  if (sum.units > avail.units) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      'Payment allocation exceeds available captured amount',
      [{ available, allocated: formatMoneyAmount(sum) }],
    );
  }
}

export function assertRefundDoesNotExceed(
  refundable: string,
  amount: string,
  currency: string,
): void {
  const ref = parseMoneyAmount(refundable, currency);
  const amt = parseMoneyAmount(amount, currency);
  if (amt.units > ref.units) {
    throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Refund exceeds refundable balance', [
      { refundable, amount },
    ]);
  }
  if (amt.units <= 0n) {
    throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Refund amount must be positive', [
      { amount },
    ]);
  }
}

export function assertNoSelfApproval(input: {
  requesterId: string;
  decisionBy: string;
}): void {
  if (input.requesterId === input.decisionBy) {
    throw new DomainError(ErrorCode.FORBIDDEN, 'Self-approval of billing exceptions is forbidden');
  }
}
