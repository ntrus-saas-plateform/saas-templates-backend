import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CustomerTimelineHandler } from './customer-timeline.handler.js';
import type { IntegrationEvent } from '../../../core/domain/events/integration-event.js';

function orderEvent(
  eventType: string,
  overrides: Partial<IntegrationEvent> = {},
): IntegrationEvent {
  return {
    eventId: 'evt-timeline-order',
    eventType,
    version: 1,
    occurredAt: new Date().toISOString(),
    tenantId: 'tenant-1',
    organizationId: null,
    correlationId: 'corr-1',
    causationId: null,
    traceId: null,
    actor: { type: 'user', id: 'actor-1' },
    source: 'platform-core',
    payload: {
      orderId: 'ord-1',
      tenantCustomerId: 'tc-1',
      orderNumber: 'ORD-1',
      totalAmount: 50,
      currency: 'USD',
      channel: 'pos',
      loyaltyPointsEarned: 5,
    },
    ...overrides,
  };
}

describe('CustomerTimelineHandler', () => {
  const query = vi.fn();
  const tenantPool = { query };
  const cpPool = { query: vi.fn() };
  const dbManager = {
    getPool: vi.fn(async () => tenantPool),
    getControlPlanePool: () => cpPool,
  };
  const logger = { info: vi.fn(), debug: vi.fn() };

  let handler: CustomerTimelineHandler;

  const baseEvent: IntegrationEvent = {
    eventId: 'evt-timeline-1',
    eventType: 'customer.registered.v1',
    version: 1,
    occurredAt: new Date().toISOString(),
    tenantId: 'tenant-1',
    organizationId: null,
    correlationId: 'corr-1',
    causationId: null,
    traceId: null,
    actor: { type: 'user', id: 'actor-1' },
    source: 'platform-core',
    payload: { tenantCustomerId: 'tc-1' },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    handler = new CustomerTimelineHandler(dbManager as never, logger as never);
    query.mockResolvedValue({ rowCount: 1, rows: [{ id: 'tl-1' }] });
    cpPool.query.mockResolvedValue({ rowCount: 1, rows: [] });
  });

  it('supports customer, sales, loyalty, crm and legacy commerce event prefixes', () => {
    expect(handler.supports('customer.registered.v1')).toBe(true);
    expect(handler.supports('commerce.order.completed.v1')).toBe(true);
    expect(handler.supports('sales.order.completed.v1')).toBe(true);
    expect(handler.supports('loyalty.points.earned.v1')).toBe(true);
    expect(handler.supports('crm.lead.created.v1')).toBe(true);
    expect(handler.supports('identity.user.created.v1')).toBe(false);
  });

  it('records customer timeline events', async () => {
    await handler.handle(baseEvent);
    expect(query).toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalled();
  });

  it('applies order completed side effects for legacy commerce events', async () => {
    query
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'tl-1' }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'la-1' }] })
      .mockResolvedValue({ rowCount: 1, rows: [] });

    await handler.handle(orderEvent('commerce.order.completed.v1'));
    expect(cpPool.query).toHaveBeenCalled();
  });

  it('records sales.order.completed timeline and updates CP stats without loyalty writes', async () => {
    const salesEvent: IntegrationEvent = {
      ...baseEvent,
      eventId: 'evt-sales-1',
      eventType: 'sales.order.completed.v1',
      payload: {
        orderId: 'ord-1',
        customerId: 'tc-1',
        grandTotal: 120,
        orderNumber: 'SO-1',
      },
    };
    await handler.handle(salesEvent);
    expect(query).toHaveBeenCalled();
    expect(cpPool.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE tenant_customers'),
      expect.arrayContaining(['tenant-1', 'tc-1', 120]),
    );
  });

  it('reverses order side effects on cancel/refund', async () => {
    query
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'tl-1' }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'la-1' }] })
      .mockResolvedValue({ rowCount: 1, rows: [] });

    await handler.handle(orderEvent('commerce.order.cancelled.v1'));
    expect(cpPool.query).toHaveBeenCalled();
  });
});
