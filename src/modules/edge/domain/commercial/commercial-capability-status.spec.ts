import { describe, expect, it } from 'vitest';
import {
  assertCapabilityCommerciallyIncludable,
  isCommerciallyIncludable,
} from './commercial-capability-status.js';

describe('commercial capability status', () => {
  it('blocks Planned and Deprecated from Published inclusion', () => {
    expect(isCommerciallyIncludable('AVAILABLE')).toBe(true);
    expect(isCommerciallyIncludable('PLANNED')).toBe(false);
    expect(() => assertCapabilityCommerciallyIncludable('PLANNED', 'cap.x')).toThrow(
      /not commercially includable/i,
    );
  });
});
