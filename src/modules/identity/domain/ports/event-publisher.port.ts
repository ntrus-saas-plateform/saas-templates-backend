import type { IntegrationEvent } from '../../../../core/domain/events/integration-event.js';

export interface EventPublisherPort {
  publish(tenantId: string, event: IntegrationEvent): Promise<void>;
}

export const EVENT_PUBLISHER_PORT = Symbol('EVENT_PUBLISHER_PORT');
