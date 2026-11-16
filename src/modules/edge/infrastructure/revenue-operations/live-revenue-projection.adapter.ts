import { Inject, Injectable, Optional } from '@nestjs/common';
import {
  SUBSCRIPTION_REPOSITORY_PORT,
  type SubscriptionRepositoryPort,
} from '../../domain/ports/subscription-repository.port.js';
import { normalizeToMonthlyMrr } from '../../domain/revenue-operations/mrr-calculator.js';
import type { RevenueProjectionInputPort } from '../../domain/revenue-operations/revenue-repository.port.js';

/**
 * Live P5 projection — reads active subscriptions and extracts commercial amounts safely.
 * Annual/yearly billing_frequency → amount/12 (monthly MRR line with billingPeriod MONTHLY).
 * Lines without a found amount are skipped (never fabricated as measured zero).
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
    }>
  > {
    if (!this.subscriptions) {
      return [];
    }

    const { items } = await this.subscriptions.listSubscriptions({
      status: 'ACTIVE',
      limit: 500,
      offset: 0,
    });

    const lines: Array<{
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
    }> = [];

    const notes: string[] = [];

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

      const activeAtPeriodEnd = isActiveAt(sub, input.periodEnd);
      const activeAtPeriodStart = isActiveAt(sub, input.periodStart);
      const isFreeTrial =
        sub.trialEndAt != null &&
        sub.trialEndAt > input.periodStart &&
        (sub.trialStartAt == null || sub.trialStartAt <= input.periodEnd);

      lines.push({
        subscriptionRefId: sub.id,
        customerRefId: sub.accountId,
        amount: monthly,
        currency: sub.currency || input.currency || 'USD',
        // Already normalized annual→/12 above
        billingPeriod: 'MONTHLY',
        isFreeTrial: Boolean(isFreeTrial),
        paymentStatus: 'UNKNOWN',
        movementType: activeAtPeriodEnd ? 'ENDING' : 'STARTING',
        activeAtPeriodEnd,
        activeAtPeriodStart,
        dataQuality: 'MEASURED',
      });
    }

    // Attach skip notes on empty result via a sentinel is not possible on the port;
    // callers treat empty as UNAVAILABLE. Notes are intentionally not fabricated into amounts.
    void notes;
    void input.businessUnitId;
    return lines;
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
