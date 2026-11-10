import { randomUUID } from 'node:crypto';
import type { IntegrationEvent } from '../../../../core/domain/events/integration-event.js';

export const EDGE_BILLING_OUTBOX_TENANT = 'edge-control-plane';

function billingEvent<T>(params: {
  eventType: string;
  actorId: string;
  correlationId: string;
  aggregateType: string;
  aggregateId: string;
  payload: T;
}): IntegrationEvent<T> {
  return {
    eventId: randomUUID(),
    eventType: params.eventType,
    version: 1,
    occurredAt: new Date().toISOString(),
    tenantId: EDGE_BILLING_OUTBOX_TENANT,
    organizationId: null,
    correlationId: params.correlationId,
    causationId: null,
    traceId: null,
    actor: { type: 'user', id: params.actorId },
    source: 'okapi-edge',
    aggregateType: params.aggregateType,
    aggregateId: params.aggregateId,
    payload: params.payload,
  };
}

export function createBillingAccountCreatedEvent(params: {
  actorId: string;
  correlationId: string;
  billingAccountId: string;
  commercialAccountId: string;
}) {
  return billingEvent({
    eventType: 'billing.account.created.v1',
    actorId: params.actorId,
    correlationId: params.correlationId,
    aggregateType: 'BILLING_ACCOUNT',
    aggregateId: params.billingAccountId,
    payload: {
      billingAccountId: params.billingAccountId,
      commercialAccountId: params.commercialAccountId,
    },
  });
}

export function createBillingInvoiceIssuedEvent(params: {
  actorId: string;
  correlationId: string;
  invoiceId: string;
  billingAccountId: string;
  total: string;
  currency: string;
}) {
  return billingEvent({
    eventType: 'billing.invoice.issued.v1',
    actorId: params.actorId,
    correlationId: params.correlationId,
    aggregateType: 'INVOICE',
    aggregateId: params.invoiceId,
    payload: {
      invoiceId: params.invoiceId,
      billingAccountId: params.billingAccountId,
      total: params.total,
      currency: params.currency,
    },
  });
}

export function createBillingInvoicePaidEvent(params: {
  actorId: string;
  correlationId: string;
  invoiceId: string;
  billingAccountId: string;
}) {
  return billingEvent({
    eventType: 'billing.invoice.paid.v1',
    actorId: params.actorId,
    correlationId: params.correlationId,
    aggregateType: 'INVOICE',
    aggregateId: params.invoiceId,
    payload: { invoiceId: params.invoiceId, billingAccountId: params.billingAccountId },
  });
}

export function createBillingInvoicePartiallyPaidEvent(params: {
  actorId: string;
  correlationId: string;
  invoiceId: string;
  amountPaid: string;
  amountDue: string;
}) {
  return billingEvent({
    eventType: 'billing.invoice.partially_paid.v1',
    actorId: params.actorId,
    correlationId: params.correlationId,
    aggregateType: 'INVOICE',
    aggregateId: params.invoiceId,
    payload: {
      invoiceId: params.invoiceId,
      amountPaid: params.amountPaid,
      amountDue: params.amountDue,
    },
  });
}

export function createBillingInvoiceOverdueEvent(params: {
  actorId: string;
  correlationId: string;
  invoiceId: string;
  dueAt: string;
}) {
  return billingEvent({
    eventType: 'billing.invoice.overdue.v1',
    actorId: params.actorId,
    correlationId: params.correlationId,
    aggregateType: 'INVOICE',
    aggregateId: params.invoiceId,
    payload: { invoiceId: params.invoiceId, dueAt: params.dueAt },
  });
}

export function createBillingPaymentSucceededEvent(params: {
  actorId: string;
  correlationId: string;
  paymentIntentId: string;
  providerRef?: string | null;
}) {
  return billingEvent({
    eventType: 'billing.payment.succeeded.v1',
    actorId: params.actorId,
    correlationId: params.correlationId,
    aggregateType: 'PAYMENT_INTENT',
    aggregateId: params.paymentIntentId,
    payload: {
      paymentIntentId: params.paymentIntentId,
      providerRef: params.providerRef ?? null,
    },
  });
}

export function createBillingPaymentFailedEvent(params: {
  actorId: string;
  correlationId: string;
  paymentIntentId: string;
  failureCode?: string | null;
}) {
  return billingEvent({
    eventType: 'billing.payment.failed.v1',
    actorId: params.actorId,
    correlationId: params.correlationId,
    aggregateType: 'PAYMENT_INTENT',
    aggregateId: params.paymentIntentId,
    payload: {
      paymentIntentId: params.paymentIntentId,
      failureCode: params.failureCode ?? null,
    },
  });
}

export function createBillingRefundCompletedEvent(params: {
  actorId: string;
  correlationId: string;
  refundId: string;
  paymentIntentId: string;
  amount: string;
}) {
  return billingEvent({
    eventType: 'billing.refund.completed.v1',
    actorId: params.actorId,
    correlationId: params.correlationId,
    aggregateType: 'REFUND',
    aggregateId: params.refundId,
    payload: {
      refundId: params.refundId,
      paymentIntentId: params.paymentIntentId,
      amount: params.amount,
    },
  });
}

export function createBillingCollectionStartedEvent(params: {
  actorId: string;
  correlationId: string;
  caseId: string;
  invoiceId: string;
}) {
  return billingEvent({
    eventType: 'billing.collection.started.v1',
    actorId: params.actorId,
    correlationId: params.correlationId,
    aggregateType: 'COLLECTION_CASE',
    aggregateId: params.caseId,
    payload: { caseId: params.caseId, invoiceId: params.invoiceId },
  });
}

export function createBillingAccountDelinquentEvent(params: {
  actorId: string;
  correlationId: string;
  billingAccountId: string;
}) {
  return billingEvent({
    eventType: 'billing.account.delinquent.v1',
    actorId: params.actorId,
    correlationId: params.correlationId,
    aggregateType: 'BILLING_ACCOUNT',
    aggregateId: params.billingAccountId,
    payload: { billingAccountId: params.billingAccountId },
  });
}

export function createBillingAccountRecoveredEvent(params: {
  actorId: string;
  correlationId: string;
  billingAccountId: string;
}) {
  return billingEvent({
    eventType: 'billing.account.recovered.v1',
    actorId: params.actorId,
    correlationId: params.correlationId,
    aggregateType: 'BILLING_ACCOUNT',
    aggregateId: params.billingAccountId,
    payload: { billingAccountId: params.billingAccountId },
  });
}
