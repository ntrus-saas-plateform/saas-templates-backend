import { Injectable } from '@nestjs/common';
import type { EventPublisherPort } from '../../modules/identity/domain/ports/event-publisher.port.js';
import type { IntegrationEvent } from '../../core/domain/events/integration-event.js';
import { OutboxTransactionService } from './outbox-transaction.service.js';

@Injectable()
export class OutboxEventPublisher implements EventPublisherPort {
  constructor(private readonly outboxTransaction: OutboxTransactionService) {}

  async publish(tenantId: string, event: IntegrationEvent): Promise<void> {
    await this.outboxTransaction.runWithOutbox(tenantId, async (_client, enqueue) => {
      await enqueue(event);
    });
  }
}
