import { describe, expect, it } from 'vitest';
import {
  assertCommercialPlanSellableOrThrow,
  assertPlanCapsAlignCapabilityCatalog,
  commercialPlanCapabilityMatrix,
  commercialPlanEntitlementSnapshot,
  EDGE_FAMILY_BY_PROFILE,
  entitlementSourcesForCommercialPlan,
  productFamilyForProfileCode,
  profileCodeForProductOrFamily,
} from './commercial-plan-entitlements.js';
import { RESTAURANT_CAFE_CONTROLLED_PACK } from './okapi-restaurant-catalog.seed.js';
import { RETAIL_PLANS } from './okapi-retail-catalog.seed.js';
import { HOSPITALITY_PLANS } from './okapi-hospitality-catalog.seed.js';

describe('commercial-plan-entitlements', () => {
  it('resolves beachhead Syntix Lite with PHARMACY profile', () => {
    const snap = commercialPlanEntitlementSnapshot('SYNTIX_LITE');
    expect(snap?.productCode).toBe('SYNTIX_PHARMA');
    expect(snap?.profileCode).toBe('PHARMACY');
    expect(snap?.capabilities.length).toBeGreaterThan(0);
    expect(snap?.roadmapStatus).toBe('BEACHHEAD');
  });

  it('resolves restaurant starter with RESTAURANT profile', () => {
    const snap = commercialPlanEntitlementSnapshot('OKAPI_REST_STARTER');
    expect(snap?.productCode).toBe('OKAPI_RESTAURANT');
    expect(snap?.profileCode).toBe('RESTAURANT');
  });

  it('maps product codes to BB profiles via bindings', () => {
    expect(profileCodeForProductOrFamily('OKAPI_HOSPITALITY')).toBe('HOTEL_HOSPITALITY');
    expect(profileCodeForProductOrFamily('OKAPI_RETAIL')).toBe('SUPERMARKET');
  });

  it('keeps CAFE pack controlled under restaurant tenant', () => {
    expect(RESTAURANT_CAFE_CONTROLLED_PACK.bbProfileCode).toBe('CAFE');
    expect(RESTAURANT_CAFE_CONTROLLED_PACK.commercialAvailability).toBe('CONTROLLED_ROLLOUT');
    expect(RESTAURANT_CAFE_CONTROLLED_PACK.quotas.max_customers).toBe(5000);
    expect(RESTAURANT_CAFE_CONTROLLED_PACK.quotas.max_products).toBe(800);
  });

  it('resolves retail/hospitality stubs as non-sellable', () => {
    const retail = commercialPlanEntitlementSnapshot('OKAPI_RETAIL_LITE');
    expect(retail?.roadmapStatus).toBe('PLANNED_STUB');
    expect(retail?.sellable).toBe(false);
    expect(retail?.profileCode).toBe('SUPERMARKET');

    const hosp = commercialPlanEntitlementSnapshot('OKAPI_HOSP_LITE');
    expect(hosp?.sellable).toBe(false);
    expect(hosp?.profileCode).toBe('HOTEL_HOSPITALITY');

    const sources = entitlementSourcesForCommercialPlan('OKAPI_RETAIL_LITE');
    expect(sources.some((s) => s.capabilityCode === 'max_organizations')).toBe(true);
    expect(sources).toEqual(retail?.capabilities);
  });

  it('builds capability matrix for all four beachhead/roadmap families', () => {
    const matrix = commercialPlanCapabilityMatrix();
    expect(matrix.length).toBeGreaterThanOrEqual(4 * 4);
    for (const row of matrix) {
      expect(row.moduleCapabilityCodes.length).toBeGreaterThan(0);
      expect(productFamilyForProfileCode(row.profileCode)).toBe(row.productFamily);
      expect(() => assertPlanCapsAlignCapabilityCatalog(row.planCode)).not.toThrow();
    }
    const families = new Set(matrix.map((r) => r.productFamily));
    for (const f of [
      'SYNTIX_PHARMA',
      'OKAPI_RESTAURANT',
      'OKAPI_RETAIL',
      'OKAPI_HOSPITALITY',
    ] as const) {
      expect(families.has(f)).toBe(true);
    }
  });

  it('EDGE_FAMILY_BY_PROFILE stays aligned with PHARMACY→SYNTIX and HOTEL_HOSPITALITY→HOSPITALITY', () => {
    expect(EDGE_FAMILY_BY_PROFILE.PHARMACY).toBe('SYNTIX_PHARMA');
    expect(EDGE_FAMILY_BY_PROFILE.SUPERMARKET).toBe('OKAPI_RETAIL');
    expect(EDGE_FAMILY_BY_PROFILE.HOTEL_HOSPITALITY).toBe('OKAPI_HOSPITALITY');
    expect(EDGE_FAMILY_BY_PROFILE.RESTAURANT).toBe('OKAPI_RESTAURANT');
  });

  it('covers full Lite→Enterprise ladders without selling', () => {
    expect(RETAIL_PLANS).toHaveLength(4);
    expect(HOSPITALITY_PLANS).toHaveLength(4);
    for (const p of [...RETAIL_PLANS, ...HOSPITALITY_PLANS]) {
      expect(commercialPlanEntitlementSnapshot(p.code)?.sellable).toBe(false);
      expect(() => assertCommercialPlanSellableOrThrow(p.code)).toThrow(/PRODUCT_NOT_SELLABLE/);
    }
    expect(() => assertCommercialPlanSellableOrThrow('SYNTIX_LITE')).not.toThrow();
  });
});
