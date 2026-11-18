/**
 * Extensible commercial plan → entitlements registry (doc 39 W1).
 * Beachhead (Syntix + Restaurant) today; Retail/Hospitality attach after G11 seeds.
 */

import { EntitlementCapabilityKind, type EntitlementSource } from '../subscription/subscription.entity.js';
import {
  beachheadPlanEntitlementSnapshot,
  beachheadProfileCodeForFamily,
  entitlementSourcesForBeachheadPlan,
  extractBeachheadPlanCode,
} from './beachhead-plan-entitlements.js';
import { HOSPITALITY_CAPABILITIES, HOSPITALITY_PLANS } from './okapi-hospitality-catalog.seed.js';
import { RETAIL_CAPABILITIES, RETAIL_PLANS } from './okapi-retail-catalog.seed.js';
import { RESTAURANT_CAPABILITIES, RESTAURANT_PLANS } from './okapi-restaurant-catalog.seed.js';
import {
  SYNTIX_CAPABILITIES,
  SYNTIX_PLANS,
} from './syntix-pharma-catalog.seed.js';
import {
  defaultProfileForProductCode,
  type EdgeProductFamily,
} from './product-family-bindings.js';

export type CommercialPlanEntitlementSnapshot = {
  planCode: string;
  productFamily: string;
  productCode: string;
  profileCode: string | null;
  capabilities: EntitlementSource[];
  roadmapStatus: 'BEACHHEAD' | 'PLANNED_STUB';
  sellable: boolean;
};

/**
 * Mirror of BB `FAMILY_BY_PROFILE` (ADR-055) for Edge-side assurance — doc 39 W4.
 * Keep in sync with `edge-business-backend/.../product-family.ts`.
 */
export const EDGE_FAMILY_BY_PROFILE: Readonly<Record<string, EdgeProductFamily>> = Object.freeze({
  PHARMACY: 'SYNTIX_PHARMA',
  WHOLESALE: 'SYNTIX_PHARMA',
  DISTRIBUTION: 'SYNTIX_PHARMA',
  RESTAURANT: 'OKAPI_RESTAURANT',
  CAFE: 'OKAPI_RESTAURANT',
  BAR: 'OKAPI_RESTAURANT',
  SUPERMARKET: 'OKAPI_RETAIL',
  BOUTIQUE: 'OKAPI_RETAIL',
  GROCERY: 'OKAPI_RETAIL',
  FOOD_RETAIL: 'OKAPI_RETAIL',
  ELECTRONICS_RETAIL: 'OKAPI_RETAIL',
  HARDWARE_BUILDING_SUPPLIES: 'OKAPI_RETAIL',
  AUTO_PARTS: 'OKAPI_RETAIL',
  TEXTILE_FABRIC_RETAIL: 'OKAPI_RETAIL',
  JEWELRY_RETAIL: 'OKAPI_RETAIL',
  OPTICAL_RETAIL: 'OKAPI_RETAIL',
  HOTEL: 'OKAPI_HOSPITALITY',
  HOSPITALITY: 'OKAPI_HOSPITALITY',
  HOTEL_HOSPITALITY: 'OKAPI_HOSPITALITY',
});

export function productFamilyForProfileCode(profileCode: string | null | undefined): EdgeProductFamily {
  const canonical = profileCode?.trim().toUpperCase() ?? '';
  return EDGE_FAMILY_BY_PROFILE[canonical] ?? 'OKAPI_OTHER';
}

export type CommercialPlanCapabilityRow = {
  readonly planCode: string;
  readonly productFamily: string;
  readonly productCode: string;
  readonly profileCode: string;
  /** Commercial module keys → BB `capability_definitions` / ModuleGuard. */
  readonly moduleCapabilityCodes: readonly string[];
  readonly quotaCapabilityCodes: readonly string[];
  readonly roadmapStatus: CommercialPlanEntitlementSnapshot['roadmapStatus'];
  readonly sellable: boolean;
};

const QUOTA_CAPABILITY_CODES = new Set([
  'max_organizations',
  'max_users',
  'max_warehouses',
  'max_pos_terminals',
]);

function splitModuleAndQuotaCodes(sources: readonly EntitlementSource[]): {
  modules: string[];
  quotas: string[];
} {
  const modules: string[] = [];
  const quotas: string[] = [];
  for (const row of sources) {
    const code = row.capabilityCode?.trim();
    if (!code) continue;
    if (row.kind === EntitlementCapabilityKind.QUOTA || QUOTA_CAPABILITY_CODES.has(code)) {
      quotas.push(code);
      continue;
    }
    if (row.kind === EntitlementCapabilityKind.FEATURE_FLAG) {
      modules.push(code);
    }
  }
  return { modules, quotas };
}

function capabilityCatalogIsPlanned(productFamily: string, code: string): boolean {
  switch (productFamily) {
    case 'SYNTIX_PHARMA': {
      const row = SYNTIX_CAPABILITIES.find((c) => c.code === code);
      return !row || row.technicalStatus === 'PLANNED';
    }
    case 'OKAPI_RESTAURANT': {
      const row = RESTAURANT_CAPABILITIES.find((c) => c.code === code);
      return !row || row.status === 'PLANNED';
    }
    case 'OKAPI_RETAIL': {
      const row = RETAIL_CAPABILITIES.find((c) => c.code === code);
      return !row || row.status === 'PLANNED';
    }
    case 'OKAPI_HOSPITALITY': {
      const row = HOSPITALITY_CAPABILITIES.find((c) => c.code === code);
      return !row || row.status === 'PLANNED';
    }
    default:
      return true;
  }
}

function capabilityCatalogHasCode(productFamily: string, code: string): boolean {
  if (QUOTA_CAPABILITY_CODES.has(code)) {
    switch (productFamily) {
      case 'SYNTIX_PHARMA':
        return SYNTIX_CAPABILITIES.some((c) => c.code === code);
      case 'OKAPI_RESTAURANT':
        return RESTAURANT_CAPABILITIES.some((c) => c.code === code);
      case 'OKAPI_RETAIL':
        return RETAIL_CAPABILITIES.some((c) => c.code === code);
      case 'OKAPI_HOSPITALITY':
        return HOSPITALITY_CAPABILITIES.some((c) => c.code === code);
      default:
        return false;
    }
  }
  return !capabilityCatalogIsPlanned(productFamily, code);
}

/** Machine-readable plan → commercial cap codes (Pharma / Restaurant / Retail / Hospitality). */
export function commercialPlanCapabilityMatrix(): readonly CommercialPlanCapabilityRow[] {
  const planCodes = [
    ...SYNTIX_PLANS.map((p) => p.code),
    ...RESTAURANT_PLANS.map((p) => p.code),
    ...RETAIL_PLANS.map((p) => p.code),
    ...HOSPITALITY_PLANS.map((p) => p.code),
  ];
  const rows: CommercialPlanCapabilityRow[] = [];
  for (const planCode of planCodes) {
    const snap = commercialPlanEntitlementSnapshot(planCode);
    if (!snap?.profileCode) continue;
    const { modules, quotas } = splitModuleAndQuotaCodes(snap.capabilities);
    rows.push({
      planCode: snap.planCode,
      productFamily: snap.productFamily,
      productCode: snap.productCode,
      profileCode: snap.profileCode,
      moduleCapabilityCodes: modules,
      quotaCapabilityCodes: quotas,
      roadmapStatus: snap.roadmapStatus,
      sellable: snap.sellable,
    });
  }
  return Object.freeze(rows);
}

/** Fail-closed alignment: plan module caps must exist in family `capability_definitions` seeds. */
export function assertPlanCapsAlignCapabilityCatalog(planCode: string): void {
  const snap = commercialPlanEntitlementSnapshot(planCode);
  if (!snap) {
    throw new Error(`COMMERCIAL_CAP_UNKNOWN_PLAN: ${planCode}`);
  }
  const family = productFamilyForProfileCode(snap.profileCode);
  if (family !== snap.productFamily) {
    throw new Error(
      `PROFILE_FAMILY_MISMATCH: ${snap.profileCode} → ${family}, expected ${snap.productFamily}`,
    );
  }
  const catalogFamily = snap.productFamily;
  const { modules, quotas } = splitModuleAndQuotaCodes(snap.capabilities);
  for (const code of modules) {
    if (!capabilityCatalogHasCode(catalogFamily, code)) {
      throw new Error(
        `COMMERCIAL_CAP_ORPHAN: plan ${planCode} references ${code} missing or PLANNED in ${catalogFamily} catalog`,
      );
    }
  }
  for (const code of quotas) {
    if (!capabilityCatalogHasCode(catalogFamily, code)) {
      throw new Error(
        `COMMERCIAL_QUOTA_ORPHAN: plan ${planCode} references quota ${code} outside ${catalogFamily} catalog`,
      );
    }
  }
}

function stubSources(
  planCode: string,
  caps: readonly string[],
  quotas: Record<string, number>,
): EntitlementSource[] {
  const sources: EntitlementSource[] = caps.map((capabilityCode) => ({
    sourceType: 'PLAN',
    sourceRef: planCode,
    capabilityCode,
    kind: EntitlementCapabilityKind.FEATURE_FLAG,
    enabled: true,
  }));
  for (const [capabilityCode, numericLimit] of Object.entries(quotas)) {
    sources.push({
      sourceType: 'PLAN',
      sourceRef: planCode,
      capabilityCode,
      kind: EntitlementCapabilityKind.QUOTA,
      enabled: true,
      numericLimit,
    });
  }
  return sources;
}

export function commercialPlanEntitlementSnapshot(
  planCode: string | null | undefined,
): CommercialPlanEntitlementSnapshot | null {
  const beachhead = beachheadPlanEntitlementSnapshot(planCode);
  if (beachhead) {
    const productCode =
      beachhead.productFamily === 'SYNTIX_PHARMA' ? 'SYNTIX_PHARMA' : 'OKAPI_RESTAURANT';
    return {
      planCode: beachhead.planCode,
      productFamily: beachhead.productFamily,
      productCode,
      profileCode:
        defaultProfileForProductCode(productCode) ??
        beachheadProfileCodeForFamily(beachhead.productFamily),
      capabilities: beachhead.capabilities,
      roadmapStatus: 'BEACHHEAD',
      sellable: true,
    };
  }

  const code = planCode?.trim();
  if (!code) return null;

  const retail = RETAIL_PLANS.find((p) => p.code === code);
  if (retail) {
    return {
      planCode: retail.code,
      productFamily: 'OKAPI_RETAIL',
      productCode: 'OKAPI_RETAIL',
      profileCode: retail.bbProfileCode,
      capabilities: stubSources(retail.code, retail.caps, retail.quotas),
      roadmapStatus: 'PLANNED_STUB',
      sellable: false,
    };
  }

  const hosp = HOSPITALITY_PLANS.find((p) => p.code === code);
  if (hosp) {
    return {
      planCode: hosp.code,
      productFamily: 'OKAPI_HOSPITALITY',
      productCode: 'OKAPI_HOSPITALITY',
      profileCode: hosp.bbProfileCode,
      capabilities: stubSources(hosp.code, hosp.caps, hosp.quotas),
      roadmapStatus: 'PLANNED_STUB',
      sellable: false,
    };
  }

  return null;
}

export function entitlementSourcesForCommercialPlan(planCode: string): EntitlementSource[] {
  const snap = commercialPlanEntitlementSnapshot(planCode);
  if (snap) return snap.capabilities;
  return entitlementSourcesForBeachheadPlan(planCode);
}

export function extractCommercialPlanCode(
  ...blobs: Array<Record<string, unknown> | null | undefined>
): string | null {
  const beachhead = extractBeachheadPlanCode(...blobs);
  if (beachhead) return beachhead;
  for (const blob of blobs) {
    if (!blob) continue;
    for (const key of ['planCode', 'plan_code', 'offerRef', 'commercialPlanCode'] as const) {
      const v = blob[key];
      if (typeof v === 'string' && v.trim() && commercialPlanEntitlementSnapshot(v.trim())) {
        return v.trim();
      }
    }
  }
  return null;
}

/** Fail-closed: roadmap stubs must not be sold publicly. */
export function assertCommercialPlanSellableOrThrow(planCode: string): void {
  const snap = commercialPlanEntitlementSnapshot(planCode);
  if (!snap) {
    throw new Error(`PRODUCT_NOT_SELLABLE: unknown plan ${planCode}`);
  }
  if (!snap.sellable) {
    throw new Error(
      `PRODUCT_NOT_SELLABLE: ${planCode} is ${snap.roadmapStatus} (INTERNAL_ONLY until G11 PASS, doc 39).`,
    );
  }
}

export function profileCodeForProductOrFamily(
  productOrFamily: string | null | undefined,
): string | null {
  return (
    defaultProfileForProductCode(productOrFamily) ??
    beachheadProfileCodeForFamily(productOrFamily)
  );
}
