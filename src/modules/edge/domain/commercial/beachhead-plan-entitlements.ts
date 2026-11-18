/**
 * Beachhead plan → entitlement sources for Syntix Pharma + Okapi Restaurant.
 * Used when attaching subscription items / provisioning so Lite/Pro/Restaurant
 * never provision with an empty BB projection.
 */

import { EntitlementCapabilityKind, type EntitlementSource } from '../subscription/subscription.entity.js';
import {
  entitlementSourcesForPlan as syntixEntitlementSourcesForPlan,
  planEntitlementSnapshot as syntixPlanEntitlementSnapshot,
  SYNTIX_PLANS,
} from './syntix-pharma-catalog.seed.js';
import { RESTAURANT_CAPABILITIES, RESTAURANT_PLANS } from './okapi-restaurant-catalog.seed.js';

const QUOTA_CODES = new Set(['max_organizations', 'max_users', 'max_warehouses', 'max_pos_terminals']);

export function restaurantEntitlementSourcesForPlan(planCode: string): EntitlementSource[] {
  const plan = RESTAURANT_PLANS.find((p) => p.code === planCode);
  if (!plan) return [];
  const sources: EntitlementSource[] = [];
  for (const code of plan.caps) {
    const def = RESTAURANT_CAPABILITIES.find((c) => c.code === code);
    if (!def || QUOTA_CODES.has(code)) continue;
    sources.push({
      sourceType: 'PLAN',
      sourceRef: plan.code,
      capabilityCode: code,
      kind: EntitlementCapabilityKind.FEATURE_FLAG,
      enabled: true,
    });
  }
  for (const [quotaCode, limit] of Object.entries(plan.quotas)) {
    sources.push({
      sourceType: 'PLAN',
      sourceRef: plan.code,
      capabilityCode: quotaCode,
      kind: EntitlementCapabilityKind.QUOTA,
      enabled: true,
      numericLimit: limit,
    });
  }
  return sources;
}

export function restaurantPlanEntitlementSnapshot(planCode: string): {
  planCode: string;
  capabilities: EntitlementSource[];
} {
  return {
    planCode,
    capabilities: restaurantEntitlementSourcesForPlan(planCode),
  };
}

/** Resolve beachhead snapshot by commercial plan code (Syntix or Restaurant). */
export function beachheadPlanEntitlementSnapshot(planCode: string | null | undefined): {
  planCode: string;
  productFamily: 'SYNTIX_PHARMA' | 'OKAPI_RESTAURANT';
  capabilities: EntitlementSource[];
} | null {
  const code = planCode?.trim();
  if (!code) return null;
  if (SYNTIX_PLANS.some((p) => p.code === code)) {
    const snap = syntixPlanEntitlementSnapshot(code);
    return {
      planCode: code,
      productFamily: 'SYNTIX_PHARMA',
      capabilities: snap.capabilities,
    };
  }
  if (RESTAURANT_PLANS.some((p) => p.code === code)) {
    const snap = restaurantPlanEntitlementSnapshot(code);
    return {
      planCode: code,
      productFamily: 'OKAPI_RESTAURANT',
      capabilities: snap.capabilities,
    };
  }
  return null;
}

export function entitlementSourcesForBeachheadPlan(planCode: string): EntitlementSource[] {
  if (SYNTIX_PLANS.some((p) => p.code === planCode)) {
    return syntixEntitlementSourcesForPlan(planCode);
  }
  return restaurantEntitlementSourcesForPlan(planCode);
}

/** Extract plan code from offer/config/metadata blobs. */
export function extractBeachheadPlanCode(
  ...blobs: Array<Record<string, unknown> | null | undefined>
): string | null {
  for (const blob of blobs) {
    if (!blob) continue;
    for (const key of ['planCode', 'plan_code', 'offerRef', 'commercialPlanCode'] as const) {
      const v = blob[key];
      if (typeof v === 'string' && v.trim() && beachheadPlanEntitlementSnapshot(v.trim())) {
        return v.trim();
      }
    }
    const nested = blob.offerConfiguration;
    if (nested && typeof nested === 'object') {
      const found = extractBeachheadPlanCode(nested as Record<string, unknown>);
      if (found) return found;
    }
  }
  return null;
}

export function beachheadProfileCodeForFamily(
  family: 'SYNTIX_PHARMA' | 'OKAPI_RESTAURANT' | string | null | undefined,
): string | null {
  if (family === 'SYNTIX_PHARMA') return 'PHARMACY';
  if (family === 'OKAPI_RESTAURANT') return 'RESTAURANT';
  if (family === 'OKAPI_RETAIL') return 'SUPERMARKET';
  if (family === 'OKAPI_HOSPITALITY') return 'HOTEL_HOSPITALITY';
  if (family === 'OKAPI_MANUFACTURING' || family === 'MANUFACTURING') return 'MANUFACTURING';
  if (family === 'OKAPI_EQUIPMENT_RENTAL' || family === 'EQUIPMENT_RENTAL') {
    return 'EQUIPMENT_RENTAL';
  }
  return null;
}

export const BEACHHEAD_PLAN_CODES = {
  syntix: SYNTIX_PLANS.map((p) => p.code),
  restaurant: RESTAURANT_PLANS.map((p) => p.code),
} as const;
