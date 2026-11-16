/**
 * Pure MRR movement calculator.
 *
 * Normalization rules (documented, not silent):
 * - MONTHLY amount → MRR as-is
 * - ANNUAL / YEARLY amount → MRR = amount / 12
 * - QUARTERLY → amount / 3
 * - WEEKLY → amount * (52/12) ≈ amount * 4.333… (explicit factor 52/12)
 * - Free trials: when `excludeFreeTrials` is true (default), lines with isFreeTrial=true are excluded
 * - Collected revenue is NEVER inferred here — unpaid lines must not be treated as collected
 * - Missing / empty input → all movements dataQuality UNAVAILABLE (not zero)
 */

import type { DataQuality } from './revenue.types.js';

export type BillingPeriod = 'MONTHLY' | 'ANNUAL' | 'YEARLY' | 'QUARTERLY' | 'WEEKLY' | 'OTHER';

export type MrrMovementType =
  | 'NEW'
  | 'EXPANSION'
  | 'CONTRACTION'
  | 'CHURNED'
  | 'REACTIVATION'
  | 'ENDING'
  | 'STARTING';

export type NormalizedSubscriptionRevenueLine = {
  /** Soft P5 subscription id — reference only */
  subscriptionRefId: string;
  /** Soft customer/account id when known */
  customerRefId?: string | null;
  /** Recurring amount in the line's billing period (not yet monthly) */
  amount: number;
  currency: string;
  billingPeriod: BillingPeriod | string;
  /** True when the line is a free trial / $0 promotional trial */
  isFreeTrial?: boolean;
  /** Payment / collection status — unpaid must never become collected elsewhere */
  paymentStatus?: 'PAID' | 'UNPAID' | 'PENDING' | 'UNKNOWN' | string;
  /** Movement classification for the period */
  movementType: MrrMovementType | string;
  /** Whether the subscription is active at period end (for ending MRR) */
  activeAtPeriodEnd?: boolean;
  /** Whether the subscription was active at period start */
  activeAtPeriodStart?: boolean;
};

export type MrrCalculatorOptions = {
  /** Default true — exclude free trial lines from MRR */
  excludeFreeTrials?: boolean;
  /** Reporting currency filter; lines in other currencies are skipped (counted in skipped) */
  currency?: string;
};

export type MrrMovementBucket = {
  amount: number | null;
  dataQuality: DataQuality;
  lineCount: number;
};

export type MrrMovementResult = {
  currency: string | null;
  mrrEnding: MrrMovementBucket;
  mrrStarting: MrrMovementBucket;
  mrrNew: MrrMovementBucket;
  mrrExpansion: MrrMovementBucket;
  mrrContraction: MrrMovementBucket;
  mrrChurned: MrrMovementBucket;
  mrrReactivation: MrrMovementBucket;
  mrrNetNew: MrrMovementBucket;
  arrEnding: MrrMovementBucket;
  skippedLineCount: number;
  notes: string[];
};

const WEEKLY_TO_MONTHLY = 52 / 12;

/**
 * Convert a period amount to monthly recurring revenue.
 * Annual/yearly → /12 (explicit).
 */
export function normalizeToMonthlyMrr(
  amount: number,
  billingPeriod: BillingPeriod | string,
): number {
  if (!Number.isFinite(amount)) return NaN;
  const period = String(billingPeriod).toUpperCase();
  switch (period) {
    case 'MONTHLY':
      return amount;
    case 'ANNUAL':
    case 'YEARLY':
      return amount / 12;
    case 'QUARTERLY':
      return amount / 3;
    case 'WEEKLY':
      return amount * WEEKLY_TO_MONTHLY;
    default:
      // OTHER / unknown — refuse silent assumption; caller should treat as skip
      return NaN;
  }
}

function emptyBucket(unavailable: boolean): MrrMovementBucket {
  return unavailable
    ? { amount: null, dataQuality: 'UNAVAILABLE', lineCount: 0 }
    : { amount: 0, dataQuality: 'MEASURED', lineCount: 0 };
}

function finalizeBucket(sum: number, count: number, hadInput: boolean): MrrMovementBucket {
  if (!hadInput) {
    return { amount: null, dataQuality: 'UNAVAILABLE', lineCount: 0 };
  }
  return { amount: roundMoney(sum), dataQuality: 'MEASURED', lineCount: count };
}

function roundMoney(n: number): number {
  return Math.round(n * 1e8) / 1e8;
}

/**
 * Compute MRR movements from normalized subscription revenue lines.
 * Does not invent amounts. Empty input → UNAVAILABLE (not zeros).
 */
export function computeMrrMovements(
  lines: NormalizedSubscriptionRevenueLine[],
  options: MrrCalculatorOptions = {},
): MrrMovementResult {
  const excludeFreeTrials = options.excludeFreeTrials !== false;
  const notes: string[] = [
    'Annual/yearly amounts are normalized to monthly via amount/12.',
    'Unpaid lines are included in MRR classification but must never be counted as COLLECTED_REVENUE.',
  ];

  if (!lines || lines.length === 0) {
    notes.push('No input lines — all MRR movements UNAVAILABLE (not zero).');
    const u = emptyBucket(true);
    return {
      currency: options.currency ?? null,
      mrrEnding: u,
      mrrStarting: u,
      mrrNew: u,
      mrrExpansion: u,
      mrrContraction: u,
      mrrChurned: u,
      mrrReactivation: u,
      mrrNetNew: u,
      arrEnding: u,
      skippedLineCount: 0,
      notes,
    };
  }

  let skipped = 0;
  let ending = 0;
  let endingCount = 0;
  let starting = 0;
  let startingCount = 0;
  let neu = 0;
  let neuCount = 0;
  let expansion = 0;
  let expansionCount = 0;
  let contraction = 0;
  let contractionCount = 0;
  let churned = 0;
  let churnedCount = 0;
  let reactivation = 0;
  let reactivationCount = 0;
  let currency: string | null = options.currency ?? null;

  for (const line of lines) {
    if (excludeFreeTrials && line.isFreeTrial) {
      skipped += 1;
      continue;
    }
    if (options.currency && line.currency && line.currency !== options.currency) {
      skipped += 1;
      continue;
    }
    const monthly = normalizeToMonthlyMrr(line.amount, line.billingPeriod);
    if (!Number.isFinite(monthly)) {
      skipped += 1;
      notes.push(
        `Skipped line ${line.subscriptionRefId}: unsupported billingPeriod=${line.billingPeriod}`,
      );
      continue;
    }
    if (!currency) currency = line.currency;

    const movement = String(line.movementType).toUpperCase();

    if (line.activeAtPeriodEnd || movement === 'ENDING') {
      ending += monthly;
      endingCount += 1;
    }
    if (line.activeAtPeriodStart || movement === 'STARTING') {
      starting += monthly;
      startingCount += 1;
    }

    switch (movement) {
      case 'NEW':
        neu += monthly;
        neuCount += 1;
        break;
      case 'EXPANSION':
        expansion += Math.abs(monthly);
        expansionCount += 1;
        break;
      case 'CONTRACTION':
        contraction += Math.abs(monthly);
        contractionCount += 1;
        break;
      case 'CHURNED':
        churned += Math.abs(monthly);
        churnedCount += 1;
        break;
      case 'REACTIVATION':
        reactivation += Math.abs(monthly);
        reactivationCount += 1;
        break;
      case 'ENDING':
      case 'STARTING':
        break;
      default:
        skipped += 1;
        notes.push(`Skipped line ${line.subscriptionRefId}: unknown movementType=${line.movementType}`);
        break;
    }
  }

  // If every line was skipped, treat as UNAVAILABLE
  const usable = lines.length - skipped;
  const hadInput = usable > 0;

  // Movement-specific: if had usable lines but zero of that type → MEASURED 0 is OK
  const mrrExpansion = finalizeBucket(expansion, expansionCount, hadInput);
  const mrrContraction = finalizeBucket(contraction, contractionCount, hadInput);
  const mrrChurned = finalizeBucket(churned, churnedCount, hadInput);
  const mrrReactivation = finalizeBucket(reactivation, reactivationCount, hadInput);
  const mrrNewFinal = finalizeBucket(neu, neuCount, hadInput);
  const mrrEnding = finalizeBucket(ending, endingCount, hadInput);
  const mrrStarting = finalizeBucket(starting, startingCount, hadInput);

  let mrrNetNew: MrrMovementBucket;
  if (
    mrrNewFinal.dataQuality === 'UNAVAILABLE' ||
    mrrExpansion.dataQuality === 'UNAVAILABLE' ||
    mrrReactivation.dataQuality === 'UNAVAILABLE' ||
    mrrContraction.dataQuality === 'UNAVAILABLE' ||
    mrrChurned.dataQuality === 'UNAVAILABLE'
  ) {
    mrrNetNew = { amount: null, dataQuality: 'UNAVAILABLE', lineCount: 0 };
  } else {
    const net =
      (mrrNewFinal.amount ?? 0) +
      (mrrExpansion.amount ?? 0) +
      (mrrReactivation.amount ?? 0) -
      (mrrContraction.amount ?? 0) -
      (mrrChurned.amount ?? 0);
    mrrNetNew = {
      amount: roundMoney(net),
      dataQuality: 'MEASURED',
      lineCount:
        mrrNewFinal.lineCount +
        mrrExpansion.lineCount +
        mrrReactivation.lineCount +
        mrrContraction.lineCount +
        mrrChurned.lineCount,
    };
  }

  const arrEnding: MrrMovementBucket =
    mrrEnding.dataQuality === 'UNAVAILABLE' || mrrEnding.amount == null
      ? { amount: null, dataQuality: 'UNAVAILABLE', lineCount: 0 }
      : {
          amount: roundMoney(mrrEnding.amount * 12),
          dataQuality: 'MEASURED',
          lineCount: mrrEnding.lineCount,
        };

  if (excludeFreeTrials) {
    notes.push('Free trial lines excluded (excludeFreeTrials=true).');
  }

  return {
    currency,
    mrrEnding,
    mrrStarting,
    mrrNew: mrrNewFinal,
    mrrExpansion,
    mrrContraction,
    mrrChurned,
    mrrReactivation,
    mrrNetNew,
    arrEnding,
    skippedLineCount: skipped,
    notes,
  };
}

/**
 * Guard: unpaid must never be treated as collected.
 * Returns true only when paymentStatus is explicitly PAID.
 */
export function isCollectedEligible(paymentStatus: string | null | undefined): boolean {
  return String(paymentStatus ?? '').toUpperCase() === 'PAID';
}
