/**
 * Okapi Hospitality commercial catalog (doc 39 Phase D).
 * INTERNAL_ONLY until G11 PASS — no invented prices, not public AVAILABLE.
 */

export const HOSPITALITY_PRODUCT_CODE = 'OKAPI_HOSPITALITY';
export const HOSPITALITY_VERTICAL_CODE = 'HOSPITALITY';

export const HOSPITALITY_SEGMENTS = [
  { code: 'HOSP_INDEPENDENT_HOTEL', name: 'Independent hotel' },
  { code: 'HOSP_BOUTIQUE', name: 'Boutique hotel' },
  { code: 'HOSP_CHAIN', name: 'Hotel chain / multi-property' },
] as const;

export const HOSPITALITY_ICPS = [
  {
    code: 'ICP_HOSP_INDEPENDENT',
    name: 'Independent hotel operator',
    segmentCode: 'HOSP_INDEPENDENT_HOTEL',
    scorecard: { rooms: '20-80', pms: 'required', frontDesk: 'required' },
  },
  {
    code: 'ICP_HOSP_CHAIN',
    name: 'Multi-property hospitality group',
    segmentCode: 'HOSP_CHAIN',
    scorecard: { properties: '2-20', centralRates: 'optional' },
  },
] as const;

export const HOSPITALITY_CAPABILITIES = [
  { code: 'identity', name: 'Identity & access', category: 'PLATFORM', status: 'AVAILABLE' as const },
  { code: 'hospitality', name: 'Hospitality / PMS', category: 'HOSPITALITY', status: 'AVAILABLE' as const },
  { code: 'front_desk', name: 'Front desk', category: 'HOSPITALITY', status: 'AVAILABLE' as const },
  { code: 'housekeeping', name: 'Housekeeping', category: 'HOSPITALITY', status: 'AVAILABLE' as const },
  { code: 'reporting', name: 'Operational reporting', category: 'ANALYTICS', status: 'AVAILABLE' as const },
  { code: 'api', name: 'API access', category: 'INTEGRATION', status: 'AVAILABLE' as const },
  { code: 'analytics', name: 'Advanced analytics', category: 'ANALYTICS', status: 'LIMITED' as const },
  { code: 'sso', name: 'SSO / IAM enterprise', category: 'SECURITY', status: 'AVAILABLE' as const },
  { code: 'max_organizations', name: 'Max properties', category: 'QUOTA', status: 'AVAILABLE' as const },
  { code: 'max_users', name: 'Max users', category: 'QUOTA', status: 'AVAILABLE' as const },
  { code: 'max_customers', name: 'Max guests / customers', category: 'QUOTA', status: 'PLANNED' as const },
  { code: 'max_products', name: 'Max products / services', category: 'QUOTA', status: 'PLANNED' as const },
] as const;

export const HOSPITALITY_PACKAGES = [
  { code: 'PKG_HOSP_HOTEL', name: 'Hotel Hospitality Package' },
  { code: 'PKG_HOSP_CHAIN', name: 'Hospitality Chain Package' },
] as const;

export const HOSPITALITY_PLANS = [
  {
    code: 'OKAPI_HOSP_LITE',
    name: 'Okapi Hospitality Lite',
    tier: 'LITE' as const,
    packageCode: 'PKG_HOSP_HOTEL',
    commercialAvailability: 'INTERNAL_ONLY' as const,
    bbProfileCode: 'HOTEL_HOSPITALITY',
    caps: ['identity', 'hospitality', 'front_desk'] as const,
    quotas: { max_organizations: 1, max_users: 15, max_customers: 3000, max_products: 500 },
  },
  {
    code: 'OKAPI_HOSP_PROFESSIONAL',
    name: 'Okapi Hospitality Professional',
    tier: 'PROFESSIONAL' as const,
    packageCode: 'PKG_HOSP_HOTEL',
    commercialAvailability: 'INTERNAL_ONLY' as const,
    bbProfileCode: 'HOTEL_HOSPITALITY',
    caps: ['identity', 'hospitality', 'front_desk', 'housekeeping', 'reporting'] as const,
    quotas: { max_organizations: 1, max_users: 40, max_customers: 15000, max_products: 2000 },
  },
  {
    code: 'OKAPI_HOSP_BUSINESS',
    name: 'Okapi Hospitality Business',
    tier: 'BUSINESS' as const,
    packageCode: 'PKG_HOSP_CHAIN',
    commercialAvailability: 'INTERNAL_ONLY' as const,
    bbProfileCode: 'HOTEL_HOSPITALITY',
    caps: [
      'identity',
      'hospitality',
      'front_desk',
      'housekeeping',
      'reporting',
      'api',
    ] as const,
    quotas: { max_organizations: 10, max_users: 120, max_customers: 75000, max_products: 5000 },
  },
  {
    code: 'OKAPI_HOSP_ENTERPRISE',
    name: 'Okapi Hospitality Enterprise',
    tier: 'ENTERPRISE' as const,
    packageCode: 'PKG_HOSP_CHAIN',
    commercialAvailability: 'INTERNAL_ONLY' as const,
    bbProfileCode: 'HOTEL_HOSPITALITY',
    caps: [
      'identity',
      'hospitality',
      'front_desk',
      'housekeeping',
      'reporting',
      'api',
      'analytics',
      'sso',
    ] as const,
    quotas: { max_organizations: 50, max_users: 500, max_customers: 250000, max_products: 20000 },
  },
] as const;

export const HOSPITALITY_ROADMAP_NOTE =
  'G11 PARTIAL — catalog seeded INTERNAL_ONLY; AVAILABLE only after e2e bb_control + marketing + Legal (doc 39 Phase D)';

/**
 * Contrat honnête : aucune cap FEATURE PLANNED dans le stub hospitality.
 * Seuls des quotas roadmap (max_customers / max_products, catégorie QUOTA)
 * peuvent encore être PLANNED tant que INTERNAL_ONLY.
 */
export function hospitalityPlannedCapsAreQuotaOnly(): boolean {
  return HOSPITALITY_CAPABILITIES.filter((c) => String(c.status) === 'PLANNED').every(
    (c) => c.category === 'QUOTA',
  );
}
