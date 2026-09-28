import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RoutingEventPublisher } from './routing-event-publisher.js';

describe('RoutingEventPublisher', () => {
  const tenantOutboxTransaction = {
    runWithOutbox: vi.fn(async (_tenantId, fn) => fn(null, vi.fn())),
  };
  const controlPlaneOutboxTransaction = {
    runWithOutbox: vi.fn(async (_tenantId, fn) => fn(null, vi.fn())),
  };

  let publisher: RoutingEventPublisher;

  beforeEach(() => {
    vi.clearAllMocks();
    publisher = new RoutingEventPublisher(
      tenantOutboxTransaction as never,
      controlPlaneOutboxTransaction as never,
    );
  });

  const baseEvent = {
    eventId: 'e1',
    eventType: 'customer.registered.v1',
    version: 1,
    occurredAt: new Date().toISOString(),
    tenantId: 't1',
    organizationId: null,
    correlationId: 'c1',
    causationId: null,
    traceId: null,
    actor: { type: 'system' as const, id: 'platform-core' },
    source: 'platform-core',
    payload: {},
  };

  it('routes customer events to control-plane outbox', async () => {
    await publisher.publish('t1', baseEvent);
    expect(controlPlaneOutboxTransaction.runWithOutbox).toHaveBeenCalled();
    expect(tenantOutboxTransaction.runWithOutbox).not.toHaveBeenCalled();
  });

  it('routes membership events to control-plane outbox', async () => {
    await publisher.publish('t1', { ...baseEvent, eventType: 'membership.created.v1' });
    expect(controlPlaneOutboxTransaction.runWithOutbox).toHaveBeenCalled();
    expect(tenantOutboxTransaction.runWithOutbox).not.toHaveBeenCalled();
  });

  it('routes organization events to control-plane outbox', async () => {
    await publisher.publish('t1', { ...baseEvent, eventType: 'organization.created.v1' });
    expect(controlPlaneOutboxTransaction.runWithOutbox).toHaveBeenCalled();
    expect(tenantOutboxTransaction.runWithOutbox).not.toHaveBeenCalled();
  });

  it('routes settings events to tenant outbox', async () => {
    await publisher.publish('t1', { ...baseEvent, eventType: 'settings.updated.v1' });
    expect(tenantOutboxTransaction.runWithOutbox).toHaveBeenCalled();
    expect(controlPlaneOutboxTransaction.runWithOutbox).not.toHaveBeenCalled();
  });

  it('routes non-control-plane events to tenant outbox', async () => {
    await publisher.publish('t1', { ...baseEvent, eventType: 'commerce.order.completed.v1' });
    expect(tenantOutboxTransaction.runWithOutbox).toHaveBeenCalled();
    expect(controlPlaneOutboxTransaction.runWithOutbox).not.toHaveBeenCalled();
  });
});
