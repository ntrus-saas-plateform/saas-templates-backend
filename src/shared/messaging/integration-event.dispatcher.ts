import { Injectable, Inject, Optional } from '@nestjs/common';
import {
  EXTRA_INTEGRATION_EVENT_HANDLERS,
  INTEGRATION_EVENT_HANDLERS,
} from '../../core/domain/ports/integration-event-handler.port.js';
import type { IntegrationEventHandler } from '../../core/domain/ports/integration-event-handler.port.js';
import type { IntegrationEvent } from '../../core/domain/events/integration-event.js';

@Injectable()
export class IntegrationEventDispatcher {
  private readonly allHandlers: readonly IntegrationEventHandler[];

  constructor(
    @Inject(INTEGRATION_EVENT_HANDLERS)
    handlers: readonly IntegrationEventHandler[],
    @Optional()
    @Inject(EXTRA_INTEGRATION_EVENT_HANDLERS)
    extra: readonly IntegrationEventHandler[] | IntegrationEventHandler | null,
  ) {
    const extras = !extra ? [] : Array.isArray(extra) ? [...extra] : [extra];
    this.allHandlers = [...handlers, ...extras];
  }

  async dispatch(event: IntegrationEvent): Promise<void> {
    const matched = this.allHandlers.filter((handler) => handler.supports(event.eventType));
    if (!matched.length) return;

    await Promise.all(matched.map((handler) => handler.handle(event)));
  }
}
