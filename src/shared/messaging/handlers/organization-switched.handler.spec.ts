import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OrganizationSwitchedHandler } from './organization-switched.handler.js';
import type { IntegrationEvent } from '../../../core/domain/events/integration-event.js';

describe('OrganizationSwitchedHandler', () => {
  const query = vi.fn();
  const dbManager = { getPool: vi.fn(async () => ({ query })) };
  const logger = { info: vi.fn() };
  let handler: OrganizationSwitchedHandler;

  beforeEach(() => {
    vi.clearAllMocks();
    handler = new OrganizationSwitchedHandler(dbManager as never, logger as never);
  });

  it('supports organization switched event type', () => {
    expect(handler.supports('platform.organization.switched.v1')).toBe(true);
    expect(handler.supports('other.event')).toBe(false);
  });

  it('persists event to integration_event_log', async () => {
    const event: IntegrationEvent = {
      eventId: 'evt-1',
      eventType: 'platform.organization.switched.v1',
      version: 1,
      occurredAt: new Date().toISOString(),
      tenantId: 'tenant-1',
      organizationId: 'org-2',
      correlationId: 'corr-1',
      causationId: null,
      traceId: null,
      actor: { type: 'user', id: 'user-a' },
      source: 'platform-core',
      payload: {
        userId: 'user-a',
        organizationId: 'org-2',
        previousOrganizationId: 'org-1',
      },
    };

    await handler.handle(event);

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('integration_event_log'),
      ['evt-1', 'platform.organization.switched.v1', expect.any(String)],
    );
  });
});
