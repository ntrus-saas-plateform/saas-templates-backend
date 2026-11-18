import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';

/**
 * RGOM-E8 — Billing cadence + setup fees.
 * Recurring commitment ≠ one-time setup ≠ collected cash.
 */

export const BILLING_FREQUENCIES = [
  'MONTHLY',
  'QUARTERLY',
  'SEMI_ANNUAL',
  'ANNUAL',
  'ENTERPRISE_CONTRACT',
  'ONE_TIME',
  'CUSTOM',
] as const;

export type BillingFrequency = (typeof BILLING_FREQUENCIES)[number];

export type InvoiceLineKind = 'RECURRING' | 'SETUP_FEE' | 'ONE_TIME' | 'CREDIT' | 'OTHER';

export type BuiltInvoiceLine = {
  lineNumber: number;
  description: string;
  quantity: string;
  unitPrice: string;
  discountAmount: string;
  taxAmount: string;
  taxableAmount: string;
  lineTotal: string;
  planRef?: string | null;
  metadata: {
    lineKind: InvoiceLineKind;
    billingFrequency?: string;
    setupFee?: boolean;
    enterpriseContract?: boolean;
  };
};

export function normalizeBillingFrequency(raw: string | null | undefined): BillingFrequency {
  const v = String(raw ?? 'MONTHLY').trim().toUpperCase();
  if ((BILLING_FREQUENCIES as readonly string[]).includes(v)) {
    return v as BillingFrequency;
  }
  throw new DomainError(
    ErrorCode.VALIDATION_ERROR,
    `Unsupported billing frequency: ${raw}`,
    [{ code: 'UNSUPPORTED_BILLING_FREQUENCY', value: raw }],
  );
}

/** Schedule frequency stored in edge_billing_schedules (ENTERPRISE_CONTRACT → CUSTOM). */
export function toScheduleFrequency(frequency: BillingFrequency): string {
  if (frequency === 'ENTERPRISE_CONTRACT') return 'CUSTOM';
  return frequency;
}

export function isRecurringFrequency(frequency: BillingFrequency): boolean {
  return (
    frequency === 'MONTHLY' ||
    frequency === 'QUARTERLY' ||
    frequency === 'SEMI_ANNUAL' ||
    frequency === 'ANNUAL'
  );
}

export function extractSetupFeeAmount(
  snapshot: Record<string, unknown> | null | undefined,
): string | null {
  if (!snapshot) return null;
  const candidates = [
    snapshot.setupFee,
    snapshot.setupFeeAmount,
    snapshot.setup_fee,
    snapshot.oneTimeSetupFee,
  ];
  for (const c of candidates) {
    if (c == null || c === '') continue;
    const n = typeof c === 'number' ? c : Number(String(c).trim());
    if (Number.isFinite(n) && n > 0) {
      return n.toFixed(2);
    }
  }
  return null;
}

export function extractRecurringAmount(
  snapshot: Record<string, unknown> | null | undefined,
): string {
  if (!snapshot) return '0.00';
  const candidates = [
    snapshot.amount,
    snapshot.total,
    snapshot.recurringAmount,
    snapshot.mrr,
    snapshot.monthlyAmount,
  ];
  for (const c of candidates) {
    if (c == null || c === '') continue;
    const n = typeof c === 'number' ? c : Number(String(c).trim());
    if (Number.isFinite(n) && n >= 0) return n.toFixed(2);
  }
  return '0.00';
}

/**
 * Build draft invoice lines from subscription commercial snapshot.
 * Setup fee is one-time — only when includeSetupFee=true (first bill).
 */
export function buildSubscriptionInvoiceLines(input: {
  subscriptionNumber: string;
  planId?: string | null;
  billingFrequency?: string | null;
  commercialSnapshot?: Record<string, unknown> | null;
  includeSetupFee?: boolean;
  currency?: string;
}): BuiltInvoiceLine[] {
  const frequency = normalizeBillingFrequency(input.billingFrequency ?? 'MONTHLY');
  const recurring = extractRecurringAmount(input.commercialSnapshot ?? undefined);
  const lines: BuiltInvoiceLine[] = [];

  const recurringLabel =
    frequency === 'ENTERPRISE_CONTRACT'
      ? `Enterprise contract — ${input.subscriptionNumber}`
      : frequency === 'ANNUAL'
        ? `Annual subscription — ${input.subscriptionNumber}`
        : frequency === 'ONE_TIME'
          ? `One-time charge — ${input.subscriptionNumber}`
          : `Subscription ${input.subscriptionNumber} (${frequency})`;

  lines.push({
    lineNumber: 1,
    description: recurringLabel,
    quantity: '1',
    unitPrice: recurring,
    discountAmount: '0',
    taxAmount: '0',
    taxableAmount: recurring,
    lineTotal: recurring,
    planRef: input.planId ?? null,
    metadata: {
      lineKind: frequency === 'ONE_TIME' ? 'ONE_TIME' : 'RECURRING',
      billingFrequency: frequency,
      enterpriseContract: frequency === 'ENTERPRISE_CONTRACT',
    },
  });

  if (input.includeSetupFee) {
    const setup = extractSetupFeeAmount(input.commercialSnapshot ?? undefined);
    if (setup) {
      lines.push({
        lineNumber: 2,
        description: `Setup fee — ${input.subscriptionNumber}`,
        quantity: '1',
        unitPrice: setup,
        discountAmount: '0',
        taxAmount: '0',
        taxableAmount: setup,
        lineTotal: setup,
        planRef: input.planId ?? null,
        metadata: {
          lineKind: 'SETUP_FEE',
          setupFee: true,
          billingFrequency: frequency,
        },
      });
    }
  }

  return lines;
}

/** Advance next bill date; ENTERPRISE_CONTRACT / ONE_TIME / CUSTOM → null (manual). */
export function nextBillAtForFrequency(from: Date, frequency: BillingFrequency): Date | null {
  if (
    frequency === 'ONE_TIME' ||
    frequency === 'CUSTOM' ||
    frequency === 'ENTERPRISE_CONTRACT'
  ) {
    return null;
  }
  const d = new Date(from);
  switch (frequency) {
    case 'MONTHLY':
      d.setUTCMonth(d.getUTCMonth() + 1);
      break;
    case 'QUARTERLY':
      d.setUTCMonth(d.getUTCMonth() + 3);
      break;
    case 'SEMI_ANNUAL':
      d.setUTCMonth(d.getUTCMonth() + 6);
      break;
    case 'ANNUAL':
      d.setUTCFullYear(d.getUTCFullYear() + 1);
      break;
    default:
      d.setUTCMonth(d.getUTCMonth() + 1);
  }
  return d;
}
