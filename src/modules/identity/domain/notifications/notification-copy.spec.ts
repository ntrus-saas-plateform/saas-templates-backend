import { describe, it, expect } from 'vitest';
import { draftFromIntegrationEvent } from './notification-copy.js';
import type { IntegrationEvent } from '../../../../core/domain/events/integration-event.js';

function base(overrides: Partial<IntegrationEvent> & Pick<IntegrationEvent, 'eventType' | 'payload'>): IntegrationEvent {
  return {
    eventId: 'e1',
    version: 1,
    occurredAt: new Date().toISOString(),
    tenantId: 't1',
    organizationId: 'o1',
    correlationId: 'c1',
    causationId: null,
    traceId: null,
    actor: { type: 'user', id: 'actor-1' },
    source: 'platform-core',
    ...overrides,
  };
}

describe('draftFromIntegrationEvent', () => {
  it('maps membership.created', () => {
    const draft = draftFromIntegrationEvent(
      base({
        eventType: 'membership.created.v1',
        payload: { userId: 'u1', organizationId: 'o1' },
      }),
    );
    expect(draft).toMatchObject({
      userId: 'u1',
      category: 'membership',
      href: '/settings/memberships',
    });
  });

  it('maps user.suspended with high priority', () => {
    const draft = draftFromIntegrationEvent(
      base({
        eventType: 'user.suspended.v1',
        payload: { identityId: 'u1' },
      }),
    );
    expect(draft).toMatchObject({
      userId: 'u1',
      category: 'security',
      priority: 'high',
    });
  });

  it('returns null for unknown events', () => {
    expect(
      draftFromIntegrationEvent(
        base({ eventType: 'commerce.order.completed.v1', payload: {} }),
      ),
    ).toBeNull();
  });
});
