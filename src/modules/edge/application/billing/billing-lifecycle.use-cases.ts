import { createHash, randomUUID } from 'node:crypto';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import type { BillingRepositoryPort } from '../../domain/ports/billing-repository.port.js';
import type { SubscriptionRepositoryPort } from '../../domain/ports/subscription-repository.port.js';
import { CreateDraftInvoiceFromSubscriptionUseCase } from './billing.use-cases.js';

function addFrequency(from: Date, frequency: string): Date {
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
    case 'ONE_TIME':
      return from;
    default:
      d.setUTCMonth(d.getUTCMonth() + 1);
  }
  return d;
}

export class MarkOverdueInvoicesUseCase {
  constructor(private readonly billing: BillingRepositoryPort) {}

  async execute(input: { actorId: string; asOf?: Date; limit?: number }) {
    const asOf = input.asOf ?? new Date();
    const overdue = await this.billing.listOverdueCandidates(asOf, input.limit ?? 200);
    const results: { invoiceId: string; ok: boolean; error?: string }[] = [];

    for (const invoice of overdue) {
      try {
        await this.billing.updateInvoice(invoice.id, { status: 'OVERDUE' });
        await this.billing.appendInvoiceStatusHistory({
          invoiceId: invoice.id,
          fromStatus: invoice.status,
          toStatus: 'OVERDUE',
          reason: 'due_at passed',
          actorId: input.actorId,
        });
        results.push({ invoiceId: invoice.id, ok: true });
      } catch (err) {
        results.push({
          invoiceId: invoice.id,
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return {
      scanned: overdue.length,
      marked: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      results,
    };
  }
}

export class ProcessDueBillingSchedulesUseCase {
  constructor(
    private readonly billing: BillingRepositoryPort,
    private readonly draftInvoice: CreateDraftInvoiceFromSubscriptionUseCase,
  ) {}

  async execute(input: { actorId: string; asOf?: Date; limit?: number }) {
    const asOf = input.asOf ?? new Date();
    const due = await this.billing.listDueBillingSchedules(asOf, input.limit ?? 50);
    const results: {
      scheduleId: string;
      subscriptionId: string;
      ok: boolean;
      invoiceId?: string;
      error?: string;
    }[] = [];

    for (const schedule of due) {
      try {
        const account = await this.billing.getBillingAccount(schedule.billingAccountId);
        const periodNumber = await this.billing.allocateNextPeriodNumber(schedule.subscriptionId);
        const startsAt = schedule.nextBillAt ?? asOf;
        const endsAt = addFrequency(startsAt, schedule.frequency);
        const period = await this.billing.createBillingPeriod({
          subscriptionId: schedule.subscriptionId,
          billingAccountId: schedule.billingAccountId,
          periodNumber,
          startsAt,
          endsAt,
          billAt: startsAt,
          dueAt: new Date(startsAt.getTime() + 30 * 24 * 60 * 60 * 1000),
          currency: account?.currency ?? 'USD',
          snapshot: {
            scheduleId: schedule.id,
            frequency: schedule.frequency,
            processedAt: asOf.toISOString(),
          },
        });

        const invoice = await this.draftInvoice.execute({
          actorId: input.actorId,
          subscriptionId: schedule.subscriptionId,
          periodId: period.id,
        });

        const next =
          schedule.frequency === 'ONE_TIME' || schedule.frequency === 'CUSTOM'
            ? null
            : addFrequency(startsAt, schedule.frequency);
        await this.billing.advanceBillingSchedule(schedule.id, next);

        results.push({
          scheduleId: schedule.id,
          subscriptionId: schedule.subscriptionId,
          ok: true,
          invoiceId: invoice.id,
        });
      } catch (err) {
        results.push({
          scheduleId: schedule.id,
          subscriptionId: schedule.subscriptionId,
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return {
      processed: results.length,
      succeeded: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      results,
    };
  }
}

export class GetCustomerBillingPortalUseCase {
  constructor(private readonly billing: BillingRepositoryPort) {}

  async execute(billingAccountId: string) {
    const account = await this.billing.getBillingAccount(billingAccountId);
    if (!account) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Billing account not found');

    const [profile, parties, invoices, payments, methods, creditNotes, journal] =
      await Promise.all([
        this.billing.getCurrentBillingProfile(billingAccountId),
        this.billing.listBillingParties(billingAccountId),
        this.billing.listInvoices({ billingAccountId, limit: 100 }),
        this.billing.listPaymentIntents({ billingAccountId, limit: 100 }),
        this.billing.listPaymentMethods(billingAccountId),
        this.billing.listCreditNotes({ billingAccountId }),
        this.billing.listJournalEntries(billingAccountId, 50),
      ]);

    const openBalance = invoices
      .filter((i) => ['ISSUED', 'PARTIALLY_PAID', 'OVERDUE'].includes(i.status))
      .reduce((acc, i) => acc + Number(i.amountDue || 0), 0)
      .toFixed(2);

    return {
      account,
      profile,
      parties,
      openBalance,
      currency: account.currency,
      invoices,
      payments,
      paymentMethods: methods,
      creditNotes,
      recentJournal: journal,
      notices: [
        'Payment confirmation requires provider proof — pending intents are not collected cash.',
        'Recognized revenue is computed by platform policy, not this portal view.',
      ],
    };
  }
}

export class GenerateFinancialExportUseCase {
  constructor(private readonly billing: BillingRepositoryPort) {}

  async execute(input: {
    actorId: string;
    exportType?: string;
    currency?: string;
    periodStart?: Date | null;
    periodEnd?: Date | null;
  }) {
    const exportType = input.exportType ?? 'FULL';
    const currency = input.currency;
    const periodStart = input.periodStart ?? null;
    const periodEnd = input.periodEnd ?? null;

    const invoices =
      exportType === 'PAYMENTS' || exportType === 'REFUNDS'
        ? []
        : await this.billing.listInvoicesForExport({ currency, periodStart, periodEnd });
    const payments =
      exportType === 'INVOICES' || exportType === 'CREDIT_NOTES'
        ? []
        : await this.billing.listPaymentIntentsForExport({ currency, periodStart, periodEnd });
    const refunds =
      exportType === 'INVOICES'
        ? []
        : await this.billing.listRefunds({ limit: 5000 });
    const creditNotes =
      exportType === 'PAYMENTS' || exportType === 'REFUNDS'
        ? []
        : await this.billing.listCreditNotes();

    const items: { entityType: string; entityId: string; payload: Record<string, unknown> }[] =
      [];
    for (const inv of invoices) {
      items.push({
        entityType: 'INVOICE',
        entityId: inv.id,
        payload: {
          invoiceNumber: inv.invoiceNumber,
          status: inv.status,
          currency: inv.currency,
          total: inv.total,
          amountPaid: inv.amountPaid,
          amountDue: inv.amountDue,
          issueAt: inv.issueAt,
          taxSnapshot: inv.taxSnapshot,
        },
      });
    }
    for (const p of payments) {
      items.push({
        entityType: 'PAYMENT',
        entityId: p.id,
        payload: {
          status: p.status,
          amount: p.amount,
          currency: p.currency,
          provider: p.provider,
          invoiceId: p.invoiceId,
        },
      });
    }
    for (const r of refunds) {
      if (r.status !== 'SUCCEEDED') continue;
      items.push({
        entityType: 'REFUND',
        entityId: r.id,
        payload: {
          status: r.status,
          amount: r.amount,
          currency: r.currency,
          paymentIntentId: r.paymentIntentId,
        },
      });
    }
    for (const cn of creditNotes) {
      items.push({
        entityType: 'CREDIT_NOTE',
        entityId: cn.id,
        payload: {
          creditNoteNumber: cn.creditNoteNumber,
          status: cn.status,
          total: cn.total,
          currency: cn.currency,
          invoiceId: cn.invoiceId,
        },
      });
    }

    const artifactBody = JSON.stringify({
      generatedAt: new Date().toISOString(),
      exportType,
      currency: currency ?? null,
      itemCount: items.length,
      items,
    });
    const checksum = createHash('sha256').update(artifactBody).digest('hex');
    const artifactRef = `billing://exports/${randomUUID()}.json#sha256=${checksum}`;

    const batch = await this.billing.createExportBatch({
      exportType,
      currency: currency ?? null,
      periodStart,
      periodEnd,
      itemCount: items.length,
      checksumSha256: checksum,
      artifactRef,
      summary: {
        invoiceCount: invoices.length,
        paymentCount: payments.length,
        refundCount: items.filter((i) => i.entityType === 'REFUND').length,
        creditNoteCount: creditNotes.length,
      },
      createdBy: input.actorId,
    });

    await this.billing.addExportItems(batch.id, items);
    return { ...batch, artifactPreviewBytes: artifactBody.length };
  }
}

export class ListFinancialExportsUseCase {
  constructor(private readonly billing: BillingRepositoryPort) {}
  execute(limit?: number) {
    return this.billing.listExportBatches(limit);
  }
}

export class GetFinancialExportUseCase {
  constructor(private readonly billing: BillingRepositoryPort) {}
  async execute(id: string) {
    const batch = await this.billing.getExportBatch(id);
    if (!batch) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Export batch not found');
    const items = await this.billing.listExportItems(id);
    return { ...batch, items };
  }
}

export class ListRevenuePoliciesUseCase {
  constructor(private readonly billing: BillingRepositoryPort) {}
  execute() {
    return this.billing.listRevenuePolicies();
  }
}

export class UpsertRevenuePolicyUseCase {
  constructor(private readonly billing: BillingRepositoryPort) {}
  execute(input: {
    code: string;
    method: string;
    rules?: Record<string, unknown>;
    status?: string;
  }) {
    if (!['CASH_BASED_NET', 'BILLING_BASED', 'DEFERRED_MANUAL'].includes(input.method)) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Invalid revenue recognition method');
    }
    return this.billing.upsertRevenuePolicy(input);
  }
}

/** Keep subscription port typed for future portal entitlement cross-checks. */
export type BillingLifecycleSubscriptionPort = SubscriptionRepositoryPort;
