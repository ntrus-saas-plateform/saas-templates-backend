import { describe, expect, it } from 'vitest';
import { EntitlementCapabilityKind } from './subscription.entity.js';
import {
  buildBbEntitlementProjectionFromItems,
  projectResolvedEntitlementsToBbControl,
} from './bb-entitlement-projection.js';

describe('bb-entitlement-projection', () => {
  it('maps feature flags to modules and dotted caps', () => {
    const projection = projectResolvedEntitlementsToBbControl([
      {
        capabilityCode: 'pos',
        kind: EntitlementCapabilityKind.FEATURE_FLAG,
        enabled: true,
        numericLimit: null,
        sources: ['PLAN:lite'],
        conflictResolution: 'BOOLEAN_OR',
      },
      {
        capabilityCode: 'pharmacy.batch',
        kind: EntitlementCapabilityKind.FEATURE_FLAG,
        enabled: true,
        numericLimit: null,
        sources: ['PLAN:lite'],
        conflictResolution: 'BOOLEAN_OR',
      },
      {
        capabilityCode: 'max_organizations',
        kind: EntitlementCapabilityKind.QUOTA,
        enabled: true,
        numericLimit: 5,
        sources: ['PLAN:lite'],
        conflictResolution: 'MAX',
      },
    ]);

    expect(projection.entitlements.modules.pos).toBe(true);
    expect(projection.entitlements.capabilities.POS).toBe(true);
    expect(projection.entitlements.capabilities.PHARMACY_BATCH).toBe(true);
    expect(projection.entitlements.quotas.max_organizations).toBe(5);
    expect(projection.grants.some((g) => g.code === 'pos' && g.enabled)).toBe(true);
    expect(projection.grants.some((g) => g.code === 'POS' && g.enabled)).toBe(true);
  });

  it('builds non-empty projection from subscription item snapshots', () => {
    const built = buildBbEntitlementProjectionFromItems({
      items: [
        {
          itemType: 'PLAN',
          offerRef: 'plan-pro',
          snapshot: {
            capabilities: [
              {
                sourceType: 'PLAN',
                capabilityCode: 'pharmacy',
                kind: EntitlementCapabilityKind.FEATURE_FLAG,
                enabled: true,
              },
              {
                sourceType: 'PLAN',
                capabilityCode: 'inventory',
                kind: EntitlementCapabilityKind.FEATURE_FLAG,
                enabled: true,
              },
            ],
          },
        },
        {
          itemType: 'ADDON',
          offerRef: 'addon-api',
          snapshot: {
            capabilities: [
              {
                sourceType: 'ADDON',
                capabilityCode: 'api',
                kind: EntitlementCapabilityKind.FEATURE_FLAG,
                enabled: true,
              },
            ],
          },
        },
      ],
    });

    expect(built.empty).toBe(false);
    expect(built.projection.entitlements.modules).toMatchObject({
      pharmacy: true,
      inventory: true,
      api: true,
    });
  });

  it('falls back to entitlementRef as feature flag', () => {
    const built = buildBbEntitlementProjectionFromItems({
      items: [
        {
          itemType: 'PLAN',
          offerRef: 'plan-1',
          entitlementRef: 'identity',
          snapshot: {},
        },
      ],
    });
    expect(built.empty).toBe(false);
    expect(built.projection.entitlements.modules.identity).toBe(true);
  });
});
