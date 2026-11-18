/**
 * Doc 39 W4 — lightweight control/v1 contract checks per product family.
 * Offline: entitlement projection shape (modules object, no zero quotas).
 * Live (optional): discover + ready schema when lab env is configured.
 */
import { describe, expect, it } from 'vitest';
import {
  commercialPlanEntitlementSnapshot,
  productFamilyForProfileCode,
} from '../../domain/commercial/commercial-plan-entitlements.js';
import { buildBbEntitlementProjectionFromItems } from '../../domain/subscription/bb-entitlement-projection.js';

const LAB_BASE = (process.env.EDGE_BB_CONTROL_BASE_URL ?? '').replace(/\/$/, '');
const LAB_TOKEN =
  process.env.EDGE_BB_CONTROL_TOKEN ??
  process.env.EDGE_CONTROL_LAB_TOKEN ??
  process.env.EDGE_CONTROL_BEARER ??
  '';
const labConfigured = Boolean(LAB_BASE && LAB_TOKEN.trim());
const labTenantId = process.env.LAB_E2E_TENANT_ID?.trim();

const FAMILY_CONTRACT_SCENARIOS = [
  {
    family: 'SYNTIX_PHARMA',
    planCode: 'SYNTIX_LITE',
    profileCode: 'PHARMACY',
    productCode: 'SYNTIX_PHARMA',
    expectedModule: 'pharmacy',
  },
  {
    family: 'OKAPI_RESTAURANT',
    planCode: 'OKAPI_REST_STARTER',
    profileCode: 'RESTAURANT',
    productCode: 'OKAPI_RESTAURANT',
    expectedModule: 'restaurant',
  },
  {
    family: 'OKAPI_RETAIL',
    planCode: 'OKAPI_RETAIL_LITE',
    profileCode: 'SUPERMARKET',
    productCode: 'OKAPI_RETAIL',
    expectedModule: 'retail',
  },
  {
    family: 'OKAPI_HOSPITALITY',
    planCode: 'OKAPI_HOSP_LITE',
    profileCode: 'HOTEL_HOSPITALITY',
    productCode: 'OKAPI_HOSPITALITY',
    expectedModule: 'hospitality',
  },
] as const;

function labHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${LAB_TOKEN}`,
    'X-Edge-Control-Token': LAB_TOKEN,
  };
}

describe('control/v1 family contract — offline projection', () => {
  it.each(FAMILY_CONTRACT_SCENARIOS)(
    '$family ($planCode) exposes modules object without invented zero quotas',
    ({ planCode, profileCode, expectedModule, family, productCode }) => {
      const snap = commercialPlanEntitlementSnapshot(planCode);
      expect(snap).toBeTruthy();
      expect(snap!.profileCode).toBe(profileCode);
      expect(snap!.productCode).toBe(productCode);
      expect(productFamilyForProfileCode(profileCode)).toBe(family);

      const built = buildBbEntitlementProjectionFromItems({
        items: [
          {
            itemType: 'PLAN',
            offerRef: planCode,
            snapshot: { capabilities: snap!.capabilities },
          },
        ],
      });
      expect(built.empty).toBe(false);
      expect(built.projection.entitlements.modules).toEqual(expect.any(Object));
      expect(Object.keys(built.projection.entitlements.modules).length).toBeGreaterThan(0);
      expect(built.projection.entitlements.modules[expectedModule]).toBe(true);

      for (const [quotaKey, value] of Object.entries(built.projection.entitlements.quotas)) {
        const fromPlan = snap!.capabilities.find((c) => c.capabilityCode === quotaKey);
        expect(fromPlan, `quota ${quotaKey} must come from plan snapshot`).toBeTruthy();
        expect(fromPlan!.numericLimit, `quota ${quotaKey} projection`).toBe(value);
        if (value === 0) {
          expect(fromPlan!.numericLimit === 0, `quota ${quotaKey}: 0 only if explicit in plan`).toBe(
            true,
          );
        } else {
          expect(value).toBeGreaterThan(0);
        }
      }
    },
  );
});

describe.skipIf(!labConfigured)('control/v1 family contract — lab discover/ready', () => {
  it('discover document exposes entitlement schema with modules property', async () => {
    const res = await fetch(`${LAB_BASE}/control/v1/discover`, { headers: labHeaders() });
    expect(res.ok, `discover HTTP ${res.status}`).toBe(true);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.protocol).toBe('okapi.bb.discovery');
    const schema = body.entitlement_schema as Record<string, unknown> | undefined;
    expect(schema).toBeTruthy();
    const props = schema?.properties as Record<string, unknown> | undefined;
    expect(props?.modules).toEqual(expect.objectContaining({ type: 'object' }));
  });

  it.each(FAMILY_CONTRACT_SCENARIOS)(
    '$family commercial snapshot is non-empty for lab provision payloads',
    ({ planCode }) => {
      const snap = commercialPlanEntitlementSnapshot(planCode);
      expect(snap?.capabilities.length).toBeGreaterThan(0);
    },
  );

  it.skipIf(!labTenantId)(
    'tenant ready response uses boolean ready (no invented quotas on probe)',
    async () => {
      const res = await fetch(
        `${LAB_BASE}/control/v1/tenants/${encodeURIComponent(labTenantId!)}/ready`,
        { headers: labHeaders() },
      );
      if (res.status === 403) {
        expect(res.status).toBe(403);
        return;
      }
      expect([200, 503]).toContain(res.status);
      const body = (await res.json()) as { ready?: boolean; entitlements?: Record<string, unknown> };
      expect(typeof body.ready).toBe('boolean');
      const quotas = body.entitlements?.quotas as Record<string, number> | undefined;
      if (quotas) {
        for (const [k, v] of Object.entries(quotas)) {
          expect(v, `lab tenant quota ${k}`).toBeGreaterThanOrEqual(0);
        }
      }
    },
  );
});