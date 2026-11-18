/**
 * RGOM-E8 — contracted ≠ invoiced ≠ collected (never collapse).
 * Contracted = commercial commitment on active-like subscriptions (MRR-normalized).
 * Invoiced / collected / receivables reuse cash-revenue-calculator semantics.
 */

import { normalizeToMonthlyMrr } from '../revenue-operations/mrr-calculator.js';
import {
  computeCashRevenue,
  type CashAmountBucket,
  type CashRevenueComputation,
  type InvoiceCashRef,
  type PaymentCashRef,
} from '../revenue-operations/cash-revenue-calculator.js';

export type ContractedSubscriptionRef = {
  id: string;
  status: string;
  currency: string;
  billingFrequency?: string | null;
  commercialSnapshot?: Record<string, unknown> | null;
  isTrial?: boolean;
};

export type BillingCashTruth = {
  currency: string;
  contracted: CashAmountBucket;
  invoiced: CashAmountBucket;
  collected: CashAmountBucket;
  receivables: CashAmountBucket;
  contractedSubscriptionIds: string[];
  invoicedInvoiceIds: string[];
  collectedPaymentIds: string[];
  openReceivableInvoiceIds: string[];
  skippedContractedCount: number;
  skippedInvoiceCount: number;
  skippedPaymentCount: number;
  notes: string[];
};

const CONTRACTED_STATUSES = new Set([
  'ACTIVE',
  'TRIALING',
  'PAST_DUE',
  'PENDING_CANCELLATION',
]);

export function isContractedEligibleStatus(status: string | null | undefined): boolean {
  return CONTRACTED_STATUSES.has(String(status ?? '').toUpperCase());
}

function parseAmount(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  const n = typeof raw === 'number' ? raw : Number(String(raw).trim());
  if (!Number.isFinite(n)) return null;
  return n;
}

/** Extract recurring commercial amount from subscription snapshot (fail-closed on missing). */
export function extractContractedAmount(
  snapshot: Record<string, unknown> | null | undefined,
): number | null {
  if (!snapshot) return null;
  const candidates = [
    snapshot.mrr,
    snapshot.monthlyAmount,
    snapshot.amount,
    snapshot.total,
    snapshot.recurringAmount,
    snapshot.contractedAmount,
  ];
  for (const c of candidates) {
    const n = parseAmount(c);
    if (n != null) return n;
  }
  return null;
}

export function computeContractedRevenue(input: {
  subscriptions: readonly ContractedSubscriptionRef[];
  currency?: string;
  excludeFreeTrials?: boolean;
}): {
  contracted: CashAmountBucket;
  contractedSubscriptionIds: string[];
  skippedContractedCount: number;
  currency: string;
  notes: string[];
} {
  const excludeTrials = input.excludeFreeTrials !== false;
  const notes: string[] = [];
  const currencyHint =
    input.currency?.trim().toUpperCase() ||
    input.subscriptions[0]?.currency?.trim().toUpperCase() ||
    'USD';

  let sum = 0;
  let hits = 0;
  let skipped = 0;
  const ids: string[] = [];

  for (const sub of input.subscriptions) {
    const cur = String(sub.currency ?? '').trim().toUpperCase();
    if (input.currency && cur && cur !== currencyHint) {
      skipped += 1;
      continue;
    }
    if (!isContractedEligibleStatus(sub.status)) {
      skipped += 1;
      continue;
    }
    if (excludeTrials && (sub.isTrial || String(sub.status).toUpperCase() === 'TRIALING')) {
      const amount = extractContractedAmount(sub.commercialSnapshot ?? undefined);
      if (amount == null || amount === 0) {
        skipped += 1;
        continue;
      }
    }
    const raw = extractContractedAmount(sub.commercialSnapshot ?? undefined);
    if (raw == null) {
      skipped += 1;
      notes.push(`Subscription ${sub.id} skipped: no contracted amount in commercialSnapshot`);
      continue;
    }
    const period = sub.billingFrequency ?? 'MONTHLY';
    const monthly = normalizeToMonthlyMrr(raw, period);
    if (!Number.isFinite(monthly)) {
      skipped += 1;
      continue;
    }
    // Snapshot amount already monthly when key is mrr/monthlyAmount; normalizeToMonthlyMrr
    // for ANNUAL commercial totals. If snapshot used `amount` as period total, frequency applies.
    sum += monthly;
    hits += 1;
    ids.push(sub.id);
  }

  if (input.subscriptions.length === 0) {
    notes.push('No subscription refs — CONTRACTED UNAVAILABLE (never silent zero MEASURED).');
  }
  notes.push('CONTRACTED is commercial commitment (MRR-normalized), not invoiced or collected cash.');

  return {
    currency: currencyHint,
    contracted:
      hits === 0
        ? { amount: null, dataQuality: 'UNAVAILABLE' }
        : { amount: sum, dataQuality: 'MEASURED' },
    contractedSubscriptionIds: ids,
    skippedContractedCount: skipped,
    notes,
  };
}

/**
 * Assemble billing cash truth triad (+ receivables).
 * Never invent MEASURED zeros when feeds are empty.
 */
export function assembleBillingCashTruth(input: {
  subscriptions: readonly ContractedSubscriptionRef[];
  invoices: readonly InvoiceCashRef[];
  payments: readonly PaymentCashRef[];
  periodStart: Date;
  periodEnd: Date;
  currency?: string;
  excludeFreeTrials?: boolean;
}): BillingCashTruth {
  const contracted = computeContractedRevenue({
    subscriptions: input.subscriptions,
    currency: input.currency,
    excludeFreeTrials: input.excludeFreeTrials,
  });
  const cash: CashRevenueComputation = computeCashRevenue({
    invoices: input.invoices,
    payments: input.payments,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    currency: input.currency ?? contracted.currency,
  });

  const notes = [
    ...contracted.notes,
    ...cash.notes,
    'Doctrine: contracted ≠ invoiced ≠ collected — do not equate buckets in UI or exports.',
  ];

  return {
    currency: cash.currency || contracted.currency,
    contracted: contracted.contracted,
    invoiced: cash.invoiced,
    collected: cash.collected,
    receivables: cash.receivables,
    contractedSubscriptionIds: contracted.contractedSubscriptionIds,
    invoicedInvoiceIds: cash.invoicedInvoiceIds,
    collectedPaymentIds: cash.collectedPaymentIds,
    openReceivableInvoiceIds: cash.openReceivableInvoiceIds,
    skippedContractedCount: contracted.skippedContractedCount,
    skippedInvoiceCount: cash.skippedInvoiceCount,
    skippedPaymentCount: cash.skippedPaymentCount,
    notes,
  };
}
