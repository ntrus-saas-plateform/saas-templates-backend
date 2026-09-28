import { randomUUID } from 'node:crypto';
import type { IntegrationEvent } from '../../../../core/domain/events/integration-event.js';

export function createUserInvitedEvent(params: {
  tenantId: string;
  organizationId: string;
  invitationId: string;
  email: string;
  actorId: string;
  correlationId: string;
  traceId: string | null;
}): IntegrationEvent<{ invitationId: string; email: string }> {
  return {
    eventId: randomUUID(),
    eventType: 'user.invited.v1',
    version: 1,
    occurredAt: new Date().toISOString(),
    tenantId: params.tenantId,
    organizationId: params.organizationId,
    correlationId: params.correlationId,
    causationId: null,
    traceId: params.traceId,
    actor: { type: 'user', id: params.actorId },
    source: 'platform-core',
    payload: { invitationId: params.invitationId, email: params.email },
  };
}

export function createUserActivatedEvent(params: {
  tenantId: string;
  identityId: string;
  actorId: string;
  correlationId: string;
  traceId: string | null;
}): IntegrationEvent<{ identityId: string }> {
  return {
    eventId: randomUUID(),
    eventType: 'user.activated.v1',
    version: 1,
    occurredAt: new Date().toISOString(),
    tenantId: params.tenantId,
    organizationId: null,
    correlationId: params.correlationId,
    causationId: null,
    traceId: params.traceId,
    actor: { type: 'user', id: params.actorId },
    source: 'platform-core',
    payload: { identityId: params.identityId },
  };
}

export function createUserSuspendedEvent(params: {
  tenantId: string;
  identityId: string;
  actorId: string;
  correlationId: string;
  traceId: string | null;
}): IntegrationEvent<{ identityId: string }> {
  return {
    eventId: randomUUID(),
    eventType: 'user.suspended.v1',
    version: 1,
    occurredAt: new Date().toISOString(),
    tenantId: params.tenantId,
    organizationId: null,
    correlationId: params.correlationId,
    causationId: null,
    traceId: params.traceId,
    actor: { type: 'user', id: params.actorId },
    source: 'platform-core',
    payload: { identityId: params.identityId },
  };
}

export function createUserDisabledEvent(params: {
  tenantId: string;
  identityId: string;
  actorId: string;
  correlationId: string;
  traceId: string | null;
}): IntegrationEvent<{ identityId: string }> {
  return {
    eventId: randomUUID(),
    eventType: 'user.disabled.v1',
    version: 1,
    occurredAt: new Date().toISOString(),
    tenantId: params.tenantId,
    organizationId: null,
    correlationId: params.correlationId,
    causationId: null,
    traceId: params.traceId,
    actor: { type: 'user', id: params.actorId },
    source: 'platform-core',
    payload: { identityId: params.identityId },
  };
}

export function createUserReactivatedEvent(params: {
  tenantId: string;
  identityId: string;
  actorId: string;
  correlationId: string;
  traceId: string | null;
}): IntegrationEvent<{ identityId: string }> {
  return {
    eventId: randomUUID(),
    eventType: 'user.reactivated.v1',
    version: 1,
    occurredAt: new Date().toISOString(),
    tenantId: params.tenantId,
    organizationId: null,
    correlationId: params.correlationId,
    causationId: null,
    traceId: params.traceId,
    actor: { type: 'user', id: params.actorId },
    source: 'platform-core',
    payload: { identityId: params.identityId },
  };
}
