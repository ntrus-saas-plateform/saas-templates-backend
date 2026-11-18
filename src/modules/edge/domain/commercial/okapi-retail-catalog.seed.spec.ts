import { describe, expect, it } from 'vitest';
import {
  RETAIL_PLANS,
  RETAIL_PRODUCT_CODE,
  retailPlanHasNoPlannedCaps,
} from './okapi-retail-catalog.seed.js';
import { bindingForProductCode } from './product-family-bindings.js';

describe('okapi-retail-catalog', () => {
  it('keeps product INTERNAL_ONLY in bindings', () => {
    expect(bindingForProductCode(RETAIL_PRODUCT_CODE)?.commercialAvailability).toBe(
      'INTERNAL_ONLY',
    );
  });

  it('has distinct Lite→Enterprise tiers', () => {
    expect(RETAIL_PLANS.map((p) => p.tier)).toEqual([
      'LITE',
      'PROFESSIONAL',
      'BUSINESS',
      'ENTERPRISE',
    ]);
    expect(RETAIL_PLANS.every((p) => p.bbProfileCode === 'SUPERMARKET')).toBe(true);
    expect(retailPlanHasNoPlannedCaps()).toBe(true);
  });
});
