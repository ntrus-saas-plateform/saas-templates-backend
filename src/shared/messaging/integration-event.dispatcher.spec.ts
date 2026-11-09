import { describe, it, expect, vi } from 'vitest';
import { IntegrationEventDispatcher } from './integration-event.dispatcher.js';
import type { IntegrationEventHandler } from '../../core/domain/ports/integration-event-handler.port.js';
import type { IntegrationEvent } from '../../core/domain/events/integration-event.js';

describe('IntegrationEventDispatcher', () => {
  const event: IntegrationEvent = {
    eventId: 'evt-1',
    eventType: 'platform.organization.switched.v1',
    version: 1,
    occurredAt: new Date().toISOString(),
    tenantId: 'tenant-1',
    organizationId: 'org-1',
    correlationId: 'corr-1',
    causationId: null,
    traceId: null,
    actor: { type: 'user', id: 'user-a' },
    source: 'platform-core',
    payload: {},
  };

  const moduleRef = { get: vi.fn(() => {
    throw new Error('not found');
  }) };

  it('dispatches to matching handlers only', async () => {
    const matching: IntegrationEventHandler = {
      supports: (type) => type === event.eventType,
      handle: vi.fn(),
    };
    const other: IntegrationEventHandler = {
      supports: () => false,
      handle: vi.fn(),
    };

    const dispatcher = new IntegrationEventDispatcher(
      [matching, other],
      moduleRef as never,
      null,
    );
    await dispatcher.dispatch(event);

    expect(matching.handle).toHaveBeenCalledWith(event);
    expect(other.handle).not.toHaveBeenCalled();
  });

  it('merges EXTRA handlers', async () => {
    const core: IntegrationEventHandler = {
      supports: () => false,
      handle: vi.fn(),
    };
    const extra: IntegrationEventHandler = {
      supports: (type) => type === event.eventType,
      handle: vi.fn(),
    };
    const dispatcher = new IntegrationEventDispatcher(
      [core],
      moduleRef as never,
      [extra],
    );
    await dispatcher.dispatch(event);
    expect(extra.handle).toHaveBeenCalledWith(event);
  });

  it('resolves EXTRA via ModuleRef when inject is absent', async () => {
    const core: IntegrationEventHandler = {
      supports: () => false,
      handle: vi.fn(),
    };
    const extra: IntegrationEventHandler = {
      supports: (type) => type === event.eventType,
      handle: vi.fn(),
    };
    const ref = { get: vi.fn(() => [extra]) };
    const dispatcher = new IntegrationEventDispatcher([core], ref as never, null);
    await dispatcher.dispatch(event);
    expect(extra.handle).toHaveBeenCalledWith(event);
  });
});
