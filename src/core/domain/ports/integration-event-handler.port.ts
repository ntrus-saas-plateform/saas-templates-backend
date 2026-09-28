import type { IntegrationEvent } from '../events/integration-event.js';

export interface IntegrationEventHandler {
  supports(eventType: string): boolean;
  handle(event: IntegrationEvent): Promise<void>;
}

export const INTEGRATION_EVENT_HANDLERS = Symbol('INTEGRATION_EVENT_HANDLERS');

/** Optional extra handlers registered by feature modules (e.g. orchestration). */
export const EXTRA_INTEGRATION_EVENT_HANDLERS = Symbol('EXTRA_INTEGRATION_EVENT_HANDLERS');
