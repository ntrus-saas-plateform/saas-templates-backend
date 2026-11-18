import { describe, expect, it } from 'vitest';
import {
  RESTAURANT_CAPABILITIES,
  RESTAURANT_ICPS,
  RESTAURANT_PLANS,
  RESTAURANT_SEGMENTS,
  restaurantPlanHasNoPlannedCaps,
} from './okapi-restaurant-catalog.seed.js';

describe('okapi restaurant catalog seed', () => {
  it('defines prioritized segments and ICPs', () => {
    expect(RESTAURANT_SEGMENTS.some((s) => s.code === 'REST_INDEPENDENT')).toBe(true);
    expect(RESTAURANT_SEGMENTS.some((s) => s.code === 'REST_MULTI_SITE')).toBe(true);
    expect(RESTAURANT_ICPS.length).toBeGreaterThanOrEqual(3);
  });

  it('has distinct restaurant plans (not pharma codes)', () => {
    expect(RESTAURANT_PLANS.every((p) => p.code.startsWith('OKAPI_REST_'))).toBe(true);
    expect(RESTAURANT_PLANS.map((p) => p.tier)).toEqual(
      expect.arrayContaining(['LITE', 'PROFESSIONAL', 'BUSINESS', 'ENTERPRISE']),
    );
  });

  it('never seeds Planned capabilities into beachhead catalog', () => {
    expect(restaurantPlanHasNoPlannedCaps()).toBe(true);
    expect(RESTAURANT_CAPABILITIES.every((c) => c.status !== 'PLANNED')).toBe(true);
  });
});
