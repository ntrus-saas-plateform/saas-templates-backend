/**
 * P11 cash / invoice engines from P6 invoice & payment refs.
 * Contracted (MRR) ≠ invoiced ≠ collected — never collapse these.
 */

import { InvoiceStatus, PaymentIntentStatus } from '../billing/billing.entity.js';
import { unavailableUnlessPresent } from './revenue-metric-registry.js';

export type CashDataQuality = 'MEASURED' | 'UNAVAILABLE';

export type CashAmountBucket = {
  amount: number | null;
  dataQuality: CashDataQuality;
};

export type InvoiceCashRef = {
  id: string;
  status: string;
  currency: string;
  total: string | number;
  amountDue?: string | number | null;
  issueAt?: Date | string | null;
  createdAt?: Date | string | null;
};

export type PaymentCashRef = {
  id: string;
  status: string;
  currency: string;
  amount: string | number;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
};

export type CashRevenueComputation = {
  currency: string;
  invoiced: CashAmountBucket;
  collected: CashAmountBucket;
  receivables: CashAmountBucket;
  invoicedInvoiceIds: string[];
  collectedPaymentIds: string[];
  openReceivableInvoiceIds: string[];
  skippedInvoiceCount: number;
  skippedPaymentCount: number;
  notes: string[];
};

const INVOICED_STATUSES = new Set<string>([
  InvoiceStatus.ISSUED,
  InvoiceStatus.PARTIALLY_PAID,
  InvoiceStatus.PAID,
  InvoiceStatus.OVERDUE,
  InvoiceStatus.DISPUTED,
]);

const OPEN_RECEIVABLE_STATUSES = new Set<string>([
  InvoiceStatus.ISSUED,
  InvoiceStatus.PARTIALLY_PAID,
  InvoiceStatus.OVERDUE,
  InvoiceStatus.DISPUTED,
]);

/** Issued (non-draft) invoice counts toward INVOICED_REVENUE — never requires cash. */
export function isInvoicedEligible(status: string | null | undefined): boolean {
  return INVOICED_STATUSES.has(String(status ?? '').toUpperCase());
}

/** Open AR — invoiced but not fully collected. */
export function isOpenReceivable(status: string | null | undefined): boolean {
  return OPEN_RECEIVABLE_STATUSES.has(String(status ?? '').toUpperCase());
}

/**
 * Payment-intent cash success (P6).
 * SUCCEEDED is the intent terminal success; PAID kept for invoice-line paymentStatus compatibility.
 */
export function isCollectedPaymentEligible(status: string | null | undefined): boolean {
  const s = String(status ?? '').toUpperCase();
  return s === PaymentIntentStatus.SUCCEEDED || s === 'PAID';
}

function parseAmount(raw: string | number | null | undefined): number | null {
  if (raw == null || raw === '') return null;
  const n = typeof raw === 'number' ? raw : Number(String(raw).trim());
  if (!Number.isFinite(n)) return null;
  return n;
}

function inPeriod(
  when: Date | string | null | undefined,
  fallback: Date | string | null | undefined,
  periodStart: Date,
  periodEnd: Date,
): boolean {
  const raw = when ?? fallback;
  if (!raw) return false;
  const t = new Date(raw).getTime();
  if (Number.isNaN(t)) return false;
  return t >= periodStart.getTime() && t < periodEnd.getTime();
}

/**
 * Pure calculator: INVOICED / COLLECTED / RECEIVABLES from P6 refs.
 * Empty feeds → UNAVAILABLE (never silent zero MEASURED).
 */
export function computeCashRevenue(input: {
  invoices: readonly InvoiceCashRef[];
  payments: readonly PaymentCashRef[];
  periodStart: Date;
  periodEnd: Date;
  currency?: string;
}): CashRevenueComputation {
  const notes: string[] = [];
  const currencyHint =
    input.currency?.trim().toUpperCase() ||
    input.invoices[0]?.currency?.trim().toUpperCase() ||
    input.payments[0]?.currency?.trim().toUpperCase() ||
    'USD';

  let skippedInvoiceCount = 0;
  let skippedPaymentCount = 0;
  const invoicedInvoiceIds: string[] = [];
  const collectedPaymentIds: string[] = [];
  const openReceivableInvoiceIds: string[] = [];

  let invoicedSum = 0;
  let invoicedHits = 0;
  let collectedSum = 0;
  let collectedHits = 0;
  let receivablesSum = 0;
  let receivablesHits = 0;

  for (const inv of input.invoices) {
    const cur = String(inv.currency ?? '').trim().toUpperCase();
    if (input.currency && cur && cur !== currencyHint) {
      skippedInvoiceCount += 1;
      continue;
    }
    if (!isInvoicedEligible(inv.status)) {
      skippedInvoiceCount += 1;
      continue;
    }
    if (!inPeriod(inv.issueAt, inv.createdAt, input.periodStart, input.periodEnd)) {
      skippedInvoiceCount += 1;
      continue;
    }
    const total = parseAmount(inv.total);
    if (total == null) {
      skippedInvoiceCount += 1;
      notes.push(`Invoice ${inv.id} skipped: non-numeric total`);
      continue;
    }
    invoicedSum += total;
    invoicedHits += 1;
    invoicedInvoiceIds.push(inv.id);

    if (isOpenReceivable(inv.status)) {
      const due = parseAmount(inv.amountDue ?? inv.total);
      if (due != null && due > 0) {
        receivablesSum += due;
        receivablesHits += 1;
        openReceivableInvoiceIds.push(inv.id);
      }
    }
  }

  for (const pay of input.payments) {
    const cur = String(pay.currency ?? '').trim().toUpperCase();
    if (input.currency && cur && cur !== currencyHint) {
      skippedPaymentCount += 1;
      continue;
    }
    if (!isCollectedPaymentEligible(pay.status)) {
      skippedPaymentCount += 1;
      continue;
    }
    if (!inPeriod(pay.updatedAt, pay.createdAt, input.periodStart, input.periodEnd)) {
      skippedPaymentCount += 1;
      continue;
    }
    const amount = parseAmount(pay.amount);
    if (amount == null) {
      skippedPaymentCount += 1;
      notes.push(`Payment ${pay.id} skipped: non-numeric amount`);
      continue;
    }
    collectedSum += amount;
    collectedHits += 1;
    collectedPaymentIds.push(pay.id);
  }

  if (input.invoices.length === 0) {
    notes.push('No P6 invoice refs in feed — INVOICED/RECEIVABLES UNAVAILABLE when empty.');
  }
  if (input.payments.length === 0) {
    notes.push('No P6 payment refs in feed — COLLECTED UNAVAILABLE when empty.');
  }
  notes.push('Unpaid invoices never count as COLLECTED_REVENUE.');
  notes.push('VOIDED/DRAFT invoices never count as INVOICED_REVENUE.');

  const invoiced =
    invoicedHits === 0
      ? unavailableUnlessPresent(null)
      : unavailableUnlessPresent(invoicedSum);
  const collected =
    collectedHits === 0
      ? unavailableUnlessPresent(null)
      : unavailableUnlessPresent(collectedSum);
  const receivables =
    input.invoices.length === 0
      ? unavailableUnlessPresent(null)
      : unavailableUnlessPresent(receivablesHits === 0 ? 0 : receivablesSum);

  return {
    currency: currencyHint,
    invoiced: { amount: invoiced.value, dataQuality: invoiced.dataQuality },
    collected: { amount: collected.value, dataQuality: collected.dataQuality },
    receivables: {
      amount: receivables.value,
      // Empty invoice feed → UNAVAILABLE; zero open AR with invoices present → MEASURED 0
      dataQuality:
        input.invoices.length === 0 ? 'UNAVAILABLE' : receivables.dataQuality,
    },
    invoicedInvoiceIds,
    collectedPaymentIds,
    openReceivableInvoiceIds,
    skippedInvoiceCount,
    skippedPaymentCount,
    notes,
  };
}

/** Provenance marker required on manual snapshot gate for cash metrics. */
export const CASH_ENGINE_PROVENANCE_SOURCE = 'engine' as const;
export const CASH_ENGINE_CALCULATOR = 'cash-revenue-calculator' as const;
