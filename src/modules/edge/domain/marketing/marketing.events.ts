import { randomUUID } from 'node:crypto';
import type { IntegrationEvent } from '../../../../core/domain/events/integration-event.js';

export const EDGE_MARKETING_OUTBOX_TENANT = 'edge-control-plane';

function marketingEvent<T>(params: {
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
    tenantId: EDGE_MARKETING_OUTBOX_TENANT,
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

export function createMarketingStrategyCreatedEvent(params: {
  actorId: string;
  correlationId: string;
  strategyId: string;
  code: string;
}) {
  return marketingEvent({
    eventType: 'marketing.strategy.created.v1',
    actorId: params.actorId,
    correlationId: params.correlationId,
    aggregateType: 'MARKETING_STRATEGY',
    aggregateId: params.strategyId,
    payload: { strategyId: params.strategyId, code: params.code },
  });
}

export function createMarketingCampaignCreatedEvent(params: {
  actorId: string;
  correlationId: string;
  campaignId: string;
  productId: string;
  code: string;
}) {
  return marketingEvent({
    eventType: 'marketing.campaign.created.v1',
    actorId: params.actorId,
    correlationId: params.correlationId,
    aggregateType: 'MARKETING_CAMPAIGN',
    aggregateId: params.campaignId,
    payload: {
      campaignId: params.campaignId,
      productId: params.productId,
      code: params.code,
    },
  });
}

export function createMarketingCampaignPublishedEvent(params: {
  actorId: string;
  correlationId: string;
  campaignId: string;
  productId: string;
  version: number;
}) {
  return marketingEvent({
    eventType: 'marketing.campaign.published.v1',
    actorId: params.actorId,
    correlationId: params.correlationId,
    aggregateType: 'MARKETING_CAMPAIGN',
    aggregateId: params.campaignId,
    payload: {
      campaignId: params.campaignId,
      productId: params.productId,
      version: params.version,
    },
  });
}

export function createMarketingFormSubmittedEvent(params: {
  actorId: string;
  correlationId: string;
  submissionId: string;
  formId: string;
  leadId: string | null;
}) {
  return marketingEvent({
    eventType: 'marketing.form.submitted.v1',
    actorId: params.actorId,
    correlationId: params.correlationId,
    aggregateType: 'MARKETING_FORM_SUBMISSION',
    aggregateId: params.submissionId,
    payload: {
      submissionId: params.submissionId,
      formId: params.formId,
      leadId: params.leadId,
    },
  });
}

export function createMarketingLeadCreatedEvent(params: {
  actorId: string;
  correlationId: string;
  leadId: string;
  emailNormalized: string | null;
}) {
  return marketingEvent({
    eventType: 'marketing.lead.created.v1',
    actorId: params.actorId,
    correlationId: params.correlationId,
    aggregateType: 'MARKETING_LEAD',
    aggregateId: params.leadId,
    payload: {
      leadId: params.leadId,
      emailNormalized: params.emailNormalized,
    },
  });
}

export function createMarketingLeadQualifiedEvent(params: {
  actorId: string;
  correlationId: string;
  leadId: string;
  score: number;
  modelVersion: number;
}) {
  return marketingEvent({
    eventType: 'marketing.lead.qualified.v1',
    actorId: params.actorId,
    correlationId: params.correlationId,
    aggregateType: 'MARKETING_LEAD',
    aggregateId: params.leadId,
    payload: {
      leadId: params.leadId,
      score: params.score,
      modelVersion: params.modelVersion,
    },
  });
}
