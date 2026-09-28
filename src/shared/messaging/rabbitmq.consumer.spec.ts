import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RabbitMqConsumer } from './rabbitmq.consumer.js';
import { PermanentMessageError } from './rabbitmq.service.js';
import { TenantStatus } from '../../modules/identity/domain/tenant/tenant.entity.js';

describe('RabbitMqConsumer', () => {
  const rabbitMq = { startConsumer: vi.fn(), stopConsumer: vi.fn() };
  const inbox = { tryClaim: vi.fn(), releaseClaim: vi.fn() };
  const tenantRegistry = { findById: vi.fn() };
  const tenantContext = { runAsync: vi.fn() };
  const dispatcher = { dispatch: vi.fn() };
  const logger = { debug: vi.fn(), info: vi.fn() };
  const config = { RABBITMQ_CONSUMER_ENABLED: true };

  let consumer: RabbitMqConsumer;

  const baseEvent = {
    eventId: 'evt-1',
    eventType: 'platform.organization.switched.v1',
    version: 1,
    occurredAt: new Date().toISOString(),
    tenantId: 'tenant-1',
    organizationId: 'org-1',
    correlationId: 'corr-1',
    causationId: null,
    traceId: null,
    actor: { type: 'user' as const, id: 'user-a' },
    source: 'platform-core',
    payload: {},
  };

  const msg = {
    content: Buffer.from(JSON.stringify(baseEvent)),
    properties: { headers: { tenantId: 'tenant-1' } },
  } as unknown as import('amqplib').ConsumeMessage;

  beforeEach(() => {
    vi.clearAllMocks();
    tenantContext.runAsync.mockImplementation(async (_ctx, fn) => fn());
    consumer = new RabbitMqConsumer(
      rabbitMq as never,
      inbox as never,
      tenantRegistry as never,
      tenantContext as never,
      dispatcher as never,
      logger as never,
      config as never,
    );
  });

  it('rejects unknown tenant as permanent error', async () => {
    tenantRegistry.findById.mockResolvedValue(null);
    await expect(consumer['handleMessage'](msg)).rejects.toBeInstanceOf(PermanentMessageError);
  });

  it('dispatches event after inbox claim', async () => {
    tenantRegistry.findById.mockResolvedValue({
      id: 'tenant-1',
      status: TenantStatus.ACTIVE,
    });
    inbox.tryClaim.mockResolvedValue(true);

    await consumer['handleMessage'](msg);

    expect(dispatcher.dispatch).toHaveBeenCalledWith(expect.objectContaining({ eventId: 'evt-1' }));
    expect(inbox.releaseClaim).not.toHaveBeenCalled();
  });

  it('releases inbox claim when dispatch fails so redelivery can retry', async () => {
    tenantRegistry.findById.mockResolvedValue({
      id: 'tenant-1',
      status: TenantStatus.ACTIVE,
    });
    inbox.tryClaim.mockResolvedValue(true);
    dispatcher.dispatch.mockRejectedValue(new Error('transient failure'));

    await expect(consumer['handleMessage'](msg)).rejects.toThrow('transient failure');

    expect(inbox.releaseClaim).toHaveBeenCalledWith('tenant-1', 'evt-1', 'platform-core-default');
  });

  it('rejects header/body tenant mismatch', async () => {
    const mismatched = {
      ...msg,
      properties: { headers: { tenantId: 'tenant-2' } },
    } as unknown as import('amqplib').ConsumeMessage;
    tenantRegistry.findById.mockResolvedValue({
      id: 'tenant-1',
      status: TenantStatus.ACTIVE,
    });

    await expect(consumer['handleMessage'](mismatched)).rejects.toBeInstanceOf(
      PermanentMessageError,
    );
  });
});
