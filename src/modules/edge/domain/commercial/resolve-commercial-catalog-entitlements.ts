/**
 * Résolution universelle catalogue → EntitlementSource[].
 * Tous les verticaux (Pharmacy, Restaurant, Café, Retail, Hospitality, futurs)
 * passent par ce helper — seule la config plan/package diffère.
 */

import { EntitlementCapabilityKind, type EntitlementSource } from '../subscription/subscription.entity.js';
import {
  commercialPackageEntitlementSnapshot,
  commercialPlanEntitlementSnapshot,
  extractCommercialPlanCode,
} from './commercial-plan-entitlements.js';

export { extractCommercialPlanCode };

export type ResolveCommercialCatalogInput = {
  planCode?: string | null;
  packageCode?: string | null;
};

/**
 * Construit EntitlementSource[] depuis planCode et/ou packageCode.
 * Priorité plan ; sinon package (ex. PKG_REST_CAFE_CONTROLLED).
 * Attache les caps même pour INTERNAL_ONLY / CONTROLLED — ne revendique pas AVAILABLE.
 */
export function resolveCommercialCatalogEntitlements(
  input: ResolveCommercialCatalogInput,
): EntitlementSource[] {
  const planCode = input.planCode?.trim() || null;
  if (planCode) {
    const planSnap = commercialPlanEntitlementSnapshot(planCode);
    if (planSnap) return planSnap.capabilities;
  }

  const packageCode = input.packageCode?.trim() || null;
  if (packageCode) {
    const pkgSnap = commercialPackageEntitlementSnapshot(packageCode);
    if (pkgSnap) return pkgSnap.capabilities;
  }

  return [];
}

/** Ligne caps SQL (`edge_commercial_plan_capabilities` / `edge_solution_package_capabilities`). */
export type SqlCapabilityEntitlementRow = {
  readonly capabilityCode: string;
  readonly inclusionType: string;
  readonly restrictions: Record<string, unknown>;
};

const QUOTA_CODES = new Set([
  'max_organizations',
  'max_users',
  'max_warehouses',
  'max_pos_terminals',
  'max_customers',
  'max_products',
]);

function readNumericLimit(restrictions: Record<string, unknown> | null | undefined): number | null {
  if (!restrictions) return null;
  const raw = restrictions.numericLimit;
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return Math.floor(raw);
  if (typeof raw === 'string' && /^\d+$/.test(raw.trim()) && Number(raw) > 0) {
    return Number(raw);
  }
  return null;
}

/**
 * Overlay config SQL (gestion console / migs) sur caps résolues TS.
 * Mêmes règles toutes familles :
 * - `NOT_INCLUDED` SQL → retire la source TS ;
 * - quota avec `restrictions.numericLimit` → impose/ajoute la limite SQL ;
 * - cap feature SQL absente du TS → ajoutée ;
 * - quota SQL sans numericLimit → conserve la valeur TS (SQL incomplet ≠ 0).
 * Retourne `base` inchangé si aucune ligne SQL.
 */
export function mergeSqlCapabilityRowsIntoCatalogCapabilities(
  base: readonly EntitlementSource[],
  rows: readonly SqlCapabilityEntitlementRow[],
): EntitlementSource[] {
  if (!rows || rows.length === 0) return [...base];

  const byCode = new Map<string, EntitlementSource>();
  for (const src of base) {
    const code = src.capabilityCode?.trim();
    if (code && !byCode.has(code)) byCode.set(code, src);
  }

  for (const row of rows) {
    const code = row.capabilityCode?.trim();
    if (!code) continue;

    if (row.inclusionType === 'NOT_INCLUDED') {
      byCode.delete(code);
      continue;
    }

    const numericLimit = readNumericLimit(row.restrictions);
    if (numericLimit != null) {
      const existing = byCode.get(code);
      byCode.set(code, {
        sourceType: 'PLAN',
        sourceRef: code,
        capabilityCode: code,
        kind:
          existing?.kind ??
          (QUOTA_CODES.has(code)
            ? EntitlementCapabilityKind.QUOTA
            : EntitlementCapabilityKind.FEATURE_FLAG),
        enabled: true,
        numericLimit,
      });
      continue;
    }

    if (!byCode.has(code)) {
      byCode.set(code, {
        sourceType: 'PLAN',
        sourceRef: code,
        capabilityCode: code,
        kind: QUOTA_CODES.has(code)
          ? EntitlementCapabilityKind.QUOTA
          : EntitlementCapabilityKind.FEATURE_FLAG,
        enabled: true,
      });
    }
  }

  return [...byCode.values()];
}
