import { Injectable, Inject, Optional } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import {
  EXTRA_INTEGRATION_EVENT_HANDLERS,
  INTEGRATION_EVENT_HANDLERS,
} from '../../core/domain/ports/integration-event-handler.port.js';
import type { IntegrationEventHandler } from '../../core/domain/ports/integration-event-handler.port.js';
import type { IntegrationEvent } from '../../core/domain/events/integration-event.js';

@Injectable()
export class IntegrationEventDispatcher {
  constructor(
    @Inject(INTEGRATION_EVENT_HANDLERS)
    private readonly handlers: readonly IntegrationEventHandler[],
    private readonly moduleRef: ModuleRef,
    @Optional()
    @Inject(EXTRA_INTEGRATION_EVENT_HANDLERS)
    private readonly extra:
      | readonly IntegrationEventHandler[]
      | IntegrationEventHandler
      | null = null,
  ) {}

  private resolveHandlers(): readonly IntegrationEventHandler[] {
    let extras: IntegrationEventHandler[] = [];
    if (this.extra) {
      extras = Array.isArray(this.extra) ? [...this.extra] : [this.extra];
    } else {
      try {
        const fromRef = this.moduleRef.get<
          readonly IntegrationEventHandler[] | IntegrationEventHandler
        >(EXTRA_INTEGRATION_EVENT_HANDLERS, { strict: false });
        if (fromRef) {
          extras = Array.isArray(fromRef) ? [...fromRef] : [fromRef];
        }
      } catch {
        extras = [];
      }
    }
    return [...this.handlers, ...extras];
  }

  async dispatch(event: IntegrationEvent): Promise<void> {
    const matched = this.resolveHandlers().filter((handler) =>
      handler.supports(event.eventType),
    );
    if (!matched.length) return;

    await Promise.all(matched.map((handler) => handler.handle(event)));
  }
}
