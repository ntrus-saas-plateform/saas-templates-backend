import { randomUUID } from 'node:crypto';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import {
  addMoney,
  applyPercentageDiscount,
  formatMoneyAmount,
  parseMoneyAmount,
} from '../../domain/commercial/pricing-math.js';
import type { BillingRepositoryPort } from '../../domain/ports/billing-repository.port.js';

export class GetBillingProfileUseCase {
  constructor(private readonly billing: BillingRepositoryPort) {}
  async execute(billingAccountId: string) {
    const profile = await this.billing.getCurrentBillingProfile(billingAccountId);
    if (!profile) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Billing profile not found');
    return profile;
  }
}

export class ListBillingProfilesUseCase {
  constructor(private readonly billing: BillingRepositoryPort) {}
  execute(billingAccountId: string) {
    return this.billing.listBillingProfiles(billingAccountId);
  }
}

export class UpsertBillingPartyUseCase {
  constructor(private readonly billing: BillingRepositoryPort) {}
  async execute(input: {
    billingAccountId: string;
    partyRole: string;
    legalName: string;
    taxId?: string | null;
    country?: string | null;
    address?: Record<string, unknown>;
    email?: string | null;
  }) {
    const account = await this.billing.getBillingAccount(input.billingAccountId);
    if (!account) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Billing account not found');
    return this.billing.upsertBillingParty(input);
  }
}

export class ListBillingPartiesUseCase {
  constructor(private readonly billing: BillingRepositoryPort) {}
  execute(billingAccountId: string) {
    return this.billing.listBillingParties(billingAccountId);
  }
}

export class ListBillingSchedulesUseCase {
  constructor(private readonly billing: BillingRepositoryPort) {}
  execute(subscriptionId: string) {
    return this.billing.listBillingSchedules(subscriptionId);
  }
}

export class ApplyTaxToInvoiceUseCase {
  constructor(private readonly billing: BillingRepositoryPort) {}

  async execute(input: { invoiceId: string; country?: string | null; category?: string }) {
    const invoice = await this.billing.getInvoice(input.invoiceId);
    if (!invoice) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Invoice not found');
    if (!['DRAFT', 'PENDING_VALIDATION', 'PENDING_APPROVAL'].includes(invoice.status)) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Tax can only be applied to draft/pending invoices');
    }

    const rate = await this.billing.resolveTaxRate({
      country: input.country ?? null,
      category: input.category ?? 'STANDARD',
    });
    if (!rate) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'No tax rate resolved for jurisdiction');
    }

    const lines = await this.billing.listInvoiceLines(invoice.id);
    const zero = parseMoneyAmount('0', invoice.currency);
    const taxable = lines.reduce(
      (acc, line) =>
        addMoney(acc, parseMoneyAmount(line.taxableAmount || line.lineTotal, invoice.currency)),
      zero,
    );
    const percent = (Number(rate.rate) * 100).toFixed(4);
    const { discount: taxMoney } = applyPercentageDiscount(taxable, percent);
    const taxAmount = formatMoneyAmount(taxMoney);
    const subtotalMoney = lines.reduce(
      (acc, l) => addMoney(acc, parseMoneyAmount(l.lineTotal, invoice.currency)),
      zero,
    );
    const subtotal = formatMoneyAmount(subtotalMoney);
    const total = formatMoneyAmount(addMoney(subtotalMoney, taxMoney));

    await this.billing.replaceInvoiceTaxLines(invoice.id, [
      {
        jurisdictionCode: rate.jurisdictionCode,
        category: rate.category,
        rate: rate.rate,
        taxableAmount: formatMoneyAmount(taxable),
        taxAmount,
      },
    ]);

    return this.billing.updateInvoice(invoice.id, {
      subtotal,
      taxTotal: taxAmount,
      total,
      amountDue: total,
      taxSnapshot: {
        jurisdictionCode: rate.jurisdictionCode,
        category: rate.category,
        rate: rate.rate,
        version: rate.version,
        calculatedAt: new Date().toISOString(),
      },
    });
  }
}

export class ListTaxJurisdictionsUseCase {
  constructor(private readonly billing: BillingRepositoryPort) {}
  execute() {
    return this.billing.listTaxJurisdictions();
  }
}

export class CreateCreditNoteUseCase {
  constructor(private readonly billing: BillingRepositoryPort) {}
  async execute(input: {
    actorId: string;
    invoiceId: string;
    amount: string;
    reason: string;
  }) {
    const invoice = await this.billing.getInvoice(input.invoiceId);
    if (!invoice) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Invoice not found');
    if (!['ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE'].includes(invoice.status)) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Credit notes require an issued invoice');
    }
    const amount = parseMoneyAmount(input.amount, invoice.currency);
    if (amount.units <= 0n) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Credit amount must be positive');
    }
    const max = parseMoneyAmount(invoice.total, invoice.currency);
    if (amount.units > max.units) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Credit amount exceeds invoice total');
    }

    const note = await this.billing.createCreditNote({
      invoiceId: invoice.id,
      billingAccountId: invoice.billingAccountId,
      currency: invoice.currency,
      total: input.amount,
      reason: input.reason,
      snapshot: {
        invoiceNumber: invoice.invoiceNumber,
        invoiceTotal: invoice.total,
        createdBy: input.actorId,
      },
    });
    return this.billing.issueCreditNote(note.id);
  }
}

export class ListCreditNotesUseCase {
  constructor(private readonly billing: BillingRepositoryPort) {}
  execute(input?: { billingAccountId?: string; invoiceId?: string }) {
    return this.billing.listCreditNotes(input);
  }
}

export class ListCollectionCasesUseCase {
  constructor(private readonly billing: BillingRepositoryPort) {}
  execute(input?: { billingAccountId?: string; status?: string; limit?: number }) {
    return this.billing.listCollectionCases(input);
  }
}

export class GetCollectionCaseUseCase {
  constructor(private readonly billing: BillingRepositoryPort) {}
  async execute(id: string) {
    const c = await this.billing.getCollectionCase(id);
    if (!c) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Collection case not found');
    const attempts = await this.billing.listDunningAttempts(id);
    return { ...c, attempts };
  }
}

export class EscalateCollectionCaseUseCase {
  constructor(private readonly billing: BillingRepositoryPort) {}
  async execute(input: { caseId: string }) {
    const c = await this.billing.getCollectionCase(input.caseId);
    if (!c) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Collection case not found');
    return this.billing.updateCollectionCase(c.id, { status: 'ESCALATED' });
  }
}

export class ResolveCollectionCaseUseCase {
  constructor(private readonly billing: BillingRepositoryPort) {}
  async execute(input: { caseId: string }) {
    const c = await this.billing.getCollectionCase(input.caseId);
    if (!c) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Collection case not found');
    return this.billing.updateCollectionCase(c.id, { status: 'RESOLVED' });
  }
}

export class ListBillingPoliciesUseCase {
  constructor(private readonly billing: BillingRepositoryPort) {}
  execute(policyType?: string) {
    return this.billing.listBillingPolicies(policyType);
  }
}

export class UpsertBillingPolicyUseCase {
  constructor(private readonly billing: BillingRepositoryPort) {}
  execute(input: {
    code: string;
    policyType: string;
    rules: Record<string, unknown>;
    status?: string;
  }) {
    return this.billing.upsertBillingPolicy(input);
  }
}

export class ListPaymentMethodsUseCase {
  constructor(private readonly billing: BillingRepositoryPort) {}
  execute(billingAccountId: string) {
    return this.billing.listPaymentMethods(billingAccountId);
  }
}

export class RegisterPaymentMethodUseCase {
  constructor(private readonly billing: BillingRepositoryPort) {}
  async execute(input: {
    billingAccountId: string;
    provider: string;
    providerMethodRef: string;
    methodType: string;
    brand?: string | null;
    last4?: string | null;
    isDefault?: boolean;
  }) {
    if (!input.providerMethodRef) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'providerMethodRef required (tokenized)');
    }
    return this.billing.registerPaymentMethod(input);
  }
}

export class RevokePaymentMethodUseCase {
  constructor(private readonly billing: BillingRepositoryPort) {}
  execute(methodId: string) {
    return this.billing.revokePaymentMethod(methodId);
  }
}

export class RunReconciliationUseCase {
  constructor(private readonly billing: BillingRepositoryPort) {}

  async execute(input: { provider: string; actorId: string }) {
    const run = await this.billing.createReconciliationRun({
      provider: input.provider,
      summary: { startedBy: input.actorId },
    });

    const missingProvider = await this.billing.listSucceededPaymentIntentsWithoutProviderTxn(
      input.provider,
    );
    const providerTxns = await this.billing.listProviderTransactions(input.provider, 500);
    const intentIds = new Set(
      providerTxns.map((t) => t.paymentIntentId).filter((x): x is string => Boolean(x)),
    );

    let exceptionCount = 0;
    for (const intent of missingProvider) {
      await this.billing.createReconciliationException({
        runId: run.id,
        exceptionType: 'MISSING_PROVIDER_TRANSACTION',
        internalRef: intent.id,
        details: { amount: intent.amount, currency: intent.currency },
      });
      exceptionCount += 1;
    }

    for (const txn of providerTxns) {
      if (!txn.paymentIntentId) {
        await this.billing.createReconciliationException({
          runId: run.id,
          exceptionType: 'UNMATCHED_PROVIDER_TRANSACTION',
          providerRef: txn.providerTxnId,
          details: { amount: txn.amount, currency: txn.currency },
        });
        exceptionCount += 1;
        continue;
      }
      const intent = await this.billing.getPaymentIntent(txn.paymentIntentId);
      if (!intent) {
        await this.billing.createReconciliationException({
          runId: run.id,
          exceptionType: 'MISSING_INTERNAL_TRANSACTION',
          providerRef: txn.providerTxnId,
          internalRef: txn.paymentIntentId,
        });
        exceptionCount += 1;
        continue;
      }
      if (intent.amount !== txn.amount || intent.currency !== txn.currency) {
        await this.billing.createReconciliationException({
          runId: run.id,
          exceptionType: intent.currency !== txn.currency ? 'CURRENCY_MISMATCH' : 'AMOUNT_MISMATCH',
          internalRef: intent.id,
          providerRef: txn.providerTxnId,
          details: {
            internalAmount: intent.amount,
            providerAmount: txn.amount,
            internalCurrency: intent.currency,
            providerCurrency: txn.currency,
          },
        });
        exceptionCount += 1;
      } else {
        intentIds.add(intent.id);
      }
    }

    const matched = providerTxns.filter(
      (t) => t.paymentIntentId && !missingProvider.some((m) => m.id === t.paymentIntentId),
    ).length;

    return this.billing.completeReconciliationRun(run.id, {
      provider: input.provider,
      matched,
      exceptions: exceptionCount,
      completedBy: input.actorId,
      completedAt: new Date().toISOString(),
    });
  }
}

export class ListReconciliationRunsUseCase {
  constructor(private readonly billing: BillingRepositoryPort) {}
  execute(limit?: number) {
    return this.billing.listReconciliationRuns(limit);
  }
}

export class ListReconciliationExceptionsUseCase {
  constructor(private readonly billing: BillingRepositoryPort) {}
  execute(input?: { runId?: string; status?: string }) {
    return this.billing.listReconciliationExceptions(input);
  }
}

export class ResolveReconciliationExceptionUseCase {
  constructor(private readonly billing: BillingRepositoryPort) {}
  execute(id: string) {
    return this.billing.resolveReconciliationException(id);
  }
}

export class IngestProviderTransactionUseCase {
  constructor(private readonly billing: BillingRepositoryPort) {}
  execute(input: {
    provider: string;
    providerTxnId: string;
    paymentIntentId?: string | null;
    amount: string;
    currency: string;
    status?: string;
    fees?: string;
  }) {
    return this.billing.upsertProviderTransaction(input);
  }
}

export class CreateSettlementBatchUseCase {
  constructor(private readonly billing: BillingRepositoryPort) {}
  execute(input: {
    provider: string;
    merchantAccount?: string | null;
    settlementDate: string;
    grossAmount: string;
    fees?: string;
    refunds?: string;
    chargebacks?: string;
    netAmount: string;
    currency: string;
    bankReference?: string | null;
  }) {
    return this.billing.createSettlementBatch(input);
  }
}

export class ListSettlementBatchesUseCase {
  constructor(private readonly billing: BillingRepositoryPort) {}
  execute(limit?: number) {
    return this.billing.listSettlementBatches(limit);
  }
}

export class CreateDisputeUseCase {
  constructor(private readonly billing: BillingRepositoryPort) {}
  execute(input: {
    billingAccountId: string;
    paymentIntentId?: string | null;
    invoiceId?: string | null;
    provider: string;
    amount: string;
    currency: string;
    disputeType?: string;
    providerDisputeId?: string | null;
  }) {
    return this.billing.createDispute(input);
  }
}

export class ListDisputesUseCase {
  constructor(private readonly billing: BillingRepositoryPort) {}
  execute(input?: { billingAccountId?: string; status?: string }) {
    return this.billing.listDisputes(input);
  }
}

export class ResolveDisputeUseCase {
  constructor(private readonly billing: BillingRepositoryPort) {}
  execute(input: { disputeId: string; status: string; resolution?: Record<string, unknown> }) {
    return this.billing.updateDisputeStatus(input.disputeId, input.status, input.resolution);
  }
}

export class ListFxRatesUseCase {
  constructor(private readonly billing: BillingRepositoryPort) {}
  execute(baseCurrency?: string) {
    return this.billing.listFxRates(baseCurrency);
  }
}

export class ConvertAmountUseCase {
  constructor(private readonly billing: BillingRepositoryPort) {}
  async execute(input: { amount: string; from: string; to: string }) {
    if (input.from === input.to) {
      return {
        sourceAmount: input.amount,
        sourceCurrency: input.from,
        targetAmount: input.amount,
        targetCurrency: input.to,
        rate: '1',
        source: 'IDENTITY',
        evidenceId: null as string | null,
      };
    }
    const fx = await this.billing.getLatestFxRate(input.from, input.to);
    if (!fx) {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        `FX rate unavailable for ${input.from}/${input.to}`,
      );
    }
    const sourceMoney = parseMoneyAmount(input.amount, input.from);
    const [w, f = ''] = fx.rate.split('.');
    const rateScaled = BigInt(w) * 1_000_000n + BigInt((f + '000000').slice(0, 6));
    const targetUnits = (sourceMoney.units * rateScaled) / 1_000_000n;
    const targetAmount = formatMoneyAmount({ currency: input.to, units: targetUnits });
    return {
      sourceAmount: input.amount,
      sourceCurrency: input.from,
      targetAmount,
      targetCurrency: input.to,
      rate: fx.rate,
      source: fx.source,
      evidenceId: fx.id,
      effectiveAt: fx.effectiveAt,
      version: fx.version,
    };
  }
}

export class CreateFxRateUseCase {
  constructor(private readonly billing: BillingRepositoryPort) {}
  execute(input: {
    baseCurrency: string;
    quoteCurrency: string;
    rate: string;
    source?: string;
  }) {
    return this.billing.createFxRate(input);
  }
}

export class ListPaymentIntentsUseCase {
  constructor(private readonly billing: BillingRepositoryPort) {}
  execute(input?: { billingAccountId?: string; status?: string; limit?: number }) {
    return this.billing.listPaymentIntents(input);
  }
}

export class ListRefundsUseCase {
  constructor(private readonly billing: BillingRepositoryPort) {}
  execute(input?: { paymentIntentId?: string; limit?: number }) {
    return this.billing.listRefunds(input);
  }
}

export class ListJournalEntriesUseCase {
  constructor(private readonly billing: BillingRepositoryPort) {}
  execute(billingAccountId: string, limit?: number) {
    return this.billing.listJournalEntries(billingAccountId, limit);
  }
}

export class GetInvoiceWorkspaceUseCase {
  constructor(private readonly billing: BillingRepositoryPort) {}
  async execute(invoiceId: string) {
    const invoice = await this.billing.getInvoice(invoiceId);
    if (!invoice) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Invoice not found');
    const [lines, taxLines, documents, creditNotes] = await Promise.all([
      this.billing.listInvoiceLines(invoiceId),
      this.billing.listInvoiceTaxLines(invoiceId),
      this.billing.listInvoiceDocuments(invoiceId),
      this.billing.listCreditNotes({ invoiceId }),
    ]);
    return { invoice, lines, taxLines, documents, creditNotes };
  }
}

/** Correlation helper for ops that need a unique key. */
export function billingOpsCorrelationId(): string {
  return randomUUID();
}
