/**
 * RGOM E1/E2 — Okapi Restaurant beachhead commercial catalog.
 * Distinct from Pharma — no copied plan contents. No invented prices.
 */

export const RESTAURANT_PRODUCT_CODE = 'OKAPI_RESTAURANT';
export const RESTAURANT_VERTICAL_CODE = 'RESTAURANT';

export const RESTAURANT_SEGMENTS = [
  { code: 'REST_INDEPENDENT', name: 'Independent restaurant' },
  { code: 'REST_MULTI_SITE', name: 'Multi-site restaurant group' },
  { code: 'REST_QSR', name: 'Quick service restaurant (QSR)' },
  { code: 'REST_CLOUD_KITCHEN', name: 'Cloud / ghost kitchen' },
] as const;

export const RESTAURANT_PROFILES = [
  {
    code: 'INDEPENDENT_RESTAURANT',
    name: 'Independent restaurant',
    segmentCode: 'REST_INDEPENDENT',
  },
  {
    code: 'MULTI_SITE_RESTAURANT',
    name: 'Multi-site restaurant group',
    segmentCode: 'REST_MULTI_SITE',
  },
  {
    code: 'QSR_RESTAURANT',
    name: 'QSR restaurant',
    segmentCode: 'REST_QSR',
  },
] as const;

export const RESTAURANT_ICPS = [
  {
    code: 'ICP_REST_INDEPENDENT',
    name: 'Independent F&B operator',
    segmentCode: 'REST_INDEPENDENT',
    scorecard: { sites: '1', seats: '20-80', pos: 'required' },
  },
  {
    code: 'ICP_REST_MULTI_SITE',
    name: 'Multi-site F&B group',
    segmentCode: 'REST_MULTI_SITE',
    scorecard: { sites: '2-15', centralKitchen: 'optional', pos: 'required' },
  },
  {
    code: 'ICP_REST_QSR',
    name: 'QSR / fast casual',
    segmentCode: 'REST_QSR',
    scorecard: { throughput: 'high', delivery: 'common' },
  },
] as const;

export const RESTAURANT_CAPABILITIES = [
  { code: 'identity', name: 'Identity & access', category: 'PLATFORM', status: 'AVAILABLE' as const },
  { code: 'restaurant', name: 'Restaurant core', category: 'RESTAURANT', status: 'AVAILABLE' as const },
  { code: 'menu', name: 'Menu management', category: 'RESTAURANT', status: 'AVAILABLE' as const },
  { code: 'pos', name: 'Point of sale', category: 'SALES', status: 'AVAILABLE' as const },
  { code: 'inventory', name: 'Inventory engine', category: 'INVENTORY', status: 'AVAILABLE' as const },
  { code: 'kitchen', name: 'Kitchen display / tickets', category: 'RESTAURANT', status: 'AVAILABLE' as const },
  { code: 'tables', name: 'Table / floor management', category: 'RESTAURANT', status: 'AVAILABLE' as const },
  { code: 'delivery', name: 'Delivery / takeaway', category: 'CHANNEL', status: 'AVAILABLE' as const },
  { code: 'reporting', name: 'Operational reporting', category: 'ANALYTICS', status: 'AVAILABLE' as const },
  { code: 'api', name: 'API access', category: 'INTEGRATION', status: 'AVAILABLE' as const },
  { code: 'analytics', name: 'Advanced analytics', category: 'ANALYTICS', status: 'LIMITED' as const },
  { code: 'sso', name: 'SSO / IAM enterprise', category: 'SECURITY', status: 'AVAILABLE' as const },
  { code: 'max_organizations', name: 'Max sites (organizations)', category: 'QUOTA', status: 'AVAILABLE' as const },
  { code: 'max_users', name: 'Max users', category: 'QUOTA', status: 'AVAILABLE' as const },
  { code: 'max_pos_terminals', name: 'Max POS terminals', category: 'QUOTA', status: 'AVAILABLE' as const },
  { code: 'max_customers', name: 'Max customers', category: 'QUOTA', status: 'AVAILABLE' as const },
  { code: 'max_products', name: 'Max products / menu items', category: 'QUOTA', status: 'AVAILABLE' as const },
] as const;

export const RESTAURANT_PACKAGES = [
  { code: 'PKG_REST_INDEPENDENT', name: 'Independent Restaurant Package' },
  { code: 'PKG_REST_MULTI_SITE', name: 'Multi-site Restaurant Package' },
  { code: 'PKG_REST_QSR', name: 'QSR Restaurant Package' },
] as const;

/** Distinct restaurant plan tiers — not Pharma copies. */
export const RESTAURANT_PLANS = [
  {
    code: 'OKAPI_REST_STARTER',
    name: 'Okapi Restaurant Starter',
    tier: 'LITE',
    packageCode: 'PKG_REST_INDEPENDENT',
    caps: ['identity', 'restaurant', 'menu', 'pos', 'tables'],
    quotas: {
      max_organizations: 1,
      max_users: 8,
      max_pos_terminals: 2,
      max_customers: 2000,
      max_products: 500,
    },
  },
  {
    code: 'OKAPI_REST_GROWTH',
    name: 'Okapi Restaurant Growth',
    tier: 'PROFESSIONAL',
    packageCode: 'PKG_REST_INDEPENDENT',
    caps: ['identity', 'restaurant', 'menu', 'pos', 'tables', 'inventory', 'kitchen', 'reporting'],
    quotas: {
      max_organizations: 1,
      max_users: 25,
      max_pos_terminals: 5,
      max_customers: 10000,
      max_products: 2000,
    },
  },
  {
    code: 'OKAPI_REST_MULTI',
    name: 'Okapi Restaurant Multi-site',
    tier: 'BUSINESS',
    packageCode: 'PKG_REST_MULTI_SITE',
    caps: [
      'identity',
      'restaurant',
      'menu',
      'pos',
      'tables',
      'inventory',
      'kitchen',
      'delivery',
      'reporting',
      'api',
    ],
    quotas: {
      max_organizations: 10,
      max_users: 80,
      max_pos_terminals: 20,
      max_customers: 50000,
      max_products: 5000,
    },
  },
  {
    code: 'OKAPI_REST_ENTERPRISE',
    name: 'Okapi Restaurant Enterprise',
    tier: 'ENTERPRISE',
    packageCode: 'PKG_REST_QSR',
    caps: [
      'identity',
      'restaurant',
      'menu',
      'pos',
      'tables',
      'inventory',
      'kitchen',
      'delivery',
      'reporting',
      'api',
      'analytics',
      'sso',
    ],
    quotas: {
      max_organizations: 50,
      max_users: 500,
      max_pos_terminals: 100,
      max_customers: 200000,
      max_products: 20000,
    },
  },
] as const;

export function restaurantPlanHasNoPlannedCaps(): boolean {
  return RESTAURANT_CAPABILITIES.every((c) => String(c.status) !== 'PLANNED');
}

/**
 * CAFE pack under OKAPI_RESTAURANT (ADR-021 same Product Tenant).
 * commercialAvailability CONTROLLED — not a separate Product Tenant.
 * No invented prices.
 */
export const RESTAURANT_CAFE_CONTROLLED_PACK = {
  code: 'PKG_REST_CAFE_CONTROLLED',
  name: 'Cafe Controlled Pack (under Okapi Restaurant)',
  bbProfileCode: 'CAFE',
  commercialAvailability: 'CONTROLLED_ROLLOUT' as const,
  caps: ['identity', 'restaurant', 'menu', 'pos', 'inventory', 'kitchen', 'reporting'] as const,
  quotas: {
    max_organizations: 1,
    max_users: 15,
    max_pos_terminals: 4,
    max_customers: 5000,
    max_products: 800,
  },
  note: 'G11 Controlled rollout — same tenant family OKAPI_RESTAURANT (doc 39 Phase B)',
} as const;

/**
 * Plan Café contrôlé — même mécanisme d’attach que les autres plans (pas de chemin spécial).
 * DRAFT / CONTROLLED_ROLLOUT — pas AVAILABLE, pas de prix inventés.
 */
export const RESTAURANT_CAFE_CONTROLLED_PLAN = {
  code: 'OKAPI_REST_CAFE_CONTROLLED',
  name: 'Okapi Cafe Controlled',
  tier: 'LITE' as const,
  packageCode: RESTAURANT_CAFE_CONTROLLED_PACK.code,
  bbProfileCode: RESTAURANT_CAFE_CONTROLLED_PACK.bbProfileCode,
  commercialAvailability: RESTAURANT_CAFE_CONTROLLED_PACK.commercialAvailability,
  caps: RESTAURANT_CAFE_CONTROLLED_PACK.caps,
  quotas: RESTAURANT_CAFE_CONTROLLED_PACK.quotas,
  note: RESTAURANT_CAFE_CONTROLLED_PACK.note,
} as const;
