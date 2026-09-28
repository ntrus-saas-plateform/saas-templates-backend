import { describe, expect, it, vi, beforeEach } from 'vitest';
import { OutboxStatus } from '../../core/domain/ports/outbox.port.js';
import { OutboxPublisher } from './outbox.publisher.js';

describe('OutboxPublisher broker-down (P5)', () => {
  const message = {
    id: 'evt-1',
    eventType: 'business.capability.enabled.v1',
    payload: { eventType: 'business.capability.enabled.v1' },
    status: OutboxStatus.PENDING,
    attempts: 0,
    maxAttempts: 5,
    tenantId: 't1',
    organizationId: 'o1',
    correlationId: 'c1',
    createdAt: new Date(),
    updatedAt: new Date(),
    publishedAt: null,
    lastError: null,
  };

  let outboxStore: {
    fetchPending: ReturnType<typeof vi.fn>;
    markPublished: ReturnType<typeof vi.fn>;
    markFailed: ReturnType<typeof vi.fn>;
    markDeadLetter: ReturnType<typeof vi.fn>;
  };
  let controlPlaneOutboxStore: {
    fetchPending: ReturnType<typeof vi.fn>;
    markPublished: ReturnType<typeof vi.fn>;
    markFailed: ReturnType<typeof vi.fn>;
    markDeadLetter: ReturnType<typeof vi.fn>;
  };
  let rabbitMq: { isConnected: ReturnType<typeof vi.fn>; publish: ReturnType<typeof vi.fn> };
  let cache: { setNx: ReturnType<typeof vi.fn>; releaseLock: ReturnType<typeof vi.fn> };
  let publisher: OutboxPublisher;

  beforeEach(() => {
    outboxStore = {
      fetchPending: vi.fn().mockResolvedValue([message]),
      markPublished: vi.fn(),
      markFailed: vi.fn(),
      markDeadLetter: vi.fn(),
    };
    controlPlaneOutboxStore = {
      fetchPending: vi.fn().mockResolvedValue([]),
      markPublished: vi.fn(),
      markFailed: vi.fn(),
      markDeadLetter: vi.fn(),
    };
    rabbitMq = {
      isConnected: vi.fn().mockReturnValue(true),
      publish: vi.fn().mockRejectedValue(new Error('broker down')),
    };
    cache = {
      setNx: vi.fn().mockResolvedValue(true),
      releaseLock: vi.fn(),
    };
    const dbManager = {
      getControlPlanePool: () => ({
        query: vi.fn().mockResolvedValue({ rows: [{ id: 't1' }] }),
      }),
    };
    publisher = new OutboxPublisher(
      outboxStore as never,
      controlPlaneOutboxStore as never,
      rabbitMq as never,
      dbManager as never,
      cache as never,
      { warn: vi.fn() } as never,
      { OUTBOX_POLL_INTERVAL_MS: 60_000 } as never,
    );
  });

  it('keeps event recoverable via markFailed when RabbitMQ publish fails', async () => {
    await publisher.publishPending();
    expect(rabbitMq.publish).toHaveBeenCalled();
    expect(outboxStore.markPublished).not.toHaveBeenCalled();
    expect(outboxStore.markFailed).toHaveBeenCalledWith('t1', 'evt-1', 'broker down');
    expect(outboxStore.markDeadLetter).not.toHaveBeenCalled();
  });

  it('dead-letters after max attempts exhausted', async () => {
    outboxStore.fetchPending.mockResolvedValue([{ ...message, attempts: 4, maxAttempts: 5 }]);
    await publisher.publishPending();
    expect(outboxStore.markDeadLetter).toHaveBeenCalledWith('t1', 'evt-1', 'broker down');
  });

  it('skips publish cycle when broker is disconnected (events remain PENDING in DB)', async () => {
    rabbitMq.isConnected.mockReturnValue(false);
    await publisher.publishPending();
    expect(outboxStore.fetchPending).not.toHaveBeenCalled();
    expect(cache.setNx).not.toHaveBeenCalled();
  });
});
