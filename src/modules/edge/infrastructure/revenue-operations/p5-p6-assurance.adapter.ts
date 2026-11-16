import { Inject, Injectable, Optional } from '@nestjs/common';
import {
  BILLING_REPOSITORY_PORT,
  type BillingRepositoryPort,
} from '../../domain/ports/billing-repository.port.js';
import {
  SUBSCRIPTION_REPOSITORY_PORT,
  type SubscriptionRepositoryPort,
} from '../../domain/ports/subscription-repository.port.js';
import {
  detectBillingWithoutSubscriptionRef,
  detectPriceMismatch,
  detectSubscriptionWithoutBillingSetup,
  type AssuranceCaseDraft,
} from '../../domain/revenue-operations/revenue-assurance.js';

export type AssuranceScanAdapterResult = {
  findings: AssuranceCaseDraft[];
  dataQuality: 'MEASURED' | 'PARTIAL' | 'UNAVAILABLE';
  notes: string[];
};

/**
 * Reads P5 SubscriptionRepositoryPort + P6 BillingRepositoryPort to produce
 * candidate assurance findings. Honest PARTIAL when fields are missing — never invents.
 */
@Injectable()
export class P5P6AssuranceAdapter {
  constructor(
    @Optional()
    @Inject(SUBSCRIPTION_REPOSITORY_PORT)
    private readonly subscriptions?: SubscriptionRepositoryPort,
    @Optional()
    @Inject(BILLING_REPOSITORY_PORT)
    private readonly billing?: BillingRepositoryPort,
  ) {}

  async collectFindings(opts?: { limit?: number }): Promise<AssuranceScanAdapterResult> {
    const notes: string[] = [];
    const findings: AssuranceCaseDraft[] = [];

    if (!this.subscriptions && !this.billing) {
      return {
        findings: [],
        dataQuality: 'UNAVAILABLE',
        notes: ['Subscription and Billing repositories unavailable — no findings invented'],
      };
    }

    let partial = false;
    const limit = opts?.limit ?? 200;

    if (this.subscriptions) {
      const { items } = await this.subscriptions.listSubscriptions({
        status: 'ACTIVE',
        limit,
        offset: 0,
      });

      for (const sub of items) {
        let hasBillingSchedule: boolean | null = null;
        let hasBillingAccountLink: boolean | null = null;

        if (this.billing) {
          try {
            const schedules = await this.billing.listBillingSchedules(sub.id);
            hasBillingSchedule = schedules.length > 0;
          } catch {
            hasBillingSchedule = null;
            partial = true;
            notes.push(`PARTIAL: could not list schedules for ${sub.id}`);
          }
          try {
            const account = await this.billing.getBillingAccountForSubscription(sub.id);
            hasBillingAccountLink = account != null;
          } catch {
            hasBillingAccountLink = null;
            partial = true;
            notes.push(`PARTIAL: could not resolve billing account for ${sub.id}`);
          }
        } else {
          partial = true;
          notes.push('PARTIAL: BillingRepositoryPort missing — schedule/link unknown');
        }

        const draft = detectSubscriptionWithoutBillingSetup({
          subscriptionId: sub.id,
          status: sub.status,
          billingRequired: sub.billingRequired,
          billingConfirmed: sub.billingConfirmed,
          hasBillingSchedule,
          hasBillingAccountLink,
          currency: sub.currency,
        });
        if (draft) findings.push(draft);

        // Price mismatch vs latest invoice when both sides measurable
        if (this.billing) {
          const expected = extractAmount(sub.commercialSnapshot);
          if (expected != null) {
            try {
              const account = await this.billing.getBillingAccountForSubscription(sub.id);
              if (account) {
                const invoices = await this.billing.listInvoices({
                  billingAccountId: account.id,
                  limit: 5,
                });
                const related = invoices.find((inv) => inv.subscriptionId === sub.id);
                if (related) {
                  const actual = Number(related.total);
                  const mismatch = detectPriceMismatch({
                    subscriptionId: sub.id,
                    invoiceId: related.id,
                    expectedAmount: expected,
                    actualAmount: Number.isFinite(actual) ? actual : null,
                    currency: sub.currency,
                  });
                  if (mismatch) findings.push(mismatch);
                }
              }
            } catch {
              partial = true;
            }
          }
        }
      }
    } else {
      partial = true;
      notes.push('PARTIAL: SubscriptionRepositoryPort missing');
    }

    if (this.billing) {
      try {
        const invoices = await this.billing.listInvoices({ limit });
        for (const inv of invoices) {
          const draft = detectBillingWithoutSubscriptionRef({
            billingEntityType: 'INVOICE',
            billingEntityId: inv.id,
            subscriptionRefId: inv.subscriptionId ?? null,
            invoiceId: inv.id,
            amount: Number.isFinite(Number(inv.total)) ? Number(inv.total) : null,
            currency: inv.currency,
          });
          if (draft) findings.push(draft);
        }
      } catch {
        partial = true;
        notes.push('PARTIAL: listInvoices failed');
      }
    }

    return {
      findings,
      dataQuality:
        findings.length === 0 && partial
          ? 'PARTIAL'
          : partial
            ? 'PARTIAL'
            : findings.length === 0
              ? 'MEASURED'
              : 'MEASURED',
      notes,
    };
  }
}

function extractAmount(snapshot: Record<string, unknown> | null | undefined): number | null {
  if (!snapshot || typeof snapshot !== 'object') return null;
  for (const key of ['totalAmount', 'total_amount', 'total', 'amount']) {
    const n = Number(snapshot[key]);
    if (Number.isFinite(n)) return n;
  }
  return null;
}
