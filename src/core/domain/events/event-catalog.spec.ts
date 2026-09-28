import { describe, it, expect } from 'vitest';
import { EVENT_CATALOG, isRegisteredEventType } from './event-catalog.js';

describe('Event Catalog', () => {
  it('includes organization.switched event', () => {
    expect(isRegisteredEventType('platform.organization.switched.v1')).toBe(true);
  });

  it('rejects unknown event types', () => {
    expect(isRegisteredEventType('unknown.event.v1')).toBe(false);
  });

  it('has unique event types', () => {
    const types = EVENT_CATALOG.map((e) => e.eventType);
    expect(new Set(types).size).toBe(types.length);
  });
});
