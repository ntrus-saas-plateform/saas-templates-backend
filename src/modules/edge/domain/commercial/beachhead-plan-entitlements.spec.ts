import { describe, expect, it } from 'vitest';
import { buildBbEntitlementProjectionFromItems } from '../subscription/bb-entitlement-projection.js';
import { assessEntitlementPayload } from '../provisioning/entitlement-payload.guard.js';
import {
  BEACHHEAD_PLAN_CODES,
  beachheadPlanEntitlementSnapshot,
  beachheadProfileCodeForFamily,
} from './beachhead-plan-entitlements.js';

describe('beachhead plan → BB provision readiness', () => {
  it.each(BEACHHEAD_PLAN_CODES.syntix)(
    'Syntix %s projects non-empty entitlements for bb_control',
    (planCode) => {
      const snap = beachheadPlanEntitlementSnapshot(planCode)!;
      expect(snap.productFamily).toBe('SYNTIX_PHARMA');
      expect(snap.capabilities.length).toBeGreaterThan(0);
      const built = buildBbEntitlementProjectionFromItems({
        items: [
          {
            itemType: 'PLAN',
            offerRef: planCode,
            snapshot: { capabilities: snap.capabilities },
          },
        ],
      });
      expect(built.empty).toBe(false);
      const emptiness = assessEntitlementPayload(
        built.projection.entitlements,
        built.projection.grants,
      );
      expect(emptiness.empty).toBe(false);
      expect(built.projection.entitlements.modules.pharmacy).toBe(true);
      expect(built.projection.entitlements.capabilities.PHARMACY).toBe(true);
      expect(beachheadProfileCodeForFamily(snap.productFamily)).toBe('PHARMACY');
    },
  );

  it.each(BEACHHEAD_PLAN_CODES.restaurant)(
    'Restaurant %s projects non-empty entitlements for bb_control',
    (planCode) => {
      const snap = beachheadPlanEntitlementSnapshot(planCode)!;
      expect(snap.productFamily).toBe('OKAPI_RESTAURANT');
      const built = buildBbEntitlementProjectionFromItems({
        items: [
          {
            itemType: 'PLAN',
            offerRef: planCode,
            snapshot: { capabilities: snap.capabilities },
          },
        ],
      });
      expect(built.empty).toBe(false);
      expect(built.projection.entitlements.modules.restaurant).toBe(true);
      expect(built.projection.entitlements.modules.pos).toBe(true);
      expect(built.projection.entitlements.capabilities.POS).toBe(true);
      if (planCode !== 'OKAPI_REST_STARTER') {
        // Growth+ include kitchen
        if (['OKAPI_REST_GROWTH', 'OKAPI_REST_MULTI', 'OKAPI_REST_ENTERPRISE'].includes(planCode)) {
          expect(built.projection.entitlements.modules.kitchen).toBe(true);
          expect(built.projection.entitlements.capabilities.KITCHEN).toBe(true);
        }
      }
      expect(beachheadProfileCodeForFamily(snap.productFamily)).toBe('RESTAURANT');
    },
  );

  it('Lite quotas are strict vs Professional', () => {
    const lite = beachheadPlanEntitlementSnapshot('SYNTIX_LITE')!;
    const pro = beachheadPlanEntitlementSnapshot('SYNTIX_PROFESSIONAL')!;
    const liteBuilt = buildBbEntitlementProjectionFromItems({
      items: [{ itemType: 'PLAN', offerRef: 'SYNTIX_LITE', snapshot: { capabilities: lite.capabilities } }],
    });
    const proBuilt = buildBbEntitlementProjectionFromItems({
      items: [
        {
          itemType: 'PLAN',
          offerRef: 'SYNTIX_PROFESSIONAL',
          snapshot: { capabilities: pro.capabilities },
        },
      ],
    });
    expect(liteBuilt.projection.entitlements.quotas.max_organizations).toBe(1);
    expect(proBuilt.projection.entitlements.quotas.max_organizations).toBeGreaterThan(1);
  });
});
