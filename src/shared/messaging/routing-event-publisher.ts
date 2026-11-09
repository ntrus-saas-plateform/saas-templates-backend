import { Injectable } from '@nestjs/common';
import type { EventPublisherPort } from '../../modules/identity/domain/ports/event-publisher.port.js';
import type { IntegrationEvent } from '../../core/domain/events/integration-event.js';
import { OutboxTransactionService } from './outbox-transaction.service.js';
import { ControlPlaneOutboxTransactionService } from './control-plane-outbox-transaction.service.js';

function isControlPlaneOutboxEvent(eventType: string): boolean {
  return (
    eventType.startsWith('customer.') ||
    eventType.startsWith('membership.') ||
    eventType.startsWith('organization.') ||
    eventType.startsWith('user.') ||
    eventType.startsWith('commercial.') ||
    eventType.startsWith('marketing.') ||
    eventType.startsWith('sales.')
  );
}

@Injectable()
export class RoutingEventPublisher implements EventPublisherPort {
  constructor(
    private readonly tenantOutboxTransaction: OutboxTransactionService,
    private readonly controlPlaneOutboxTransaction: ControlPlaneOutboxTransactionService,
  ) {}

  async publish(tenantId: string, event: IntegrationEvent): Promise<void> {
    if (isControlPlaneOutboxEvent(event.eventType)) {
      await this.controlPlaneOutboxTransaction.runWithOutbox(tenantId, async (_client, enqueue) => {
        await enqueue(event);
      });
      return;
    }

    await this.tenantOutboxTransaction.runWithOutbox(tenantId, async (_client, enqueue) => {
      await enqueue(event);
    });
  }
}
