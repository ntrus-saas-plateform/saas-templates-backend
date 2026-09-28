import { randomUUID } from 'node:crypto';
import type { IntegrationEvent } from '../../../../core/domain/events/integration-event.js';

export interface MembershipPayload {
  readonly membershipId: string;
  readonly userId: string;
  readonly organizationId: string;
}

export function createMembershipCreatedEvent(params: {
  tenantId: string;
  organizationId: string;
  membershipId: string;
  userId: string;
  actorId: string;
  correlationId: string;
  traceId: string | null;
}): IntegrationEvent<MembershipPayload> {
  return {
    eventId: randomUUID(),
    eventType: 'membership.created.v1',
    version: 1,
    occurredAt: new Date().toISOString(),
    tenantId: params.tenantId,
    organizationId: params.organizationId,
    correlationId: params.correlationId,
    causationId: null,
    traceId: params.traceId,
    actor: { type: 'user', id: params.actorId },
    source: 'platform-core',
    payload: {
      membershipId: params.membershipId,
      userId: params.userId,
      organizationId: params.organizationId,
    },
  };
}

export function createMembershipRevokedEvent(params: {
  tenantId: string;
  organizationId: string;
  membershipId: string;
  userId: string;
  actorId: string;
  correlationId: string;
  traceId: string | null;
}): IntegrationEvent<MembershipPayload> {
  return {
    eventId: randomUUID(),
    eventType: 'membership.revoked.v1',
    version: 1,
    occurredAt: new Date().toISOString(),
    tenantId: params.tenantId,
    organizationId: params.organizationId,
    correlationId: params.correlationId,
    causationId: null,
    traceId: params.traceId,
    actor: { type: 'user', id: params.actorId },
    source: 'platform-core',
    payload: {
      membershipId: params.membershipId,
      userId: params.userId,
      organizationId: params.organizationId,
    },
  };
}

export function createMembershipRolesUpdatedEvent(params: {
  tenantId: string;
  organizationId: string;
  membershipId: string;
  userId: string;
  actorId: string;
  correlationId: string;
  traceId: string | null;
}): IntegrationEvent<MembershipPayload> {
  return {
    eventId: randomUUID(),
    eventType: 'membership.roles.updated.v1',
    version: 1,
    occurredAt: new Date().toISOString(),
    tenantId: params.tenantId,
    organizationId: params.organizationId,
    correlationId: params.correlationId,
    causationId: null,
    traceId: params.traceId,
    actor: { type: 'user', id: params.actorId },
    source: 'platform-core',
    payload: {
      membershipId: params.membershipId,
      userId: params.userId,
      organizationId: params.organizationId,
    },
  };
}
