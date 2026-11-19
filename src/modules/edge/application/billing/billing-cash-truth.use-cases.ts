import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import {
  assembleBillingCashTruth,
  type BillingCashTruth,
} from '../../domain/billing/billing-cash-truth.js';
import type { BillingRepositoryPort } from '../../domain/ports/billing-repository.port.js';
import type { SubscriptionRepositoryPort } from '../../domain/ports/subscription-repository.port.js';
import { SubscriptionStatus } from '../../domain/subscription/subscription.entity.js';

const CONTRACTED_STATUSES = [
  SubscriptionStatus.ACTIVE,
  SubscriptionStatus.TRIALING,
  SubscriptionStatus.PAST_DUE,
  SubscriptionStatus.PENDING_CANCELLATION,
] as const;

/**
 * RGOM-E8 — Billing cash truth: contracted ≠ invoiced ≠ collected.
 */
export class GetBillingCashTruthUseCase {
  constructor(
    private readonly billing: BillingRepositoryPort,
    private readonly subscriptions: SubscriptionRepositoryPort,
  ) {}

  async execute(input?: {
    currency?: string;
    periodStart?: Date | string;
    periodEnd?: Date | string;
    verticalId?: string;
  }): Promise<{ data: BillingCashTruth }> {
    const periodEnd = input?.periodEnd ? new Date(input.periodEnd) : new Date();
    const periodStart = input?.periodStart
      ? new Date(input.periodStart)
      : new Date(periodEnd.getTime() - 30 * 24 * 60 * 60 * 1000);
    if (Number.isNaN(periodStart.getTime()) || Number.isNaN(periodEnd.getTime())) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Invalid periodStart/periodEnd');
    }
    if (periodEnd.getTime() <= periodStart.getTime()) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'periodEnd must be after periodStart');
    }

    const currency = input?.currency?.trim().toUpperCase();
    const verticalId = input?.verticalId?.trim() || undefined;

    const [invoices, payments, ...subPages] = await Promise.all([
      this.billing.listInvoicesForExport({ currency, periodStart, periodEnd, verticalId }),
      this.billing.listPaymentIntentsForExport({ currency, periodStart, periodEnd, verticalId }),
      ...CONTRACTED_STATUSES.map((status) =>
        this.subscriptions.listSubscriptions({ status, verticalId, limit: 200 }),
      ),
    ]);

    const seen = new Set<string>();
    const subscriptionRefs = [];
    for (const page of subPages) {
      for (const sub of page.items) {
        if (seen.has(sub.id)) continue;
        seen.add(sub.id);
        subscriptionRefs.push({
          id: sub.id,
          status: sub.status,
          currency: sub.currency,
          billingFrequency: sub.billingFrequency,
          commercialSnapshot: sub.commercialSnapshot,
          isTrial: String(sub.status).toUpperCase() === 'TRIALING',
        });
      }
    }

    const truth = assembleBillingCashTruth({
      subscriptions: subscriptionRefs,
      invoices: invoices.map((inv) => ({
        id: inv.id,
        status: inv.status,
        currency: inv.currency,
        total: inv.total,
        amountDue: inv.amountDue,
        issueAt: inv.issueAt,
        createdAt: inv.createdAt,
      })),
      payments: payments.map((p) => ({
        id: p.id,
        status: p.status,
        currency: p.currency,
        amount: p.amount,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      })),
      periodStart,
      periodEnd,
      currency,
    });

    return { data: truth };
  }
}
