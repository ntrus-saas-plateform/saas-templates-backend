import { randomUUID } from 'node:crypto';
import type { IntegrationEvent } from '../../../../core/domain/events/integration-event.js';
import { EDGE_P7_OUTBOX_TENANT } from '../provisioning/provisioning.events.js';

function placementEvent<T>(params: {
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

export function createPlacementRequestCreatedEvent(p: {
  actorId: string;
  correlationId: string;
  placementRequestId: string;
  provisioningRequestId: string;
}) {
  return placementEvent({
    eventType: 'p7.placement.request.created.v1',
    actorId: p.actorId,
    correlationId: p.correlationId,
    aggregateType: 'PLACEMENT_REQUEST',
    aggregateId: p.placementRequestId,
    payload: {
      placementRequestId: p.placementRequestId,
      provisioningRequestId: p.provisioningRequestId,
    },
  });
}

export function createPlacementDecisionEvaluatedEvent(p: {
  actorId: string;
  correlationId: string;
  decisionId: string;
  placementRequestId: string;
  decisionStatus: string;
}) {
  return placementEvent({
    eventType: 'p7.placement.decision.evaluated.v1',
    actorId: p.actorId,
    correlationId: p.correlationId,
    aggregateType: 'PLACEMENT_DECISION',
    aggregateId: p.decisionId,
    payload: {
      decisionId: p.decisionId,
      placementRequestId: p.placementRequestId,
      decisionStatus: p.decisionStatus,
    },
  });
}

export function createPlacementDecisionConfirmedEvent(p: {
  actorId: string;
  correlationId: string;
  decisionId: string;
  placementRequestId: string;
  reservationId: string | null;
}) {
  return placementEvent({
    eventType: 'p7.placement.decision.confirmed.v1',
    actorId: p.actorId,
    correlationId: p.correlationId,
    aggregateType: 'PLACEMENT_DECISION',
    aggregateId: p.decisionId,
    payload: {
      decisionId: p.decisionId,
      placementRequestId: p.placementRequestId,
      reservationId: p.reservationId,
    },
  });
}

export function createPlacementRequestCancelledEvent(p: {
  actorId: string;
  correlationId: string;
  placementRequestId: string;
  reason: string | null;
}) {
  return placementEvent({
    eventType: 'p7.placement.request.cancelled.v1',
    actorId: p.actorId,
    correlationId: p.correlationId,
    aggregateType: 'PLACEMENT_REQUEST',
    aggregateId: p.placementRequestId,
    payload: {
      placementRequestId: p.placementRequestId,
      reason: p.reason,
    },
  });
}

export function createCapacityReservationHeldEvent(p: {
  actorId: string;
  correlationId: string;
  reservationId: string;
  environmentId: string;
  placementRequestId: string;
}) {
  return placementEvent({
    eventType: 'p7.capacity.reservation.held.v1',
    actorId: p.actorId,
    correlationId: p.correlationId,
    aggregateType: 'CAPACITY_RESERVATION',
    aggregateId: p.reservationId,
    payload: {
      reservationId: p.reservationId,
      environmentId: p.environmentId,
      placementRequestId: p.placementRequestId,
    },
  });
}

export function createCapacityReservationReleasedEvent(p: {
  actorId: string;
  correlationId: string;
  reservationId: string;
  reason: string;
}) {
  return placementEvent({
    eventType: 'p7.capacity.reservation.released.v1',
    actorId: p.actorId,
    correlationId: p.correlationId,
    aggregateType: 'CAPACITY_RESERVATION',
    aggregateId: p.reservationId,
    payload: {
      reservationId: p.reservationId,
      reason: p.reason,
    },
  });
}

export function createCapacityReservationExpiredEvent(p: {
  actorId: string;
  correlationId: string;
  reservationId: string;
}) {
  return placementEvent({
    eventType: 'p7.capacity.reservation.expired.v1',
    actorId: p.actorId,
    correlationId: p.correlationId,
    aggregateType: 'CAPACITY_RESERVATION',
    aggregateId: p.reservationId,
    payload: { reservationId: p.reservationId },
  });
}

export function createCapacityReservationCommittedEvent(p: {
  actorId: string;
  correlationId: string;
  reservationId: string;
}) {
  return placementEvent({
    eventType: 'p7.capacity.reservation.committed.v1',
    actorId: p.actorId,
    correlationId: p.correlationId,
    aggregateType: 'CAPACITY_RESERVATION',
    aggregateId: p.reservationId,
    payload: { reservationId: p.reservationId },
  });
}

export function createCapacityInventoryUpdatedEvent(p: {
  actorId: string;
  correlationId: string;
  inventoryId: string;
  environmentId: string;
  resourceType: string;
}) {
  return placementEvent({
    eventType: 'p7.capacity.inventory.updated.v1',
    actorId: p.actorId,
    correlationId: p.correlationId,
    aggregateType: 'CAPACITY_INVENTORY',
    aggregateId: p.inventoryId,
    payload: {
      inventoryId: p.inventoryId,
      environmentId: p.environmentId,
      resourceType: p.resourceType,
    },
  });
}

export function createPlacementPolicyUpdatedEvent(p: {
  actorId: string;
  correlationId: string;
  policyId: string;
  code: string;
}) {
  return placementEvent({
    eventType: 'p7.placement.policy.updated.v1',
    actorId: p.actorId,
    correlationId: p.correlationId,
    aggregateType: 'PLACEMENT_POLICY',
    aggregateId: p.policyId,
    payload: { policyId: p.policyId, code: p.code },
  });
}

export function createPlacementDecisionSupersededEvent(p: {
  actorId: string;
  correlationId: string;
  decisionId: string;
  placementRequestId: string;
}) {
  return placementEvent({
    eventType: 'p7.placement.decision.superseded.v1',
    actorId: p.actorId,
    correlationId: p.correlationId,
    aggregateType: 'PLACEMENT_DECISION',
    aggregateId: p.decisionId,
    payload: {
      decisionId: p.decisionId,
      placementRequestId: p.placementRequestId,
    },
  });
}
