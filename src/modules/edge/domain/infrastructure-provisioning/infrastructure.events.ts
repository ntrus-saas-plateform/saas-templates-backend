import { randomUUID } from 'node:crypto';
import type { IntegrationEvent } from '../../../../core/domain/events/integration-event.js';
import { EDGE_P7_OUTBOX_TENANT } from '../provisioning/provisioning.events.js';

function infraEvent<T>(params: {
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
    tenantId: EDGE_P7_OUTBOX_TENANT,
    organizationId: null,
    correlationId: params.correlationId,
    causationId: null,
    traceId: null,
    actor: { type: 'service', id: params.actorId },
    source: 'okapi.edge.p7',
    aggregateType: params.aggregateType,
    aggregateId: params.aggregateId,
    payload: params.payload,
  };
}

export function createResourcePlanCreatedEvent(
  planId: string,
  tenantId: string,
  productId: string,
  correlationId: string,
  actorId = 'system',
): IntegrationEvent<Record<string, unknown>> {
  return infraEvent({
    eventType: 'p7.infrastructure.plan.created.v1',
    actorId,
    correlationId,
    aggregateType: 'resource_plan',
    aggregateId: planId,
    payload: { planId, tenantId, productId },
  });
}

export function createResourcePlanValidatedEvent(
  planId: string,
  valid: boolean,
  correlationId: string,
  actorId = 'system',
): IntegrationEvent<Record<string, unknown>> {
  return infraEvent({
    eventType: 'p7.infrastructure.plan.validated.v1',
    actorId,
    correlationId,
    aggregateType: 'resource_plan',
    aggregateId: planId,
    payload: { planId, valid },
  });
}

export function createInfrastructureResourceProvisionedEvent(
  resourceId: string,
  resourceType: string,
  tenantId: string,
  correlationId: string,
  actorId = 'system',
): IntegrationEvent<Record<string, unknown>> {
  return infraEvent({
    eventType: 'p7.infrastructure.resource.provisioned.v1',
    actorId,
    correlationId,
    aggregateType: 'infrastructure_resource',
    aggregateId: resourceId,
    payload: { resourceId, resourceType, tenantId },
  });
}

export function createDatabaseResourceReadyEvent(
  databaseResourceId: string,
  tenantId: string,
  engine: string,
  correlationId: string,
  actorId = 'system',
): IntegrationEvent<Record<string, unknown>> {
  return infraEvent({
    eventType: 'p7.database.resource.ready.v1',
    actorId,
    correlationId,
    aggregateType: 'database_resource',
    aggregateId: databaseResourceId,
    payload: { databaseResourceId, tenantId, engine },
  });
}

export function createResourceReconciliationRequiredEvent(
  resourceId: string,
  driftClassification: string,
  correlationId: string,
  actorId = 'system',
): IntegrationEvent<Record<string, unknown>> {
  return infraEvent({
    eventType: 'p7.infrastructure.resource.reconciliation_required.v1',
    actorId,
    correlationId,
    aggregateType: 'infrastructure_resource',
    aggregateId: resourceId,
    payload: { resourceId, driftClassification },
  });
}

export function createResourceCompensationSuspendedEvent(
  resourceId: string,
  reason: string,
  correlationId: string,
  actorId = 'system',
): IntegrationEvent<Record<string, unknown>> {
  return infraEvent({
    eventType: 'p7.infrastructure.resource.compensation_suspended.v1',
    actorId,
    correlationId,
    aggregateType: 'infrastructure_resource',
    aggregateId: resourceId,
    payload: { resourceId, reason },
  });
}
