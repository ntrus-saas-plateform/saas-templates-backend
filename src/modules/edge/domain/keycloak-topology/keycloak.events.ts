import { randomUUID } from 'node:crypto';
import type { IntegrationEvent } from '../../../../core/domain/events/integration-event.js';
import { EDGE_P7_OUTBOX_TENANT } from '../provisioning/provisioning.events.js';

function keycloakEvent<T>(params: {
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

/** P7.7 outbox events (standard integration event shape). */

export function createKeycloakTopologyRequestedEvent(
  topologyId: string,
  tenantId: string,
  productId: string,
  topologyType: string,
  correlationId: string,
  actorId = 'system',
): IntegrationEvent<Record<string, unknown>> {
  return keycloakEvent({
    eventType: 'p7.keycloak.topology.requested.v1',
    actorId,
    correlationId,
    aggregateType: 'keycloak_topology',
    aggregateId: topologyId,
    payload: { topologyId, tenantId, productId, topologyType },
  });
}

export function createKeycloakTopologyProvisionedEvent(
  topologyId: string,
  tenantId: string,
  realmRef: string | null,
  correlationId: string,
  actorId = 'system',
): IntegrationEvent<Record<string, unknown>> {
  return keycloakEvent({
    eventType: 'p7.keycloak.topology.provisioned.v1',
    actorId,
    correlationId,
    aggregateType: 'keycloak_topology',
    aggregateId: topologyId,
    payload: { topologyId, tenantId, realmRef },
  });
}

export function createKeycloakTopologyReadyEvent(
  topologyId: string,
  tenantId: string,
  appliedConfigVersion: number | null,
  correlationId: string,
  actorId = 'system',
): IntegrationEvent<Record<string, unknown>> {
  return keycloakEvent({
    eventType: 'p7.keycloak.topology.ready.v1',
    actorId,
    correlationId,
    aggregateType: 'keycloak_topology',
    aggregateId: topologyId,
    payload: { topologyId, tenantId, appliedConfigVersion },
  });
}

export function createKeycloakDriftDetectedEvent(
  topologyId: string,
  driftClassification: string,
  correlationId: string,
  actorId = 'system',
): IntegrationEvent<Record<string, unknown>> {
  return keycloakEvent({
    eventType: 'p7.keycloak.topology.drift_detected.v1',
    actorId,
    correlationId,
    aggregateType: 'keycloak_topology',
    aggregateId: topologyId,
    payload: { topologyId, driftClassification },
  });
}

export function createKeycloakQuarantineEvent(
  topologyId: string,
  reason: string,
  correlationId: string,
  actorId = 'system',
): IntegrationEvent<Record<string, unknown>> {
  return keycloakEvent({
    eventType: 'p7.keycloak.topology.quarantined.v1',
    actorId,
    correlationId,
    aggregateType: 'keycloak_topology',
    aggregateId: topologyId,
    payload: { topologyId, reason },
  });
}

export function createKeycloakProvisioningFailedEvent(
  topologyId: string,
  errorCode: string,
  correlationId: string,
  actorId = 'system',
): IntegrationEvent<Record<string, unknown>> {
  return keycloakEvent({
    eventType: 'p7.keycloak.topology.provisioning_failed.v1',
    actorId,
    correlationId,
    aggregateType: 'keycloak_topology',
    aggregateId: topologyId,
    payload: { topologyId, errorCode },
  });
}