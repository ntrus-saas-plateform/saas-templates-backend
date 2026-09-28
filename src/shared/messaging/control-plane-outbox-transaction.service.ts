import { Injectable, Inject } from '@nestjs/common';
import { CONTROL_PLANE_TRANSACTION_MANAGER_PORT } from '../../core/domain/ports/control-plane-transaction-manager.port.js';
import type { ControlPlaneTransactionManagerPort } from '../../core/domain/ports/control-plane-transaction-manager.port.js';
import { CONTROL_PLANE_OUTBOX_STORE_PORT } from '../../core/domain/ports/control-plane-outbox.port.js';
import type { ControlPlaneOutboxStorePort } from '../../core/domain/ports/control-plane-outbox.port.js';
import type { IntegrationEvent } from '../../core/domain/events/integration-event.js';

@Injectable()
export class ControlPlaneOutboxTransactionService {
  constructor(
    @Inject(CONTROL_PLANE_TRANSACTION_MANAGER_PORT)
    private readonly transactionManager: ControlPlaneTransactionManagerPort,
    @Inject(CONTROL_PLANE_OUTBOX_STORE_PORT)
    private readonly outboxStore: ControlPlaneOutboxStorePort,
  ) {}

  async runWithOutbox<T>(
    tenantId: string,
    fn: (client: unknown, enqueue: (event: IntegrationEvent) => Promise<string>) => Promise<T>,
  ): Promise<T> {
    return this.transactionManager.runInTransaction(async (client) => {
      const enqueue = (event: IntegrationEvent) =>
        this.outboxStore.enqueue(tenantId, event, client);
      return fn(client, enqueue);
    });
  }
}
