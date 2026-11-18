import { describe, expect, it } from 'vitest';
import {
  HOSPITALITY_PLANS,
  HOSPITALITY_PRODUCT_CODE,
  hospitalityPlanHasNoPlannedCaps,
} from './okapi-hospitality-catalog.seed.js';
import { bindingForProductCode } from './product-family-bindings.js';

describe('okapi-hospitality-catalog', () => {
  it('keeps product INTERNAL_ONLY in bindings', () => {
    expect(bindingForProductCode(HOSPITALITY_PRODUCT_CODE)?.commercialAvailability).toBe(
      'INTERNAL_ONLY',
    );
  });

  it('maps all plans to HOTEL_HOSPITALITY', () => {
    expect(HOSPITALITY_PLANS).toHaveLength(4);
    expect(HOSPITALITY_PLANS.every((p) => p.bbProfileCode === 'HOTEL_HOSPITALITY')).toBe(true);
    expect(hospitalityPlanHasNoPlannedCaps()).toBe(true);
  });
});
