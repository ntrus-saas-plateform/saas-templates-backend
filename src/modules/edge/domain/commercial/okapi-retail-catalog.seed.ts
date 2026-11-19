/**
 * Okapi Retail commercial catalog (doc 39 Phase C).
 * INTERNAL_ONLY until G11 PASS — no invented prices, not public AVAILABLE.
 */

export const RETAIL_PRODUCT_CODE = 'OKAPI_RETAIL';
export const RETAIL_VERTICAL_CODE = 'RETAIL';

export const RETAIL_SEGMENTS = [
  { code: 'RETAIL_SUPERMARKET', name: 'Supermarket / hypermarket' },
  { code: 'RETAIL_GROCERY', name: 'Grocery / convenience' },
  { code: 'RETAIL_SPECIALTY', name: 'Specialty retail chain' },
] as const;

export const RETAIL_ICPS = [
  {
    code: 'ICP_RETAIL_SUPERMARKET',
    name: 'Independent supermarket',
    segmentCode: 'RETAIL_SUPERMARKET',
    scorecard: { stores: '1-5', pos: 'required', inventory: 'required' },
  },
  {
    code: 'ICP_RETAIL_GROCERY',
    name: 'Grocery / convenience operator',
    segmentCode: 'RETAIL_GROCERY',
    scorecard: { stores: '1-10', pos: 'required' },
  },
] as const;

export const RETAIL_CAPABILITIES = [
  { code: 'identity', name: 'Identity & access', category: 'PLATFORM', status: 'AVAILABLE' as const },
  { code: 'retail', name: 'Retail operations', category: 'RETAIL', status: 'AVAILABLE' as const },
  { code: 'grocery', name: 'Grocery', category: 'RETAIL', status: 'AVAILABLE' as const },
  { code: 'inventory', name: 'Inventory engine', category: 'INVENTORY', status: 'AVAILABLE' as const },
  { code: 'pos', name: 'Point of sale', category: 'SALES', status: 'AVAILABLE' as const },
  { code: 'purchasing', name: 'Purchasing', category: 'PROCUREMENT', status: 'AVAILABLE' as const },
  { code: 'reporting', name: 'Operational reporting', category: 'ANALYTICS', status: 'AVAILABLE' as const },
  { code: 'api', name: 'API access', category: 'INTEGRATION', status: 'AVAILABLE' as const },
  { code: 'analytics', name: 'Advanced analytics', category: 'ANALYTICS', status: 'LIMITED' as const },
  { code: 'sso', name: 'SSO / IAM enterprise', category: 'SECURITY', status: 'AVAILABLE' as const },
  { code: 'max_organizations', name: 'Max stores', category: 'QUOTA', status: 'AVAILABLE' as const },
  { code: 'max_users', name: 'Max users', category: 'QUOTA', status: 'AVAILABLE' as const },
  { code: 'max_pos_terminals', name: 'Max POS terminals', category: 'QUOTA', status: 'AVAILABLE' as const },
  { code: 'max_customers', name: 'Max customers', category: 'QUOTA', status: 'PLANNED' as const },
  { code: 'max_products', name: 'Max products', category: 'QUOTA', status: 'PLANNED' as const },
] as const;

export const RETAIL_PACKAGES = [
  { code: 'PKG_RETAIL_SUPERMARKET', name: 'Supermarket Package' },
  { code: 'PKG_RETAIL_GROCERY', name: 'Grocery Package' },
  { code: 'PKG_RETAIL_CHAIN', name: 'Retail Chain Package' },
] as const;

/** Full Lite→Enterprise — sellable=false until G11. */
export const RETAIL_PLANS = [
  {
    code: 'OKAPI_RETAIL_LITE',
    name: 'Okapi Retail Lite',
    tier: 'LITE' as const,
    packageCode: 'PKG_RETAIL_SUPERMARKET',
    commercialAvailability: 'INTERNAL_ONLY' as const,
    bbProfileCode: 'SUPERMARKET',
    caps: ['identity', 'retail', 'inventory', 'pos'] as const,
    quotas: {
      max_organizations: 1,
      max_users: 10,
      max_pos_terminals: 4,
      max_customers: 2000,
      max_products: 5000,
    },
  },
  {
    code: 'OKAPI_RETAIL_PROFESSIONAL',
    name: 'Okapi Retail Professional',
    tier: 'PROFESSIONAL' as const,
    packageCode: 'PKG_RETAIL_SUPERMARKET',
    commercialAvailability: 'INTERNAL_ONLY' as const,
    bbProfileCode: 'SUPERMARKET',
    caps: ['identity', 'retail', 'grocery', 'inventory', 'pos', 'purchasing', 'reporting'] as const,
    quotas: {
      max_organizations: 3,
      max_users: 40,
      max_pos_terminals: 12,
      max_customers: 15000,
      max_products: 25000,
    },
  },
  {
    code: 'OKAPI_RETAIL_BUSINESS',
    name: 'Okapi Retail Business',
    tier: 'BUSINESS' as const,
    packageCode: 'PKG_RETAIL_CHAIN',
    commercialAvailability: 'INTERNAL_ONLY' as const,
    bbProfileCode: 'SUPERMARKET',
    caps: [
      'identity',
      'retail',
      'grocery',
      'inventory',
      'pos',
      'purchasing',
      'reporting',
      'api',
    ] as const,
    quotas: {
      max_organizations: 15,
      max_users: 150,
      max_pos_terminals: 40,
      max_customers: 75000,
      max_products: 100000,
    },
  },
  {
    code: 'OKAPI_RETAIL_ENTERPRISE',
    name: 'Okapi Retail Enterprise',
    tier: 'ENTERPRISE' as const,
    packageCode: 'PKG_RETAIL_CHAIN',
    commercialAvailability: 'INTERNAL_ONLY' as const,
    bbProfileCode: 'SUPERMARKET',
    caps: [
      'identity',
      'retail',
      'grocery',
      'inventory',
      'pos',
      'purchasing',
      'reporting',
      'api',
      'analytics',
      'sso',
    ] as const,
    quotas: {
      max_organizations: 100,
      max_users: 1000,
      max_pos_terminals: 200,
      max_customers: 500000,
      max_products: 500000,
    },
  },
] as const;

export const RETAIL_ROADMAP_NOTE =
  'G11 PARTIAL — catalog seeded INTERNAL_ONLY; AVAILABLE only after e2e bb_control + marketing + Legal (doc 39 Phase C)';

/**
 * Contrat honnête : aucune cap FEATURE PLANNED dans le stub retail.
 * Seuls des quotas roadmap (max_customers / max_products, catégorie QUOTA)
 * peuvent encore être PLANNED tant que INTERNAL_ONLY.
 */
export function retailPlannedCapsAreQuotaOnly(): boolean {
  return RETAIL_CAPABILITIES.filter((c) => String(c.status) === 'PLANNED').every(
    (c) => c.category === 'QUOTA',
  );
}
