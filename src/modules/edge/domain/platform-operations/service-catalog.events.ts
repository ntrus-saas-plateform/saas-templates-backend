import { randomUUID } from 'node:crypto';
import type { IntegrationEvent } from '../../../../core/domain/events/integration-event.js';
import { EDGE_P7_OUTBOX_TENANT } from '../provisioning/provisioning.events.js';

export const EDGE_P9_OUTBOX_TENANT = EDGE_P7_OUTBOX_TENANT;

export const ServiceCatalogEventTypes = {
  SERVICE_REGISTERED: 'edge.p9.service.registered',
  SERVICE_UPDATED: 'edge.p9.service.updated',
  SERVICE_OWNERSHIP_CHANGED: 'edge.p9.service.ownership.changed',
  SERVICE_DEPENDENCY_ADDED: 'edge.p9.service.dependency.added',
  SERVICE_DEPENDENCY_REMOVED: 'edge.p9.service.dependency.removed',
  SERVICE_OBSERVATION_CHANGED: 'edge.p9.service.observation.changed',
} as const;

export function buildServiceCatalogOutboxEvent(input: {
  eventType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
  correlationId?: string | null;
  actorId?: string | null;
}): IntegrationEvent<Record<string, unknown>> {
  const actorId = input.actorId?.trim() || 'edge-p9-service-catalog';
  const correlationId = input.correlationId?.trim() || randomUUID();
  return {
    eventId: randomUUID(),
    eventType: input.eventType,
    version: 1,
    occurredAt: new Date().toISOString(),
    tenantId: EDGE_P9_OUTBOX_TENANT,
    organizationId: null,
    correlationId,
    causationId: null,
    traceId: null,
    actor: { type: 'service', id: actorId },
    source: 'okapi.edge.p9',
    aggregateType: 'edge_p9_service',
    aggregateId: input.aggregateId,
    payload: input.payload,
  };
}
