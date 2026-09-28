import { randomUUID } from 'node:crypto';
import type { IntegrationEvent } from '../../../../core/domain/events/integration-event.js';

export interface OrganizationLifecyclePayload {
  readonly organizationId: string;
  readonly status?: string;
}

export function createOrganizationCreatedEvent(params: {
  tenantId: string;
  organizationId: string;
  actorId: string;
  correlationId: string;
  traceId: string | null;
  name: string;
}): IntegrationEvent<OrganizationLifecyclePayload & { name: string }> {
  return {
    eventId: randomUUID(),
    eventType: 'organization.created.v1',
    version: 1,
    occurredAt: new Date().toISOString(),
    tenantId: params.tenantId,
    organizationId: params.organizationId,
    correlationId: params.correlationId,
    causationId: null,
    traceId: params.traceId,
    actor: { type: 'user', id: params.actorId },
    source: 'platform-core',
    payload: { organizationId: params.organizationId, name: params.name },
  };
}

export function createOrganizationUpdatedEvent(params: {
  tenantId: string;
  organizationId: string;
  actorId: string;
  correlationId: string;
  traceId: string | null;
}): IntegrationEvent<OrganizationLifecyclePayload> {
  return {
    eventId: randomUUID(),
    eventType: 'organization.updated.v1',
    version: 1,
    occurredAt: new Date().toISOString(),
    tenantId: params.tenantId,
    organizationId: params.organizationId,
    correlationId: params.correlationId,
    causationId: null,
    traceId: params.traceId,
    actor: { type: 'user', id: params.actorId },
    source: 'platform-core',
    payload: { organizationId: params.organizationId },
  };
}

export function createOrganizationSuspendedEvent(params: {
  tenantId: string;
  organizationId: string;
  actorId: string;
  correlationId: string;
  traceId: string | null;
}): IntegrationEvent<OrganizationLifecyclePayload> {
  return {
    eventId: randomUUID(),
    eventType: 'organization.suspended.v1',
    version: 1,
    occurredAt: new Date().toISOString(),
    tenantId: params.tenantId,
    organizationId: params.organizationId,
    correlationId: params.correlationId,
    causationId: null,
    traceId: params.traceId,
    actor: { type: 'user', id: params.actorId },
    source: 'platform-core',
    payload: { organizationId: params.organizationId, status: 'SUSPENDED' },
  };
}

export function createOrganizationActivatedEvent(params: {
  tenantId: string;
  organizationId: string;
  actorId: string;
  correlationId: string;
  traceId: string | null;
}): IntegrationEvent<OrganizationLifecyclePayload> {
  return {
    eventId: randomUUID(),
    eventType: 'organization.activated.v1',
    version: 1,
    occurredAt: new Date().toISOString(),
    tenantId: params.tenantId,
    organizationId: params.organizationId,
    correlationId: params.correlationId,
    causationId: null,
    traceId: params.traceId,
    actor: { type: 'user', id: params.actorId },
    source: 'platform-core',
    payload: { organizationId: params.organizationId, status: 'ACTIVE' },
  };
}
