import { randomUUID } from 'node:crypto';
import type { IntegrationEvent } from '../../../../core/domain/events/integration-event.js';

export const EDGE_SALES_OUTBOX_TENANT = 'edge-control-plane';

function salesEvent<T>(params: {
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
    tenantId: EDGE_SALES_OUTBOX_TENANT,
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

export function createCommercialAccountCreatedEvent(params: {
  actorId: string;
  correlationId: string;
  accountId: string;
  accountNumber: string;
  legalName: string;
}) {
  return salesEvent({
    eventType: 'sales.account.created.v1',
    actorId: params.actorId,
    correlationId: params.correlationId,
    aggregateType: 'COMMERCIAL_ACCOUNT',
    aggregateId: params.accountId,
    payload: {
      accountId: params.accountId,
      accountNumber: params.accountNumber,
      legalName: params.legalName,
    },
  });
}

export function createCommercialAccountMergedEvent(params: {
  actorId: string;
  correlationId: string;
  survivingAccountId: string;
  mergedAccountId: string;
  reason: string;
}) {
  return salesEvent({
    eventType: 'sales.account.merged.v1',
    actorId: params.actorId,
    correlationId: params.correlationId,
    aggregateType: 'COMMERCIAL_ACCOUNT',
    aggregateId: params.survivingAccountId,
    payload: {
      survivingAccountId: params.survivingAccountId,
      mergedAccountId: params.mergedAccountId,
      reason: params.reason,
    },
  });
}

export function createSalesContactCreatedEvent(params: {
  actorId: string;
  correlationId: string;
  contactId: string;
  accountId: string;
}) {
  return salesEvent({
    eventType: 'sales.contact.created.v1',
    actorId: params.actorId,
    correlationId: params.correlationId,
    aggregateType: 'SALES_CONTACT',
    aggregateId: params.contactId,
    payload: { contactId: params.contactId, accountId: params.accountId },
  });
}

export function createSalesLeadReceivedEvent(params: {
  actorId: string;
  correlationId: string;
  salesLeadId: string;
  marketingLeadId: string;
}) {
  return salesEvent({
    eventType: 'sales.lead.received.v1',
    actorId: params.actorId,
    correlationId: params.correlationId,
    aggregateType: 'SALES_LEAD',
    aggregateId: params.salesLeadId,
    payload: {
      salesLeadId: params.salesLeadId,
      marketingLeadId: params.marketingLeadId,
    },
  });
}

export function createSalesLeadAcceptedEvent(params: {
  actorId: string;
  correlationId: string;
  salesLeadId: string;
  marketingLeadId: string;
  accountId: string | null;
}) {
  return salesEvent({
    eventType: 'sales.lead.accepted.v1',
    actorId: params.actorId,
    correlationId: params.correlationId,
    aggregateType: 'SALES_LEAD',
    aggregateId: params.salesLeadId,
    payload: {
      salesLeadId: params.salesLeadId,
      marketingLeadId: params.marketingLeadId,
      accountId: params.accountId,
    },
  });
}

export function createSalesLeadRejectedEvent(params: {
  actorId: string;
  correlationId: string;
  salesLeadId: string;
  marketingLeadId: string;
  reasonCode: string | null;
}) {
  return salesEvent({
    eventType: 'sales.lead.rejected.v1',
    actorId: params.actorId,
    correlationId: params.correlationId,
    aggregateType: 'SALES_LEAD',
    aggregateId: params.salesLeadId,
    payload: {
      salesLeadId: params.salesLeadId,
      marketingLeadId: params.marketingLeadId,
      reasonCode: params.reasonCode,
    },
  });
}

export function createSalesLeadQualifiedEvent(params: {
  actorId: string;
  correlationId: string;
  salesLeadId: string;
  marketingLeadId: string;
}) {
  return salesEvent({
    eventType: 'sales.lead.qualified.v1',
    actorId: params.actorId,
    correlationId: params.correlationId,
    aggregateType: 'SALES_LEAD',
    aggregateId: params.salesLeadId,
    payload: {
      salesLeadId: params.salesLeadId,
      marketingLeadId: params.marketingLeadId,
    },
  });
}

export function createSalesLeadAssignedEvent(params: {
  actorId: string;
  correlationId: string;
  salesLeadId: string;
  ownerAdministratorId: string;
}) {
  return salesEvent({
    eventType: 'sales.lead.assigned.v1',
    actorId: params.actorId,
    correlationId: params.correlationId,
    aggregateType: 'SALES_LEAD',
    aggregateId: params.salesLeadId,
    payload: {
      salesLeadId: params.salesLeadId,
      ownerAdministratorId: params.ownerAdministratorId,
    },
  });
}

export function createOpportunityCreatedEvent(params: {
  actorId: string;
  correlationId: string;
  opportunityId: string;
  accountId: string;
  pipelineId: string;
}) {
  return salesEvent({
    eventType: 'sales.opportunity.created.v1',
    actorId: params.actorId,
    correlationId: params.correlationId,
    aggregateType: 'SALES_OPPORTUNITY',
    aggregateId: params.opportunityId,
    payload: {
      opportunityId: params.opportunityId,
      accountId: params.accountId,
      pipelineId: params.pipelineId,
    },
  });
}

export function createOpportunityStageChangedEvent(params: {
  actorId: string;
  correlationId: string;
  opportunityId: string;
  fromStageId: string | null;
  toStageId: string;
}) {
  return salesEvent({
    eventType: 'sales.opportunity.stage_changed.v1',
    actorId: params.actorId,
    correlationId: params.correlationId,
    aggregateType: 'SALES_OPPORTUNITY',
    aggregateId: params.opportunityId,
    payload: {
      opportunityId: params.opportunityId,
      fromStageId: params.fromStageId,
      toStageId: params.toStageId,
    },
  });
}

export function createOpportunityWonEvent(params: {
  actorId: string;
  correlationId: string;
  opportunityId: string;
  accountId: string;
  estimatedValue: string | null;
  currency: string;
}) {
  return salesEvent({
    eventType: 'sales.opportunity.won.v1',
    actorId: params.actorId,
    correlationId: params.correlationId,
    aggregateType: 'SALES_OPPORTUNITY',
    aggregateId: params.opportunityId,
    payload: {
      opportunityId: params.opportunityId,
      accountId: params.accountId,
      estimatedValue: params.estimatedValue,
      currency: params.currency,
      note: 'Does not trigger provisioning by itself',
    },
  });
}

export function createOpportunityLostEvent(params: {
  actorId: string;
  correlationId: string;
  opportunityId: string;
  lossReasonCode: string;
}) {
  return salesEvent({
    eventType: 'sales.opportunity.lost.v1',
    actorId: params.actorId,
    correlationId: params.correlationId,
    aggregateType: 'SALES_OPPORTUNITY',
    aggregateId: params.opportunityId,
    payload: {
      opportunityId: params.opportunityId,
      lossReasonCode: params.lossReasonCode,
    },
  });
}

export function createNeedsAssessmentCompletedEvent(params: {
  actorId: string;
  correlationId: string;
  assessmentId: string;
  opportunityId: string;
  fitDecision: string | null;
}) {
  return salesEvent({
    eventType: 'sales.needs_assessment.completed.v1',
    actorId: params.actorId,
    correlationId: params.correlationId,
    aggregateType: 'NEEDS_ASSESSMENT',
    aggregateId: params.assessmentId,
    payload: {
      assessmentId: params.assessmentId,
      opportunityId: params.opportunityId,
      fitDecision: params.fitDecision,
    },
  });
}

export function createOfferConfigurationCreatedEvent(params: {
  actorId: string;
  correlationId: string;
  configurationId: string;
  opportunityId: string;
  productId: string;
}) {
  return salesEvent({
    eventType: 'sales.offer_configuration.created.v1',
    actorId: params.actorId,
    correlationId: params.correlationId,
    aggregateType: 'OFFER_CONFIGURATION',
    aggregateId: params.configurationId,
    payload: {
      configurationId: params.configurationId,
      opportunityId: params.opportunityId,
      productId: params.productId,
    },
  });
}

export function createQuoteCreatedEvent(params: {
  actorId: string;
  correlationId: string;
  quoteId: string;
  quoteNumber: string;
  opportunityId: string;
}) {
  return salesEvent({
    eventType: 'sales.quote.created.v1',
    actorId: params.actorId,
    correlationId: params.correlationId,
    aggregateType: 'SALES_QUOTE',
    aggregateId: params.quoteId,
    payload: {
      quoteId: params.quoteId,
      quoteNumber: params.quoteNumber,
      opportunityId: params.opportunityId,
    },
  });
}

export function createQuoteIssuedEvent(params: {
  actorId: string;
  correlationId: string;
  quoteId: string;
  version: number;
}) {
  return salesEvent({
    eventType: 'sales.quote.issued.v1',
    actorId: params.actorId,
    correlationId: params.correlationId,
    aggregateType: 'SALES_QUOTE',
    aggregateId: params.quoteId,
    payload: { quoteId: params.quoteId, version: params.version },
  });
}

export function createQuoteAcceptedEvent(params: {
  actorId: string;
  correlationId: string;
  quoteId: string;
}) {
  return salesEvent({
    eventType: 'sales.quote.accepted.v1',
    actorId: params.actorId,
    correlationId: params.correlationId,
    aggregateType: 'SALES_QUOTE',
    aggregateId: params.quoteId,
    payload: { quoteId: params.quoteId },
  });
}

export function createProposalIssuedEvent(params: {
  actorId: string;
  correlationId: string;
  proposalId: string;
}) {
  return salesEvent({
    eventType: 'sales.proposal.issued.v1',
    actorId: params.actorId,
    correlationId: params.correlationId,
    aggregateType: 'SALES_PROPOSAL',
    aggregateId: params.proposalId,
    payload: { proposalId: params.proposalId },
  });
}

export function createDiscountRequestedEvent(params: {
  actorId: string;
  correlationId: string;
  requestId: string;
  requiredLevel: string;
}) {
  return salesEvent({
    eventType: 'sales.discount.requested.v1',
    actorId: params.actorId,
    correlationId: params.correlationId,
    aggregateType: 'DISCOUNT_REQUEST',
    aggregateId: params.requestId,
    payload: { requestId: params.requestId, requiredLevel: params.requiredLevel },
  });
}

export function createDiscountApprovedEvent(params: {
  actorId: string;
  correlationId: string;
  requestId: string;
}) {
  return salesEvent({
    eventType: 'sales.discount.approved.v1',
    actorId: params.actorId,
    correlationId: params.correlationId,
    aggregateType: 'DISCOUNT_REQUEST',
    aggregateId: params.requestId,
    payload: { requestId: params.requestId },
  });
}

export function createDiscountRejectedEvent(params: {
  actorId: string;
  correlationId: string;
  requestId: string;
}) {
  return salesEvent({
    eventType: 'sales.discount.rejected.v1',
    actorId: params.actorId,
    correlationId: params.correlationId,
    aggregateType: 'DISCOUNT_REQUEST',
    aggregateId: params.requestId,
    payload: { requestId: params.requestId },
  });
}

export function createContractCreatedEvent(params: {
  actorId: string;
  correlationId: string;
  contractId: string;
  contractNumber: string;
}) {
  return salesEvent({
    eventType: 'sales.contract.created.v1',
    actorId: params.actorId,
    correlationId: params.correlationId,
    aggregateType: 'COMMERCIAL_CONTRACT',
    aggregateId: params.contractId,
    payload: {
      contractId: params.contractId,
      contractNumber: params.contractNumber,
    },
  });
}

export function createContractExecutedEvent(params: {
  actorId: string;
  correlationId: string;
  contractId: string;
}) {
  return salesEvent({
    eventType: 'sales.contract.executed.v1',
    actorId: params.actorId,
    correlationId: params.correlationId,
    aggregateType: 'COMMERCIAL_CONTRACT',
    aggregateId: params.contractId,
    payload: { contractId: params.contractId },
  });
}

export function createSalesOrderCreatedEvent(params: {
  actorId: string;
  correlationId: string;
  orderId: string;
  orderNumber: string;
}) {
  return salesEvent({
    eventType: 'sales.order.created.v1',
    actorId: params.actorId,
    correlationId: params.correlationId,
    aggregateType: 'SALES_ORDER',
    aggregateId: params.orderId,
    payload: { orderId: params.orderId, orderNumber: params.orderNumber },
  });
}

export function createSalesHandoffRequestedEvent(params: {
  actorId: string;
  correlationId: string;
  handoffId: string;
  salesOrderId: string;
}) {
  return salesEvent({
    eventType: 'sales.handoff.requested.v1',
    actorId: params.actorId,
    correlationId: params.correlationId,
    aggregateType: 'SALES_HANDOFF',
    aggregateId: params.handoffId,
    payload: {
      handoffId: params.handoffId,
      salesOrderId: params.salesOrderId,
      note: 'Does not create tenants or subscriptions',
    },
  });
}

export function createSalesHandoffAcceptedEvent(params: {
  actorId: string;
  correlationId: string;
  handoffId: string;
}) {
  return salesEvent({
    eventType: 'sales.handoff.accepted.v1',
    actorId: params.actorId,
    correlationId: params.correlationId,
    aggregateType: 'SALES_HANDOFF',
    aggregateId: params.handoffId,
    payload: { handoffId: params.handoffId },
  });
}

export function createProvisioningStatusReceivedEvent(params: {
  actorId: string;
  correlationId: string;
  handoffId: string;
  confirmed: boolean;
  externalRef?: string | null;
}) {
  return salesEvent({
    eventType: 'sales.provisioning.status_received.v1',
    actorId: params.actorId,
    correlationId: params.correlationId,
    aggregateType: 'SALES_HANDOFF',
    aggregateId: params.handoffId,
    payload: {
      handoffId: params.handoffId,
      confirmed: params.confirmed,
      externalRef: params.externalRef ?? null,
    },
  });
}
