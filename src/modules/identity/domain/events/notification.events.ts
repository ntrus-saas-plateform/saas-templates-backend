import { randomUUID } from 'node:crypto';
import type { IntegrationEvent } from '../../../../core/domain/events/integration-event.js';

export type NotificationPushRequestedPayload = {
  readonly notificationId: string;
  readonly userId: string;
  readonly title: string;
  readonly body: string;
  readonly href?: string | null;
  readonly category?: string;
  readonly sourceEventId?: string;
};

export function createNotificationPushRequestedEvent(params: {
  tenantId: string;
  organizationId?: string | null;
  actorId?: string | null;
  correlationId: string;
  traceId?: string | null;
  payload: NotificationPushRequestedPayload;
}): IntegrationEvent<NotificationPushRequestedPayload> {
  return {
    eventId: randomUUID(),
    eventType: 'notification.push.requested.v1',
    version: 1,
    occurredAt: new Date().toISOString(),
    tenantId: params.tenantId,
    organizationId: params.organizationId ?? null,
    correlationId: params.correlationId,
    causationId: null,
    traceId: params.traceId ?? null,
    actor: {
      type: params.actorId ? 'user' : 'system',
      id: params.actorId ?? 'platform-core',
    },
    source: 'platform-core',
    payload: params.payload,
  };
}
