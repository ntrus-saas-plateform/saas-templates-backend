import { randomUUID } from 'node:crypto';
import type { IntegrationEvent } from './integration-event.js';

export interface OrganizationSwitchedPayload {
  readonly userId: string;
  readonly previousOrganizationId: string | null;
  readonly organizationId: string;
}

export function createOrganizationSwitchedEvent(params: {
  tenantId: string;
  organizationId: string;
  previousOrganizationId: string | null;
  userId: string;
  correlationId: string;
  traceId: string | null;
}): IntegrationEvent<OrganizationSwitchedPayload> {
  return {
    eventId: randomUUID(),
    eventType: 'platform.organization.switched.v1',
    version: 1,
    occurredAt: new Date().toISOString(),
    tenantId: params.tenantId,
    organizationId: params.organizationId,
    correlationId: params.correlationId,
    causationId: null,
    traceId: params.traceId,
    actor: { type: 'user', id: params.userId },
    source: 'platform-core',
    payload: {
      userId: params.userId,
      previousOrganizationId: params.previousOrganizationId,
      organizationId: params.organizationId,
    },
  };
}
