import { describe, expect, it, vi } from 'vitest';
import { MarketingLeadQualifiedSalesHandler } from './marketing-lead-qualified.handler.js';

describe('MarketingLeadQualifiedSalesHandler', () => {
  it('supports only marketing.lead.qualified.v1', () => {
    const receive = { execute: vi.fn() };
    const handler = new MarketingLeadQualifiedSalesHandler(receive as never);
    expect(handler.supports('marketing.lead.qualified.v1')).toBe(true);
    expect(handler.supports('sales.lead.received.v1')).toBe(false);
  });

  it('receives sales lead idempotently from payload.leadId', async () => {
    const receive = { execute: vi.fn().mockResolvedValue({ created: true }) };
    const handler = new MarketingLeadQualifiedSalesHandler(receive as never);
    await handler.handle({
      eventId: 'e1',
      eventType: 'marketing.lead.qualified.v1',
      version: 1,
      occurredAt: new Date().toISOString(),
      tenantId: 'edge-control-plane',
      organizationId: null,
      correlationId: 'c1',
      causationId: null,
      traceId: null,
      actor: { type: 'user', id: 'admin-1' },
      source: 'okapi-edge',
      aggregateType: 'MARKETING_LEAD',
      aggregateId: 'lead-1',
      payload: { leadId: 'lead-1', score: 85, modelVersion: 1 },
    });
    expect(receive.execute).toHaveBeenCalledWith({
      actorId: 'admin-1',
      marketingLeadId: 'lead-1',
      salesPriority: 'HIGH',
    });
  });

  it('no-ops when leadId missing', async () => {
    const receive = { execute: vi.fn() };
    const handler = new MarketingLeadQualifiedSalesHandler(receive as never);
    await handler.handle({
      eventId: 'e2',
      eventType: 'marketing.lead.qualified.v1',
      version: 1,
      occurredAt: new Date().toISOString(),
      tenantId: 'edge-control-plane',
      organizationId: null,
      correlationId: 'c2',
      causationId: null,
      traceId: null,
      actor: { type: 'user', id: 'admin-1' },
      source: 'okapi-edge',
      aggregateType: 'MARKETING_LEAD',
      aggregateId: 'x',
      payload: {},
    });
    expect(receive.execute).not.toHaveBeenCalled();
  });
});
