import { describe, expect, it } from 'vitest';
import { buildBbEntitlementProjectionFromItems } from '../subscription/bb-entitlement-projection.js';
import {
  SYNTIX_CAPABILITIES,
  SYNTIX_PACKAGES,
  SYNTIX_PLANS,
  SYNTIX_PRODUCT_CODE,
  assertPlanCapabilityNesting,
  entitlementSourcesForPlan,
  planEntitlementSnapshot,
} from './syntix-pharma-catalog.seed.js';

describe('Syntix Pharma commercial catalog (RGOM E1/E2)', () => {
  it('exposes beachhead product code', () => {
    expect(SYNTIX_PRODUCT_CODE).toBe('SYNTIX_PHARMA');
  });

  it('nests Lite ⊂ Professional ⊂ Business ⊂ Enterprise capabilities', () => {
    expect(() => assertPlanCapabilityNesting()).not.toThrow();
  });

  it('has four distinct plan tiers', () => {
    const tiers = SYNTIX_PLANS.map((p) => p.planTier);
    expect(tiers).toEqual(['LITE', 'PROFESSIONAL', 'BUSINESS', 'ENTERPRISE']);
  });

  it('publishes four solution packages including wholesale with warehouse', () => {
    expect(SYNTIX_PACKAGES.map((p) => p.code)).toEqual([
      'PKG_RETAIL_PHARMACY',
      'PKG_PHARMACY_CHAIN',
      'PKG_WHOLESALE',
      'PKG_DISTRIBUTION',
    ]);
    const wholesale = SYNTIX_PACKAGES.find((p) => p.code === 'PKG_WHOLESALE')!;
    expect(wholesale.capabilityCodes).toContain('warehouse');
    expect(wholesale.capabilityCodes).toContain('b2b_sales');
  });

  it('marks all beachhead capabilities commercially AVAILABLE', () => {
    for (const cap of SYNTIX_CAPABILITIES) {
      expect(cap.commercialAvailability).toBe('AVAILABLE');
      expect(cap.technicalStatus).toBe('AVAILABLE');
    }
  });

  it('builds non-empty entitlement snapshot for every plan', () => {
    for (const plan of SYNTIX_PLANS) {
      const snap = planEntitlementSnapshot(plan.code);
      expect(snap.capabilities.length).toBeGreaterThan(0);
      expect(entitlementSourcesForPlan(plan.code).length).toBe(snap.capabilities.length);
    }
  });

  it('projects Lite plan → BB control payload with modules + dotted caps + quotas', () => {
    const snap = planEntitlementSnapshot('SYNTIX_LITE');
    const result = buildBbEntitlementProjectionFromItems({
      items: [
        {
          itemType: 'PLAN',
          offerRef: 'SYNTIX_LITE',
          snapshot: { capabilities: snap.capabilities },
        },
      ],
    });
    expect(result.empty).toBe(false);
    expect(result.projection.entitlements.modules.pharmacy).toBe(true);
    expect(result.projection.entitlements.modules.inventory).toBe(true);
    expect(result.projection.entitlements.modules.pos).toBe(true);
    // Dual-write UPPER_SNAKE for BB @RequiresCapability (+ dotted → PHARMACY_BATCH)
    expect(result.projection.entitlements.capabilities.PHARMACY).toBe(true);
    expect(result.projection.entitlements.capabilities.PHARMACY_BATCH).toBe(true);
    expect(result.projection.entitlements.capabilities.PHARMACY_EXPIRY).toBe(true);
    expect(result.projection.entitlements.quotas.max_organizations).toBe(1);
    expect(result.projection.entitlements.quotas.max_users).toBe(5);
    expect(result.projection.grants.length).toBeGreaterThan(0);
  });

  it('projects Enterprise with warehouse + sso and higher quotas', () => {
    const snap = planEntitlementSnapshot('SYNTIX_ENTERPRISE');
    const result = buildBbEntitlementProjectionFromItems({
      items: [
        {
          itemType: 'PLAN',
          offerRef: 'SYNTIX_ENTERPRISE',
          snapshot: { capabilities: snap.capabilities },
        },
      ],
    });
    expect(result.empty).toBe(false);
    expect(result.projection.entitlements.modules.warehouse).toBe(true);
    expect(result.projection.entitlements.modules.sso).toBe(true);
    expect(result.projection.entitlements.quotas.max_organizations).toBe(100);
    expect(result.projection.entitlements.quotas.max_warehouses).toBe(50);
  });
});
