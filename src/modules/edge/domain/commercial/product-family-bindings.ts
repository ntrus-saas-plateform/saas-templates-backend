/**
 * ADR-021 / ADR-055 — Edge product code ↔ BB product family ↔ default profile.
 * Source for provision payload.profile_code and EDGE_PRODUCT_PROFILE_BINDINGS_JSON.
 */

export type EdgeProductFamily =
  | 'SYNTIX_PHARMA'
  | 'OKAPI_RESTAURANT'
  | 'OKAPI_RETAIL'
  | 'OKAPI_HOSPITALITY'
  | 'OKAPI_OTHER';

export type ProductFamilyBinding = {
  readonly productCode: string;
  readonly productFamily: EdgeProductFamily;
  readonly defaultProfileCode: string;
  readonly profiles: readonly string[];
  readonly roadmapStatus: 'BEACHHEAD_AVAILABLE' | 'PLANNED' | 'CONTROLLED' | 'BLOCKED';
  readonly commercialAvailability: 'AVAILABLE' | 'INTERNAL_ONLY' | 'CONTROLLED_ROLLOUT' | 'UNAVAILABLE';
};

export const EDGE_PRODUCT_FAMILY_BINDINGS: readonly ProductFamilyBinding[] = Object.freeze([
  {
    productCode: 'SYNTIX_PHARMA',
    productFamily: 'SYNTIX_PHARMA',
    defaultProfileCode: 'PHARMACY',
    profiles: ['PHARMACY', 'WHOLESALE', 'DISTRIBUTION'],
    roadmapStatus: 'BEACHHEAD_AVAILABLE',
    commercialAvailability: 'AVAILABLE',
  },
  {
    productCode: 'OKAPI_RESTAURANT',
    productFamily: 'OKAPI_RESTAURANT',
    defaultProfileCode: 'RESTAURANT',
    profiles: ['RESTAURANT', 'CAFE'],
    roadmapStatus: 'BEACHHEAD_AVAILABLE',
    commercialAvailability: 'AVAILABLE',
  },
  {
    productCode: 'OKAPI_RETAIL',
    productFamily: 'OKAPI_RETAIL',
    defaultProfileCode: 'SUPERMARKET',
    profiles: [
      'SUPERMARKET',
      'GROCERY',
      'FOOD_RETAIL',
      'BOUTIQUE',
      'ELECTRONICS_RETAIL',
      'HARDWARE_BUILDING_SUPPLIES',
      'AUTO_PARTS',
      'OPTICAL_RETAIL',
      'JEWELRY_RETAIL',
      'TEXTILE_FABRIC_RETAIL',
    ],
    roadmapStatus: 'PLANNED',
    commercialAvailability: 'INTERNAL_ONLY',
  },
  {
    productCode: 'OKAPI_HOSPITALITY',
    productFamily: 'OKAPI_HOSPITALITY',
    defaultProfileCode: 'HOTEL_HOSPITALITY',
    profiles: ['HOTEL_HOSPITALITY'],
    roadmapStatus: 'PLANNED',
    commercialAvailability: 'INTERNAL_ONLY',
  },
  {
    productCode: 'OKAPI_MANUFACTURING',
    productFamily: 'OKAPI_OTHER',
    defaultProfileCode: 'MANUFACTURING',
    profiles: ['MANUFACTURING'],
    roadmapStatus: 'PLANNED',
    commercialAvailability: 'INTERNAL_ONLY',
  },
  {
    productCode: 'OKAPI_EQUIPMENT_RENTAL',
    productFamily: 'OKAPI_OTHER',
    defaultProfileCode: 'EQUIPMENT_RENTAL',
    profiles: ['EQUIPMENT_RENTAL'],
    roadmapStatus: 'PLANNED',
    commercialAvailability: 'INTERNAL_ONLY',
  },
]);

export function bindingForProductCode(productCode: string | null | undefined): ProductFamilyBinding | null {
  const code = productCode?.trim().toUpperCase();
  if (!code) return null;
  return (
    EDGE_PRODUCT_FAMILY_BINDINGS.find((b) => b.productCode.toUpperCase() === code) ?? null
  );
}

export function defaultProfileForProductCode(productCode: string | null | undefined): string | null {
  return bindingForProductCode(productCode)?.defaultProfileCode ?? null;
}

/** JSON for BB env EDGE_PRODUCT_PROFILE_BINDINGS_JSON */
export function toBbProductProfileBindingsJson(
  bindings: readonly ProductFamilyBinding[] = EDGE_PRODUCT_FAMILY_BINDINGS,
): string {
  return JSON.stringify(
    bindings.map((b) => ({
      productCode: b.productCode,
      profileCode: b.defaultProfileCode,
      platformId: b.productFamily,
    })),
  );
}

export function assertSellableOrThrow(binding: ProductFamilyBinding): void {
  if (binding.commercialAvailability === 'AVAILABLE') return;
  if (binding.commercialAvailability === 'CONTROLLED_ROLLOUT') return;
  throw new Error(
    `PRODUCT_NOT_SELLABLE: ${binding.productCode} is ${binding.commercialAvailability} (roadmap=${binding.roadmapStatus}). G11 required (doc 39).`,
  );
}
