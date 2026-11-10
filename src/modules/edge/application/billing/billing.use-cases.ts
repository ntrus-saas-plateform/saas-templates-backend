import { randomUUID } from 'node:crypto';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import { ControlPlaneOutboxTransactionService } from '../../../../shared/messaging/control-plane-outbox-transaction.service.js';
import type { IntegrationEvent } from '../../../../core/domain/events/integration-event.js';
import {
  InvoiceStatus,
  PaymentIntentStatus,
  RefundStatus,
  assertAllocationDoesNotExceed,
  assertInvoiceStatusTransition,
  assertNoSelfApproval,
  assertPaymentStatusTransition,
  assertRefundDoesNotExceed,
  sumInvoiceTotals,
} from '../../domain/billing/billing.entity.js';
import {
  EDGE_BILLING_OUTBOX_TENANT,
  createBillingAccountCreatedEvent,
  createBillingCollectionStartedEvent,
  createBillingInvoiceIssuedEvent,
  createBillingInvoicePaidEvent,
  createBillingInvoicePartiallyPaidEvent,
  createBillingPaymentFailedEvent,
  createBillingPaymentSucceededEvent,
  createBillingRefundCompletedEvent,
} from '../../domain/billing/billing.events.js';
import type { PaymentProviderPort } from '../../domain/billing/payment-provider.port.js';
import type { BillingRepositoryPort } from '../../domain/ports/billing-repository.port.js';
import type { SubscriptionRepositoryPort } from '../../domain/ports/subscription-repository.port.js';
import { ConfirmBillingCoordinationUseCase } from '../subscription/subscription.use-cases.js';
import {
  addMoney,
  formatMoneyAmount,
  parseMoneyAmount,
} from '../../domain/commercial/pricing-math.js';

async function enqueueBilling(
  outbox: ControlPlaneOutboxTransactionService | undefined,
  event: IntegrationEvent<unknown>,
) {
  if (!outbox) return;
  await outbox.runWithOutbox(EDGE_BILLING_OUTBOX_TENANT, async (_c, enqueue) => {
    await enqueue(event);
  });
}

export class CreateBillingAccountUseCase {
  constructor(
    private readonly billing: BillingRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}

  async execute(input: {
    actorId: string;
    commercialAccountId: string;
    currency?: string;
    paymentTermsDays?: number;
  }) {
    const correlationId = randomUUID();
    const account = await this.billing.createBillingAccount({
      commercialAccountId: input.commercialAccountId,
      currency: input.currency,
      paymentTermsDays: input.paymentTermsDays,
      createdBy: input.actorId,
    });
    await enqueueBilling(
      this.outbox,
      createBillingAccountCreatedEvent({
        actorId: input.actorId,
        correlationId,
        billingAccountId: account.id,
        commercialAccountId: account.commercialAccountId,
      }),
    );
    return account;
  }
}

export class ListBillingAccountsUseCase {
  constructor(private readonly billing: BillingRepositoryPort) {}
  execute(input?: { commercialAccountId?: string; limit?: number }) {
    return this.billing.listBillingAccounts(input);
  }
}

export class GetBillingAccountUseCase {
  constructor(private readonly billing: BillingRepositoryPort) {}
  async execute(id: string) {
    const account = await this.billing.getBillingAccount(id);
    if (!account) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Billing account not found');
    return account;
  }
}

export class UpsertBillingProfileUseCase {
  constructor(private readonly billing: BillingRepositoryPort) {}
  async execute(input: {
    billingAccountId: string;
    legalName: string;
    tradeName?: string | null;
    country?: string | null;
    currency: string;
    paymentTermsDays: number;
    snapshot?: Record<string, unknown>;
  }) {
    const account = await this.billing.getBillingAccount(input.billingAccountId);
    if (!account) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Billing account not found');
    return this.billing.upsertBillingProfile(input);
  }
}

export class LinkSubscriptionToBillingAccountUseCase {
  constructor(private readonly billing: BillingRepositoryPort) {}
  execute(input: { billingAccountId: string; subscriptionId: string }) {
    return this.billing.linkSubscriptionToBillingAccount(input);
  }
}

export class CreateBillingScheduleUseCase {
  constructor(private readonly billing: BillingRepositoryPort) {}
  async execute(input: {
    subscriptionId: string;
    billingAccountId: string;
    frequency: string;
    nextBillAt?: Date | null;
  }) {
    return this.billing.createBillingSchedule({
      ...input,
      metadata: {},
    });
  }
}

export class PreviewInvoiceUseCase {
  constructor(private readonly billing: BillingRepositoryPort) {}
  async execute(input: {
    currency: string;
    lines: readonly {
      description: string;
      quantity: string | number;
      unitPrice: string;
      discountAmount?: string;
      taxAmount?: string;
    }[];
    taxLines?: readonly { taxAmount: string }[];
    discountTotal?: string;
  }) {
    const totals = sumInvoiceTotals({ currency: input.currency, lines: input.lines, taxLines: input.taxLines });
    return { preview: true, ...totals, discountTotal: input.discountTotal ?? '0.00' };
  }
}

export class CreateDraftInvoiceFromSubscriptionUseCase {
  constructor(
    private readonly billing: BillingRepositoryPort,
    private readonly subscriptions: SubscriptionRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    subscriptionId: string;
    periodId?: string | null;
    lines?: readonly {
      lineNumber: number;
      description: string;
      quantity: string;
      unitPrice: string;
      discountAmount?: string;
      taxAmount?: string;
      taxableAmount?: string;
      lineTotal?: string;
      planRef?: string | null;
    }[];
  }) {
    const sub = await this.subscriptions.getById(input.subscriptionId);
    if (!sub) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Subscription not found');
    let account = await this.billing.getBillingAccountForSubscription(sub.id);
    if (!account) {
      account = await this.billing.createBillingAccount({
        commercialAccountId: sub.accountId,
        currency: sub.currency,
        createdBy: input.actorId,
      });
      await this.billing.linkSubscriptionToBillingAccount({
        billingAccountId: account.id,
        subscriptionId: sub.id,
      });
    }
    const profile = await this.billing.getCurrentBillingProfile(account.id);
    const invoice = await this.billing.createInvoice({
      billingAccountId: account.id,
      subscriptionId: sub.id,
      periodId: input.periodId ?? null,
      currency: sub.currency,
      profileSnapshot: profile?.snapshot ?? {},
      commercialSnapshot: sub.commercialSnapshot ?? {},
      createdBy: input.actorId,
      status: InvoiceStatus.DRAFT,
    });

    const defaultLines =
      input.lines ??
      ([
        {
          lineNumber: 1,
          description: `Subscription ${sub.subscriptionNumber}`,
          quantity: '1',
          unitPrice:
            (sub.commercialSnapshot?.amount as string | undefined) ??
            (sub.commercialSnapshot?.total as string | undefined) ??
            '0.00',
          discountAmount: '0',
          taxAmount: '0',
          taxableAmount: '0',
          lineTotal: '0',
          planRef: sub.planId,
        },
      ] as const);

    const computed = sumInvoiceTotals({
      currency: sub.currency,
      lines: defaultLines.map((l) => ({
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        discountAmount: l.discountAmount,
        taxAmount: l.taxAmount,
      })),
    });

    const enriched = defaultLines.map((l, i) => {
      const qty = l.quantity;
      const unit = l.unitPrice;
      const qtyNum = Number(qty);
      const unitMoney = parseMoneyAmount(unit, sub.currency);
      const lineMoney = {
        currency: sub.currency,
        units:
          (unitMoney.units * BigInt(Math.round(qtyNum * 1_000_000))) /
          1_000_000n,
      };
      const discount = parseMoneyAmount(l.discountAmount ?? '0', sub.currency);
      const net = addMoney(lineMoney, { currency: sub.currency, units: -discount.units });
      const lineTotal = l.lineTotal ?? formatMoneyAmount(net);
      return {
        lineNumber: l.lineNumber ?? i + 1,
        description: l.description,
        quantity: qty,
        unitPrice: unit,
        discountAmount: l.discountAmount ?? '0',
        taxableAmount: l.taxableAmount ?? lineTotal,
        taxRate: null,
        taxAmount: l.taxAmount ?? '0',
        lineTotal,
        productRef: sub.productId,
        planRef: l.planRef ?? sub.planId,
        metadata: {},
      };
    });

    await this.billing.addInvoiceLines(invoice.id, enriched);
    const updated = await this.billing.updateInvoice(invoice.id, {
      subtotal: computed.subtotal,
      taxTotal: computed.taxTotal,
      total: computed.total,
      amountDue: computed.total,
    });
    return updated;
  }
}

export class ApproveInvoiceUseCase {
  constructor(private readonly billing: BillingRepositoryPort) {}
  async execute(input: { actorId: string; invoiceId: string }) {
    const invoice = await this.billing.getInvoice(input.invoiceId);
    if (!invoice) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Invoice not found');
    assertInvoiceStatusTransition(invoice.status, InvoiceStatus.APPROVED);
    const updated = await this.billing.updateInvoice(invoice.id, { status: InvoiceStatus.APPROVED });
    await this.billing.appendInvoiceStatusHistory({
      invoiceId: invoice.id,
      fromStatus: invoice.status,
      toStatus: InvoiceStatus.APPROVED,
      actorId: input.actorId,
    });
    return updated;
  }
}

export class IssueInvoiceUseCase {
  constructor(
    private readonly billing: BillingRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}

  async execute(input: { actorId: string; invoiceId: string; dueAt?: Date | null }) {
    const invoice = await this.billing.getInvoice(input.invoiceId);
    if (!invoice) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Invoice not found');
    if (invoice.status !== InvoiceStatus.APPROVED) {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        'Invoice must be APPROVED before issue',
        [{ status: invoice.status }],
      );
    }
    assertInvoiceStatusTransition(invoice.status, InvoiceStatus.ISSUED);

    const issueAt = new Date();
    const dueAt =
      input.dueAt ??
      invoice.dueAt ??
      new Date(issueAt.getTime() + 30 * 24 * 60 * 60 * 1000);

    const { buildInvoicePdfArtifact } = await import(
      '../../infrastructure/billing/invoice-pdf.js'
    );
    const pdf = buildInvoicePdfArtifact({
      invoiceNumber: invoice.invoiceNumber,
      billingAccountId: invoice.billingAccountId,
      currency: invoice.currency,
      total: invoice.total,
      issueAt: issueAt.toISOString(),
      legalName:
        typeof invoice.profileSnapshot?.legalName === 'string'
          ? invoice.profileSnapshot.legalName
          : undefined,
    });

    const document = await this.billing.storeInvoiceDocument({
      invoiceId: invoice.id,
      documentType: 'PDF',
      storageRef: pdf.storageRef,
      contentSha256: pdf.contentSha256,
    });

    const updated = await this.billing.updateInvoice(invoice.id, {
      status: InvoiceStatus.ISSUED,
      issueAt,
      dueAt,
      issuedDocumentRef: document.storageRef,
      amountDue: invoice.total,
    });

    await this.billing.appendJournalEntry({
      entryType: 'INVOICE_ISSUED',
      referenceType: 'INVOICE',
      referenceId: invoice.id,
      billingAccountId: invoice.billingAccountId,
      currency: invoice.currency,
      amount: invoice.total,
      direction: 'DEBIT',
      description: `Invoice ${invoice.invoiceNumber} issued`,
      correlationId: invoice.correlationId ?? randomUUID(),
      actorId: input.actorId,
    });

    await this.billing.appendInvoiceStatusHistory({
      invoiceId: invoice.id,
      fromStatus: invoice.status,
      toStatus: InvoiceStatus.ISSUED,
      actorId: input.actorId,
    });

    const correlationId = randomUUID();
    await enqueueBilling(
      this.outbox,
      createBillingInvoiceIssuedEvent({
        actorId: input.actorId,
        correlationId,
        invoiceId: invoice.id,
        billingAccountId: invoice.billingAccountId,
        total: invoice.total,
        currency: invoice.currency,
      }),
    );

    return { ...updated, document, pdfContentBase64: pdf.contentBase64 };
  }
}

export class VoidInvoiceUseCase {
  constructor(private readonly billing: BillingRepositoryPort) {}
  async execute(input: { actorId: string; invoiceId: string; reason: string }) {
    const invoice = await this.billing.getInvoice(input.invoiceId);
    if (!invoice) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Invoice not found');
    if (invoice.status === InvoiceStatus.PAID || invoice.status === InvoiceStatus.PARTIALLY_PAID) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Cannot void invoice after payment');
    }
    assertInvoiceStatusTransition(invoice.status, InvoiceStatus.VOIDED);
    const updated = await this.billing.updateInvoice(invoice.id, { status: InvoiceStatus.VOIDED });
    await this.billing.appendInvoiceStatusHistory({
      invoiceId: invoice.id,
      fromStatus: invoice.status,
      toStatus: InvoiceStatus.VOIDED,
      reason: input.reason,
      actorId: input.actorId,
    });
    return updated;
  }
}

export class CreatePaymentIntentUseCase {
  constructor(
    private readonly billing: BillingRepositoryPort,
    private readonly payments: PaymentProviderPort,
  ) {}

  async execute(input: {
    actorId: string;
    billingAccountId: string;
    invoiceId?: string | null;
    amount: string;
    currency: string;
  }) {
    const correlationId = randomUUID();
    const provider = 'resolving';
    const intent = await this.billing.createPaymentIntent({
      billingAccountId: input.billingAccountId,
      invoiceId: input.invoiceId ?? null,
      amount: input.amount,
      currency: input.currency,
      provider,
      correlationId,
      status: PaymentIntentStatus.CREATED,
    });

    const result = await this.payments.createPaymentIntent({
      billingAccountId: input.billingAccountId,
      invoiceId: input.invoiceId ?? null,
      amount: input.amount,
      currency: input.currency,
      correlationId,
    });

    let status = PaymentIntentStatus.CREATED;
    let providerRef: string | null = null;
    let attemptStatus = 'FAILED';
    let failureCode: string | null = null;
    let failureMessage: string | null = null;

    if (result.outcome === 'UNAVAILABLE' || result.outcome === 'FAILED') {
      status = PaymentIntentStatus.FAILED;
      failureCode = 'failureCode' in result ? result.failureCode : 'PROVIDER_ERROR';
      failureMessage = 'failureMessage' in result ? result.failureMessage : 'Provider failed';
    } else if (result.outcome === 'REQUIRES_ACTION') {
      status = PaymentIntentStatus.REQUIRES_ACTION;
      providerRef = result.providerIntentRef;
      attemptStatus = 'REQUIRES_ACTION';
    } else if (result.outcome === 'REQUESTED') {
      status = PaymentIntentStatus.PROCESSING;
      providerRef = result.providerIntentRef;
      attemptStatus = 'REQUESTED';
    } else if (result.outcome === 'SUCCEEDED') {
      status = PaymentIntentStatus.SUCCEEDED;
      providerRef = result.providerIntentRef;
      attemptStatus = 'SUCCEEDED';
    }

    let providerName = provider;
    if ('provider' in result) {
      providerName = result.provider;
    }
    const updated = await this.billing.updatePaymentIntent(intent.id, {
      status,
      providerIntentRef: providerRef,
      metadata: { provider: providerName },
    });

    await this.billing.createPaymentAttempt({
      intentId: intent.id,
      attemptNumber: 1,
      status: attemptStatus,
      providerRef,
      failureCode,
      failureMessage,
      rawResponse: result as unknown as Record<string, unknown>,
    });

    return { intent: updated, providerResult: result };
  }
}

export class ConfirmPaymentIntentUseCase {
  constructor(
    private readonly billing: BillingRepositoryPort,
    private readonly payments: PaymentProviderPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}

  async execute(input: {
    actorId: string;
    paymentIntentId: string;
    /** Only true when verified webhook handler validated signature */
    providerConfirmed?: boolean;
  }) {
    const intent = await this.billing.getPaymentIntent(input.paymentIntentId);
    if (!intent) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Payment intent not found');
    if (intent.status === PaymentIntentStatus.SUCCEEDED) return { intent, alreadyConfirmed: true };

    let outcome:
      | { status: PaymentIntentStatus; providerRef?: string | null; proof: 'fetch' | 'webhook' }
      | null = null;

    if (input.providerConfirmed) {
      if (!intent.providerIntentRef) {
        throw new DomainError(
          ErrorCode.VALIDATION_ERROR,
          'providerConfirmed requires provider intent ref from verified webhook',
        );
      }
      outcome = { status: PaymentIntentStatus.SUCCEEDED, providerRef: intent.providerIntentRef, proof: 'webhook' };
    } else if (intent.providerIntentRef) {
      const fetched = await this.payments.fetchPaymentStatus({
        provider: intent.provider,
        providerIntentRef: intent.providerIntentRef,
      });
      if (fetched.outcome === 'UNAVAILABLE') {
        throw new DomainError(
          ErrorCode.VALIDATION_ERROR,
          'Cannot confirm payment as succeeded — provider UNAVAILABLE',
        );
      }
      if (fetched.outcome === 'SUCCEEDED') {
        outcome = { status: PaymentIntentStatus.SUCCEEDED, providerRef: fetched.providerRef, proof: 'fetch' };
      } else if (fetched.outcome === 'FAILED') {
        assertPaymentStatusTransition(intent.status, PaymentIntentStatus.FAILED);
        const failed = await this.billing.updatePaymentIntent(intent.id, { status: PaymentIntentStatus.FAILED });
        return { intent: failed, confirmed: false };
      } else {
        throw new DomainError(
          ErrorCode.VALIDATION_ERROR,
          'Payment not yet succeeded at provider — await webhook or action',
        );
      }
    } else {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        'Cannot confirm without provider proof or verified webhook',
      );
    }

    assertPaymentStatusTransition(intent.status, outcome.status);
    const updated = await this.billing.updatePaymentIntent(intent.id, { status: outcome.status });
    await this.billing.createPaymentAttempt({
      intentId: intent.id,
      attemptNumber: 2,
      status: 'SUCCEEDED',
      providerRef: outcome.providerRef ?? null,
      rawResponse: { proof: outcome.proof },
    });

    const correlationId = randomUUID();
    await enqueueBilling(
      this.outbox,
      createBillingPaymentSucceededEvent({
        actorId: input.actorId,
        correlationId,
        paymentIntentId: intent.id,
        providerRef: outcome.providerRef,
      }),
    );

    return { intent: updated, confirmed: true, proof: outcome.proof };
  }
}

export class AllocatePaymentUseCase {
  constructor(private readonly billing: BillingRepositoryPort) {}
  async execute(input: {
    paymentIntentId: string;
    invoiceId: string;
    amount: string;
    currency: string;
  }) {
    const intent = await this.billing.getPaymentIntent(input.paymentIntentId);
    if (!intent) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Payment intent not found');
    if (intent.status !== PaymentIntentStatus.SUCCEEDED) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Only succeeded intents can be allocated');
    }
    const existing = await this.billing.listPaymentAllocationsForIntent(intent.id);
    const amounts = [...existing.map((a) => a.amount), input.amount];
    assertAllocationDoesNotExceed(intent.amount, amounts, intent.currency);
    return this.billing.createPaymentAllocation(input);
  }
}

export class MarkInvoicePaidIfSettledUseCase {
  constructor(
    private readonly billing: BillingRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
    private readonly confirmBilling?: ConfirmBillingCoordinationUseCase,
  ) {}

  async execute(input: {
    actorId: string;
    invoiceId: string;
    subscriptionId?: string | null;
    coordinationId?: string | null;
  }) {
    const invoice = await this.billing.getInvoice(input.invoiceId);
    if (!invoice) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Invoice not found');

    const paid = parseMoneyAmount(invoice.amountPaid, invoice.currency);
    const due = parseMoneyAmount(invoice.amountDue, invoice.currency);
    let nextStatus = invoice.status;
    if (due.units <= 0n) {
      nextStatus = InvoiceStatus.PAID;
    } else if (paid.units > 0n && due.units > 0n) {
      nextStatus = InvoiceStatus.PARTIALLY_PAID;
    } else {
      return { invoice, settled: false };
    }

    if (nextStatus !== invoice.status) {
      assertInvoiceStatusTransition(invoice.status, nextStatus);
      await this.billing.updateInvoice(invoice.id, { status: nextStatus });
      await this.billing.appendInvoiceStatusHistory({
        invoiceId: invoice.id,
        fromStatus: invoice.status,
        toStatus: nextStatus,
        actorId: input.actorId,
      });
    }

    const correlationId = randomUUID();
    if (nextStatus === InvoiceStatus.PAID) {
      await enqueueBilling(
        this.outbox,
        createBillingInvoicePaidEvent({
          actorId: input.actorId,
          correlationId,
          invoiceId: invoice.id,
          billingAccountId: invoice.billingAccountId,
        }),
      );
      if (input.subscriptionId && input.coordinationId && this.confirmBilling) {
        await this.confirmBilling.execute({
          actorId: input.actorId,
          subscriptionId: input.subscriptionId,
          coordinationId: input.coordinationId,
        });
      }
    } else if (nextStatus === InvoiceStatus.PARTIALLY_PAID) {
      await enqueueBilling(
        this.outbox,
        createBillingInvoicePartiallyPaidEvent({
          actorId: input.actorId,
          correlationId,
          invoiceId: invoice.id,
          amountPaid: invoice.amountPaid,
          amountDue: invoice.amountDue,
        }),
      );
    }

    return { invoice: await this.billing.getInvoice(invoice.id), settled: nextStatus === InvoiceStatus.PAID };
  }
}

export class CreateRefundUseCase {
  constructor(private readonly billing: BillingRepositoryPort) {}
  execute(input: {
    paymentIntentId: string;
    amount: string;
    currency: string;
    reason?: string | null;
    invoiceId?: string | null;
  }) {
    return this.billing.createRefund({ ...input, status: RefundStatus.REQUESTED });
  }
}

export class ApproveRefundUseCase {
  constructor(
    private readonly billing: BillingRepositoryPort,
    private readonly payments: PaymentProviderPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}

  async execute(input: { actorId: string; refundId: string; requesterId: string }) {
    assertNoSelfApproval({ requesterId: input.requesterId, decisionBy: input.actorId });
    const refund = await this.billing.getRefund(input.refundId);
    if (!refund) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Refund not found');
    const intent = await this.billing.getPaymentIntent(refund.paymentIntentId);
    if (!intent) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Payment intent not found');
    assertRefundDoesNotExceed(intent.amount, refund.amount, refund.currency);

    await this.billing.updateRefund(refund.id, {
      status: RefundStatus.APPROVED,
      approvedBy: input.actorId,
    });

    if (!intent.providerIntentRef) {
      return this.billing.updateRefund(refund.id, { status: RefundStatus.FAILED });
    }

    const result = await this.payments.refundPayment({
      provider: intent.provider,
      providerIntentRef: intent.providerIntentRef,
      amount: refund.amount,
      currency: refund.currency,
      correlationId: randomUUID(),
      reason: refund.reason,
    });

    if (result.outcome === 'UNAVAILABLE' || result.outcome === 'FAILED') {
      return this.billing.updateRefund(refund.id, { status: RefundStatus.FAILED });
    }

    const providerRef =
      result.outcome === 'SUCCEEDED' || result.outcome === 'REQUESTED' ? result.providerRef : null;
    const updated = await this.billing.updateRefund(refund.id, {
      status: result.outcome === 'SUCCEEDED' ? RefundStatus.SUCCEEDED : RefundStatus.PROCESSING,
      providerRef,
    });

    if (updated.status === RefundStatus.SUCCEEDED) {
      await enqueueBilling(
        this.outbox,
        createBillingRefundCompletedEvent({
          actorId: input.actorId,
          correlationId: randomUUID(),
          refundId: updated.id,
          paymentIntentId: intent.id,
          amount: updated.amount,
        }),
      );
    }
    return updated;
  }
}

export class OpenCollectionCaseUseCase {
  constructor(
    private readonly billing: BillingRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}

  async execute(input: { actorId: string; billingAccountId: string; invoiceId: string }) {
    const policy = await this.billing.getBillingPolicyByCode('DUNNING_DEFAULT');
    const collection = await this.billing.openCollectionCase({
      billingAccountId: input.billingAccountId,
      invoiceId: input.invoiceId,
      overdueSince: new Date(),
      policyCode: policy?.code ?? 'DUNNING_DEFAULT',
    });
    await enqueueBilling(
      this.outbox,
      createBillingCollectionStartedEvent({
        actorId: input.actorId,
        correlationId: randomUUID(),
        caseId: collection.id,
        invoiceId: input.invoiceId,
      }),
    );
    return collection;
  }
}

export class RecordDunningAttemptUseCase {
  constructor(private readonly billing: BillingRepositoryPort) {}
  execute(input: { caseId: string; channel: string; templateRef?: string | null }) {
    return this.billing.recordDunningAttempt(input);
  }
}

export class AppendJournalEntryUseCase {
  constructor(private readonly billing: BillingRepositoryPort) {}
  execute(input: Omit<Parameters<BillingRepositoryPort['appendJournalEntry']>[0], 'actorId'> & {
    actorId: string;
  }) {
    return this.billing.appendJournalEntry({ ...input, actorId: input.actorId });
  }
}

export class ListInvoicesUseCase {
  constructor(private readonly billing: BillingRepositoryPort) {}
  execute(input?: { billingAccountId?: string; status?: string; limit?: number }) {
    return this.billing.listInvoices(input);
  }
}

export class GetInvoiceUseCase {
  constructor(private readonly billing: BillingRepositoryPort) {}
  async execute(invoiceId: string) {
    const invoice = await this.billing.getInvoice(invoiceId);
    if (!invoice) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Invoice not found');
    const [lines, taxLines, documents] = await Promise.all([
      this.billing.listInvoiceLines(invoiceId),
      this.billing.listInvoiceTaxLines(invoiceId),
      this.billing.listInvoiceDocuments(invoiceId),
    ]);
    return { ...invoice, lines, taxLines, documents };
  }
}

export class GetBillingOverviewUseCase {
  constructor(private readonly billing: BillingRepositoryPort) {}
  execute() {
    return this.billing.getBillingOverview();
  }
}

export class GetBillingAnalyticsUseCase {
  constructor(private readonly billing: BillingRepositoryPort) {}
  execute(currency?: string) {
    return this.billing.getBillingAnalytics(currency);
  }
}

export class ProcessPaymentWebhookUseCase {
  constructor(
    private readonly billing: BillingRepositoryPort,
    private readonly confirmPayment: ConfirmPaymentIntentUseCase,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}

  async execute(input: {
    actorId: string;
    provider: string;
    providerEventId: string;
    signatureValid: boolean;
    payload: Record<string, unknown>;
    paymentIntentId?: string | null;
  }) {
    const existing = await this.billing.getWebhookEventByProviderId(input.providerEventId);
    if (existing?.processingStatus === 'PROCESSED') {
      return { duplicate: true, event: existing };
    }

    const event = await this.billing.ingestWebhookEvent({
      provider: input.provider,
      providerEventId: input.providerEventId,
      signatureValid: input.signatureValid,
      payload: input.payload,
    });

    if (!input.signatureValid) {
      await this.billing.updateWebhookEvent(event.id, {
        processingStatus: 'FAILED',
        processedAt: new Date(),
      });
      return { rejected: true, reason: 'invalid_signature' };
    }

    const intentId =
      input.paymentIntentId ??
      (typeof input.payload.intentId === 'string' ? input.payload.intentId : null);
    if (!intentId) {
      await this.billing.updateWebhookEvent(event.id, {
        processingStatus: 'IGNORED',
        processedAt: new Date(),
      });
      return { ignored: true };
    }

    const status = String(input.payload.status ?? '').toUpperCase();
    if (status === 'SUCCEEDED') {
      await this.confirmPayment.execute({
        actorId: input.actorId,
        paymentIntentId: intentId,
        providerConfirmed: true,
      });
    } else if (status === 'FAILED') {
      const intent = await this.billing.getPaymentIntent(intentId);
      if (intent) {
        await this.billing.updatePaymentIntent(intent.id, { status: PaymentIntentStatus.FAILED });
        await enqueueBilling(
          this.outbox,
          createBillingPaymentFailedEvent({
            actorId: input.actorId,
            correlationId: randomUUID(),
            paymentIntentId: intent.id,
            failureCode: String(input.payload.failureCode ?? 'WEBHOOK_FAILED'),
          }),
        );
      }
    }

    await this.billing.updateWebhookEvent(event.id, {
      processingStatus: 'PROCESSED',
      processedAt: new Date(),
    });
    return { processed: true, eventId: event.id };
  }
}

export class IngestSubscriptionBillingCoordinationUseCase {
  constructor(
    private readonly billing: BillingRepositoryPort,
    private readonly subscriptions: SubscriptionRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    subscriptionId: string;
    coordinationId?: string | null;
  }) {
    const sub = await this.subscriptions.getById(input.subscriptionId);
    if (!sub) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Subscription not found');

    let account = await this.billing.findBillingAccountByCommercial(sub.accountId);
    if (!account) {
      account = await this.billing.createBillingAccount({
        commercialAccountId: sub.accountId,
        currency: sub.currency,
        createdBy: input.actorId,
      });
    }

    await this.billing.linkSubscriptionToBillingAccount({
      billingAccountId: account.id,
      subscriptionId: sub.id,
    });

    await this.billing.upsertBillingProfile({
      billingAccountId: account.id,
      legalName: String(sub.commercialSnapshot?.accountName ?? `Account ${sub.accountId}`),
      currency: sub.currency,
      paymentTermsDays: 30,
      snapshot: { subscriptionId: sub.id, coordinationId: input.coordinationId ?? null },
    });

    const schedules = await this.billing.listBillingSchedules(sub.id);
    let schedule = schedules[0];
    if (!schedule) {
      schedule = await this.billing.createBillingSchedule({
        subscriptionId: sub.id,
        billingAccountId: account.id,
        frequency: sub.billingFrequency ?? 'MONTHLY',
        nextBillAt: sub.currentPeriodEnd,
      });
    }

    return { billingAccount: account, schedule, note: 'P6 ingested coordination — no subscription status change' };
  }
}
