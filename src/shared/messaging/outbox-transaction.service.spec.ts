import { describe, it, expect, vi } from 'vitest';
import { OutboxTransactionService } from './outbox-transaction.service.js';
import type { IntegrationEvent } from '../../core/domain/events/integration-event.js';

describe('OutboxTransactionService', () => {
  it('enqueues events inside tenant transaction', async () => {
    const client = { query: vi.fn() };
    const transactionManager = {
      runInTransaction: vi.fn(async (_tenantId, fn) => fn(client)),
    };
    const outboxStore = { enqueue: vi.fn().mockResolvedValue('outbox-id') };

    const service = new OutboxTransactionService(
      transactionManager as never,
      outboxStore as never,
    );

    const event: IntegrationEvent = {
      eventId: 'e1',
      eventType: 'platform.test',
      version: 1,
      occurredAt: new Date().toISOString(),
      tenantId: 'tenant-1',
      organizationId: null,
      correlationId: 'c1',
      causationId: null,
      traceId: null,
      actor: { type: 'system', id: 'platform' },
      source: 'platform-core',
      payload: { test: true },
    };

    await service.runWithOutbox('tenant-1', async (_c, enqueue) => {
      await enqueue(event);
    });

    expect(outboxStore.enqueue).toHaveBeenCalledWith('tenant-1', event, client);
  });
});
