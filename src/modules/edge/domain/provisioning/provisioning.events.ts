import { randomUUID } from 'node:crypto';
import type { IntegrationEvent } from '../../../../core/domain/events/integration-event.js';

export const EDGE_P7_OUTBOX_TENANT = 'edge-control-plane';

function p7Event<T>(params: {
  eventType: string;
  actorId: string;
  correlationId: string;
  aggregateType: string;
  aggregateId: string;
  payload: T;
  causationId?: string | null;
}): IntegrationEvent<T> {
  return {
    eventId: randomUUID(),
    eventType: params.eventType,
    version: 1,
    occurredAt: new Date().toISOString(),
    tenantId: EDGE_P7_OUTBOX_TENANT,
    organizationId: null,
    correlationId: params.correlationId,
    causationId: params.causationId ?? null,
    traceId: null,
    actor: { type: 'service', id: params.actorId },
    source: 'okapi.edge.p7',
    aggregateType: params.aggregateType,
    aggregateId: params.aggregateId,
    payload: params.payload,
  };
}

export function createAuthorizationVerifiedEvent(params: {
  actorId: string;
  correlationId: string;
  authorizationId: string;
  authorizationVersion: number;
  requestId?: string;
}) {
  return p7Event({
    eventType: 'tenant.provisioning.authorization.verified.v1',
    actorId: params.actorId,
    correlationId: params.correlationId,
    aggregateType: 'PROVISIONING_AUTHORIZATION',
    aggregateId: params.authorizationId,
    payload: {
      authorizationId: params.authorizationId,
      authorizationVersion: params.authorizationVersion,
      requestId: params.requestId ?? null,
    },
  });
}

export function createAuthorizationRejectedEvent(params: {
  actorId: string;
  correlationId: string;
  authorizationId: string;
  reasonCode: string;
}) {
  return p7Event({
    eventType: 'tenant.provisioning.authorization.rejected.v1',
    actorId: params.actorId,
    correlationId: params.correlationId,
    aggregateType: 'PROVISIONING_AUTHORIZATION',
    aggregateId: params.authorizationId,
    payload: {
      authorizationId: params.authorizationId,
      reasonCode: params.reasonCode,
    },
  });
}

export function createAuthorizationRevokedEvent(params: {
  actorId: string;
  correlationId: string;
  authorizationId: string;
  revocationVersion: number;
}) {
  return p7Event({
    eventType: 'tenant.provisioning.authorization.revoked.v1',
    actorId: params.actorId,
    correlationId: params.correlationId,
    aggregateType: 'PROVISIONING_AUTHORIZATION',
    aggregateId: params.authorizationId,
    payload: {
      authorizationId: params.authorizationId,
      revocationVersion: params.revocationVersion,
    },
  });
}

export function createProvisioningRequestReceivedEvent(params: {
  actorId: string;
  correlationId: string;
  requestId: string;
  authorizationId: string;
}) {
  return p7Event({
    eventType: 'tenant.provisioning.request.received.v1',
    actorId: params.actorId,
    correlationId: params.correlationId,
    aggregateType: 'PROVISIONING_REQUEST',
    aggregateId: params.requestId,
    payload: {
      requestId: params.requestId,
      authorizationId: params.authorizationId,
    },
  });
}

export function createProvisioningRequestAcceptedEvent(params: {
  actorId: string;
  correlationId: string;
  requestId: string;
}) {
  return p7Event({
    eventType: 'tenant.provisioning.request.accepted.v1',
    actorId: params.actorId,
    correlationId: params.correlationId,
    aggregateType: 'PROVISIONING_REQUEST',
    aggregateId: params.requestId,
    payload: { requestId: params.requestId },
  });
}

export function createProvisioningRequestRejectedEvent(params: {
  actorId: string;
  correlationId: string;
  requestId: string;
  reasonCode: string;
}) {
  return p7Event({
    eventType: 'tenant.provisioning.request.rejected.v1',
    actorId: params.actorId,
    correlationId: params.correlationId,
    aggregateType: 'PROVISIONING_REQUEST',
    aggregateId: params.requestId,
    payload: { requestId: params.requestId, reasonCode: params.reasonCode },
  });
}

export function createProvisioningRequestCancelledEvent(params: {
  actorId: string;
  correlationId: string;
  requestId: string;
  reason: string;
}) {
  return p7Event({
    eventType: 'tenant.provisioning.request.cancelled.v1',
    actorId: params.actorId,
    correlationId: params.correlationId,
    aggregateType: 'PROVISIONING_REQUEST',
    aggregateId: params.requestId,
    payload: { requestId: params.requestId, reason: params.reason },
  });
}

export const LEGACY_PROVISIONING_REQUESTED_EVENT =
  'subscription.provisioning.requested.v1' as const;

export const CANONICAL_AUTHORIZATION_ISSUED_EVENT =
  'subscription.provisioning.authorization.issued.v1' as const;

export const CANONICAL_AUTHORIZATION_REVOKED_EVENT =
  'subscription.provisioning.authorization.revoked.v1' as const;
