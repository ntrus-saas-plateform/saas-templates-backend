import { describe, expect, it } from 'vitest';
import { assessEntitlementPayload } from '../provisioning/entitlement-payload.guard.js';
import { EntitlementCapabilityKind } from './subscription.entity.js';
import {
  buildBbEntitlementProjectionFromItems,
  projectResolvedEntitlementsToBbControl,
} from './bb-entitlement-projection.js';
import { planEntitlementSnapshot } from '../commercial/syntix-pharma-catalog.seed.js';

describe('entitlement adversarial (no silent expansion beyond grant)', () => {
  it('does not invent capabilities absent from item snapshots', () => {
    const lite = planEntitlementSnapshot('SYNTIX_LITE');
    const built = buildBbEntitlementProjectionFromItems({
      items: [
        {
          itemType: 'PLAN',
          offerRef: 'SYNTIX_LITE',
          snapshot: { capabilities: lite.capabilities },
        },
      ],
    });
    expect(built.projection.entitlements.modules.sso).toBeUndefined();
    expect(built.projection.entitlements.modules.warehouse).toBeUndefined();
    expect(built.projection.entitlements.modules.governance).toBeUndefined();
    expect(built.projection.entitlements.quotas.max_organizations).toBe(1);
  });

  it('rejects empty projection (fail-closed publish gate)', () => {
    const empty = projectResolvedEntitlementsToBbControl([]);
    const emptiness = assessEntitlementPayload(empty.entitlements, empty.grants);
    expect(emptiness.empty).toBe(true);
  });

  it('never promotes dotted capability codes to modules', () => {
    const projection = projectResolvedEntitlementsToBbControl([
      {
        capabilityCode: 'pharmacy.batch',
        kind: EntitlementCapabilityKind.FEATURE_FLAG,
        enabled: true,
        numericLimit: null,
        sources: ['PLAN:x'],
        conflictResolution: 'BOOLEAN_OR',
      },
    ]);
    expect(projection.entitlements.modules['pharmacy.batch']).toBeUndefined();
    expect(projection.entitlements.modules.pharmacy).toBeUndefined();
    // Dual-write UPPER_SNAKE (BB @RequiresCapability) — dotted code reste une
    // capability, jamais un module ; la clé publiée est PHARMACY_BATCH.
    expect(projection.entitlements.capabilities['PHARMACY_BATCH']).toBe(true);
    expect(projection.entitlements.capabilities['pharmacy.batch']).toBeUndefined();
  });

  it('OR of feature flags cannot enable a code that was never sourced', () => {
    const built = buildBbEntitlementProjectionFromItems({
      items: [
        {
          itemType: 'PLAN',
          offerRef: 'p1',
          snapshot: {
            capabilities: [
              {
                sourceType: 'PLAN',
                capabilityCode: 'pos',
                kind: EntitlementCapabilityKind.FEATURE_FLAG,
                enabled: true,
              },
            ],
          },
        },
        {
          itemType: 'ADDON',
          offerRef: 'a1',
          snapshot: {
            capabilities: [
              {
                sourceType: 'ADDON',
                capabilityCode: 'api',
                kind: EntitlementCapabilityKind.FEATURE_FLAG,
                enabled: false,
              },
            ],
          },
        },
      ],
    });
    expect(built.projection.entitlements.modules.pos).toBe(true);
    expect(built.projection.entitlements.modules.api).toBe(false);
    expect(built.projection.entitlements.modules.analytics).toBeUndefined();
  });

  it('quota MAX cannot exceed highest granted numericLimit', () => {
    const built = buildBbEntitlementProjectionFromItems({
      items: [
        {
          itemType: 'PLAN',
          offerRef: 'lite',
          snapshot: {
            capabilities: [
              {
                sourceType: 'PLAN',
                capabilityCode: 'max_users',
                kind: EntitlementCapabilityKind.QUOTA,
                enabled: true,
                numericLimit: 5,
              },
            ],
          },
        },
        {
          itemType: 'ADDON',
          offerRef: 'users',
          snapshot: {
            capabilities: [
              {
                sourceType: 'ADDON',
                capabilityCode: 'max_users',
                kind: EntitlementCapabilityKind.QUOTA,
                enabled: true,
                numericLimit: 25,
              },
            ],
          },
        },
      ],
    });
    expect(built.projection.entitlements.quotas.max_users).toBe(25);
  });
});
