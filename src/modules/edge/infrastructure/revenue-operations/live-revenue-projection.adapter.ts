import { Inject, Injectable, Optional } from '@nestjs/common';
import {
  SUBSCRIPTION_REPOSITORY_PORT,
  type SubscriptionRepositoryPort,
} from '../../domain/ports/subscription-repository.port.js';
import {
  deriveMrrMovementLines,
  normalizeToMonthlyMrr,
} from '../../domain/revenue-operations/mrr-calculator.js';
import type { RevenueProjectionInputPort } from '../../domain/revenue-operations/revenue-repository.port.js';

/**
 * Live P5 projection — reads active subscriptions and extracts commercial amounts safely.
 * Annual/yearly billing_frequency → amount/12 (monthly MRR line with billingPeriod MONTHLY).
 * Lines without a found amount are skipped (never fabricated as measured zero).
 *
 * F-P11-004: paymentStatus UNKNOWN → dataQuality ESTIMATED (not MEASURED cash-implying).
 * F-P11-005/006: derive NEW/CHURNED/EXPANSION/CONTRACTION from activity + prior amount.
 */
@Injectable()
export class LiveRevenueProjectionAdapter implements RevenueProjectionInputPort {
  constructor(
    @Optional()
    @Inject(SUBSCRIPTION_REPOSITORY_PORT)
    private readonly subscriptions?: SubscriptionRepositoryPort,
  ) {}

  async loadNormalizedSubscriptionRevenueLines(input: {
    periodStart: Date;
    periodEnd: Date;
    currency?: string;
    businessUnitId?: string | null;
    verticalId?: string;
  }): Promise<
    Array<{
      subscriptionRefId: string;
      customerRefId?: string | null;
      amount: number;
      currency: string;
      billingPeriod: string;
      isFreeTrial?: boolean;
      paymentStatus?: string;
      movementType: string;
      activeAtPeriodEnd?: boolean;
      activeAtPeriodStart?: boolean;
      dataQuality?: string;
      skipNote?: string;
      priorPeriodAmount?: number | null;
    }>
  > {
    if (!this.subscriptions) {
      return [];
    }

    const { items } = await this.subscriptions.listSubscriptions({
      status: 'ACTIVE',
      limit: 500,
      offset: 0,
      verticalId: input.verticalId,
    });

    const notes: string[] = [];
    const observations = [];

    for (const sub of items) {
      if (input.currency && sub.currency && sub.currency !== input.currency) {
        notes.push(`Skipped ${sub.id}: currency mismatch`);
        continue;
      }

      const extracted = extractCommercialAmount(sub.commercialSnapshot);
      if (extracted == null) {
        notes.push(
          `Skipped ${sub.id}: no amount in commercial_snapshot (totalAmount/total/amount)`,
        );
        continue;
      }

      const frequency = String(sub.billingFrequency ?? 'MONTHLY').toUpperCase();
      const monthly = normalizeToMonthlyMrr(extracted, frequency);
      if (!Number.isFinite(monthly)) {
        notes.push(`Skipped ${sub.id}: unsupported billingFrequency=${frequency}`);
        continue;
      }

      const priorRaw = extractPriorAmount(sub.commercialSnapshot);
      const priorMonthly =
        priorRaw == null ? null : normalizeToMonthlyMrr(priorRaw, frequency);

      const activeAtPeriodEnd = isActiveAt(sub, input.periodEnd);
      const activeAtPeriodStart = isActiveAt(sub, input.periodStart);
      const isFreeTrial =
        sub.trialEndAt != null &&
        sub.trialEndAt > input.periodStart &&
        (sub.trialStartAt == null || sub.trialStartAt <= input.periodEnd);

      // Payment status unknown from P5 list alone — must not claim MEASURED cash (F-P11-004).
      const paymentStatus = 'UNKNOWN';
      const dataQuality = 'ESTIMATED';

      observations.push({
        subscriptionRefId: sub.id,
        customerRefId: sub.accountId,
        amount: monthly,
        currency: sub.currency || input.currency || 'USD',
        billingPeriod: 'MONTHLY',
        isFreeTrial: Boolean(isFreeTrial),
        paymentStatus,
        activeAtPeriodStart,
        activeAtPeriodEnd,
        priorPeriodAmount:
          priorMonthly != null && Number.isFinite(priorMonthly) ? priorMonthly : null,
        dataQuality,
      });
    }

    void notes;
    void input.businessUnitId;
    return deriveMrrMovementLines(observations);
  }
}

function extractCommercialAmount(snapshot: Record<string, unknown> | null | undefined): number | null {
  if (!snapshot || typeof snapshot !== 'object') return null;
  const candidates = [
    snapshot.totalAmount,
    snapshot.total_amount,
    snapshot.total,
    snapshot.amount,
    snapshot.recurringAmount,
    snapshot.mrr,
  ];
  for (const c of candidates) {
    if (c == null) continue;
    const n = typeof c === 'number' ? c : Number(c);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/** Prior-period amount keys used for expansion/contraction derivation (F-P11-006). */
function extractPriorAmount(snapshot: Record<string, unknown> | null | undefined): number | null {
  if (!snapshot || typeof snapshot !== 'object') return null;
  const candidates = [
    snapshot.priorPeriodAmount,
    snapshot.prior_period_amount,
    snapshot.previousAmount,
    snapshot.previous_amount,
    snapshot.priorMrr,
    snapshot.prior_mrr,
  ];
  for (const c of candidates) {
    if (c == null) continue;
    const n = typeof c === 'number' ? c : Number(c);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function isActiveAt(
  sub: {
    startAt: Date | null;
    endAt: Date | null;
    status: string;
  },
  at: Date,
): boolean {
  if (String(sub.status).toUpperCase() !== 'ACTIVE') return false;
  if (sub.startAt && sub.startAt > at) return false;
  if (sub.endAt && sub.endAt < at) return false;
  return true;
}
