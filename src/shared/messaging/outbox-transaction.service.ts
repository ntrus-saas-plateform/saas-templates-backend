import { Injectable, Inject } from '@nestjs/common';
import { TRANSACTION_MANAGER_PORT } from '../../core/domain/ports/transaction-manager.port.js';
import type { TransactionManagerPort } from '../../core/domain/ports/transaction-manager.port.js';
import { OUTBOX_STORE_PORT } from '../../core/domain/ports/outbox.port.js';
import type { OutboxStorePort } from '../../core/domain/ports/outbox.port.js';
import type { IntegrationEvent } from '../../core/domain/events/integration-event.js';

@Injectable()
export class OutboxTransactionService {
  constructor(
    @Inject(TRANSACTION_MANAGER_PORT) private readonly transactionManager: TransactionManagerPort,
    @Inject(OUTBOX_STORE_PORT) private readonly outboxStore: OutboxStorePort,
  ) {}

  async runWithOutbox<T>(
    tenantId: string,
    fn: (client: unknown, enqueue: (event: IntegrationEvent) => Promise<string>) => Promise<T>,
  ): Promise<T> {
    return this.transactionManager.runInTransaction(tenantId, async (client) => {
      const enqueue = (event: IntegrationEvent) =>
        this.outboxStore.enqueue(tenantId, event, client);
      return fn(client, enqueue);
    });
  }
}
