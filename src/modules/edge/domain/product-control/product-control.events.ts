import { randomUUID } from 'node:crypto';
import type { IntegrationEvent } from '../../../../core/domain/events/integration-event.js';
import { EDGE_P7_OUTBOX_TENANT } from '../provisioning/provisioning.events.js';

function pciEvent<T>(params: {
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

export function createEndpointRegisteredEvent(p: {
  actorId: string;
  correlationId: string;
  endpointId: string;
  productId: string;
  code: string;
}) {
  return pciEvent({
    eventType: 'p7.product_control.endpoint.registered.v1',
    actorId: p.actorId,
    correlationId: p.correlationId,
    aggregateType: 'PRODUCT_CONTROL_ENDPOINT',
    aggregateId: p.endpointId,
    payload: {
      endpointId: p.endpointId,
      productId: p.productId,
      code: p.code,
    },
  });
}

export function createEndpointStatusChangedEvent(p: {
  actorId: string;
  correlationId: string;
  endpointId: string;
  fromStatus: string;
  toStatus: string;
}) {
  return pciEvent({
    eventType: 'p7.product_control.endpoint.status_changed.v1',
    actorId: p.actorId,
    correlationId: p.correlationId,
    aggregateType: 'PRODUCT_CONTROL_ENDPOINT',
    aggregateId: p.endpointId,
    payload: {
      endpointId: p.endpointId,
      fromStatus: p.fromStatus,
      toStatus: p.toStatus,
    },
  });
}

export function createHandshakeCompletedEvent(p: {
  actorId: string;
  correlationId: string;
  endpointId: string;
  exchangeId: string;
  success: boolean;
}) {
  return pciEvent({
    eventType: 'p7.product_control.handshake.completed.v1',
    actorId: p.actorId,
    correlationId: p.correlationId,
    aggregateType: 'PRODUCT_CONTROL_EXCHANGE',
    aggregateId: p.exchangeId,
    payload: {
      endpointId: p.endpointId,
      exchangeId: p.exchangeId,
      success: p.success,
    },
  });
}

export function createCapabilitiesDiscoveredEvent(p: {
  actorId: string;
  correlationId: string;
  endpointId: string;
  capabilityCodes: string[];
}) {
  return pciEvent({
    eventType: 'p7.product_control.capabilities.discovered.v1',
    actorId: p.actorId,
    correlationId: p.correlationId,
    aggregateType: 'PRODUCT_CONTROL_ENDPOINT',
    aggregateId: p.endpointId,
    payload: {
      endpointId: p.endpointId,
      capabilityCodes: p.capabilityCodes,
    },
  });
}

export function createExchangeUnknownOutcomeEvent(p: {
  actorId: string;
  correlationId: string;
  exchangeId: string;
  endpointId: string;
}) {
  return pciEvent({
    eventType: 'p7.product_control.exchange.unknown_outcome.v1',
    actorId: p.actorId,
    correlationId: p.correlationId,
    aggregateType: 'PRODUCT_CONTROL_EXCHANGE',
    aggregateId: p.exchangeId,
    payload: {
      exchangeId: p.exchangeId,
      endpointId: p.endpointId,
    },
  });
}

export function createEndpointQuarantinedEvent(p: {
  actorId: string;
  correlationId: string;
  endpointId: string;
  reason: string;
}) {
  return pciEvent({
    eventType: 'p7.product_control.endpoint.quarantined.v1',
    actorId: p.actorId,
    correlationId: p.correlationId,
    aggregateType: 'PRODUCT_CONTROL_ENDPOINT',
    aggregateId: p.endpointId,
    payload: {
      endpointId: p.endpointId,
      reason: p.reason,
    },
  });
}
