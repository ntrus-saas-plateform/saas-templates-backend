import { randomUUID } from 'node:crypto';
import type { IntegrationEvent } from '../../../../core/domain/events/integration-event.js';
import { EDGE_P10_OUTBOX_TENANT } from './acquisition.types.js';

export { EDGE_P10_OUTBOX_TENANT };

export const AcquisitionEventTypes = {
  PRODUCT_PRESENTATION_CREATED: 'edge.p10.product_presentation.created',
  PRODUCT_CONTENT_PUBLISHED: 'edge.p10.product_content.published',
  PLAN_PRESENTATION_CREATED: 'edge.p10.plan_presentation.created',
  PROSPECT_CREATED: 'edge.p10.prospect.created',
  PROSPECT_TRANSITIONED: 'edge.p10.prospect.transitioned',
  LEAD_CAPTURED: 'edge.p10.lead.captured',
  LEAD_PROMOTED: 'edge.p10.lead.promoted',
  FORM_SCHEMA_CREATED: 'edge.p10.form.schema.created',
  FORM_VERSION_CREATED: 'edge.p10.form.version.created',
  FORM_VERSION_PUBLISHED: 'edge.p10.form.version.published',
  FORM_PUBLICATION_CREATED: 'edge.p10.form.publication.created',
  APPLICATION_CREATED: 'edge.p10.application.created',
  APPLICATION_SUBMITTED: 'edge.p10.application.submitted',
  APPLICATION_TRANSITIONED: 'edge.p10.application.transitioned',
  DOCUMENT_UPLOADED: 'edge.p10.document.uploaded',
  DOCUMENT_REVIEWED: 'edge.p10.document.reviewed',
  QUALIFICATION_UPDATED: 'edge.p10.qualification.updated',
  QUALIFICATION_APPROVED: 'edge.p10.qualification.approved',
  QUALIFICATION_REJECTED: 'edge.p10.qualification.rejected',
  REVIEW_ASSIGNED: 'edge.p10.review.assigned',
  QUOTE_REQUESTED: 'edge.p10.quote.requested',
  QUOTE_REFERENCE_ATTACHED: 'edge.p10.quote.reference.attached',
  CHECKOUT_SESSION_CREATED: 'edge.p10.checkout.session.created',
  CHECKOUT_TRANSITIONED: 'edge.p10.checkout.transitioned',
  SUBSCRIPTION_HANDOFF_REQUESTED: 'edge.p10.subscription.handoff.requested',
  SUBSCRIPTION_HANDOFF_COMPLETED: 'edge.p10.subscription.handoff.completed',
  JOURNEY_STARTED: 'edge.p10.journey.started',
  JOURNEY_STEP_ADVANCED: 'edge.p10.journey.step.advanced',
  COMMUNICATION_QUEUED: 'edge.p10.communication.queued',
  ANALYTICS_RECORDED: 'edge.p10.analytics.recorded',
  ATTRIBUTION_RECORDED: 'edge.p10.attribution.recorded',
} as const;

export function buildAcquisitionOutboxEvent(input: {
  eventType: string;
  aggregateId: string;
  aggregateType?: string;
  payload: Record<string, unknown>;
  correlationId?: string | null;
  actorId?: string | null;
}): IntegrationEvent<Record<string, unknown>> {
  const actorId = input.actorId?.trim() || 'edge-p10-acquisition';
  const correlationId = input.correlationId?.trim() || randomUUID();
  return {
    eventId: randomUUID(),
    eventType: input.eventType,
    version: 1,
    occurredAt: new Date().toISOString(),
    tenantId: EDGE_P10_OUTBOX_TENANT,
    organizationId: null,
    correlationId,
    causationId: null,
    traceId: null,
    actor: { type: 'service', id: actorId },
    source: 'okapi.edge.p10',
    aggregateType: input.aggregateType ?? 'edge_p10_acquisition',
    aggregateId: input.aggregateId,
    payload: input.payload,
  };
}
