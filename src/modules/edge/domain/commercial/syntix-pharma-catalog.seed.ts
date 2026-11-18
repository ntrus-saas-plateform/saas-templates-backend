/**
 * RGOM E1/E2 — Syntix Pharma beachhead commercial catalog (content, not invented prices).
 * Used by unit tests + seed script/migration for plans/packages/capabilities.
 */

import { EntitlementCapabilityKind, type EntitlementSource } from '../subscription/subscription.entity.js';

export const SYNTIX_PRODUCT_CODE = 'SYNTIX_PHARMA';
export const SYNTIX_VERTICAL_CODE = 'PHARMACY';

export type SeedCapabilityDef = {
  readonly code: string;
  readonly name: string;
  readonly category: string;
  readonly technicalStatus: 'AVAILABLE' | 'LIMITED' | 'PLANNED';
  readonly commercialAvailability: 'AVAILABLE' | 'LIMITED' | 'UNAVAILABLE';
  readonly entitlementKind: EntitlementCapabilityKind;
  readonly defaultEnabled?: boolean;
  readonly defaultLimit?: number | null;
};

/** Technical capabilities commercially seedable for Syntix beachhead. */
export const SYNTIX_CAPABILITIES: readonly SeedCapabilityDef[] = [
  {
    code: 'identity',
    name: 'Identity & access',
    category: 'PLATFORM',
    technicalStatus: 'AVAILABLE',
    commercialAvailability: 'AVAILABLE',
    entitlementKind: EntitlementCapabilityKind.FEATURE_FLAG,
    defaultEnabled: true,
  },
  {
    code: 'pharmacy',
    name: 'Pharmacy core',
    category: 'PHARMACY',
    technicalStatus: 'AVAILABLE',
    commercialAvailability: 'AVAILABLE',
    entitlementKind: EntitlementCapabilityKind.FEATURE_FLAG,
    defaultEnabled: true,
  },
  {
    code: 'inventory',
    name: 'Inventory engine',
    category: 'INVENTORY',
    technicalStatus: 'AVAILABLE',
    commercialAvailability: 'AVAILABLE',
    entitlementKind: EntitlementCapabilityKind.FEATURE_FLAG,
    defaultEnabled: true,
  },
  {
    code: 'pos',
    name: 'Point of sale',
    category: 'SALES',
    technicalStatus: 'AVAILABLE',
    commercialAvailability: 'AVAILABLE',
    entitlementKind: EntitlementCapabilityKind.FEATURE_FLAG,
    defaultEnabled: true,
  },
  {
    code: 'sales',
    name: 'Sales engine',
    category: 'SALES',
    technicalStatus: 'AVAILABLE',
    commercialAvailability: 'AVAILABLE',
    entitlementKind: EntitlementCapabilityKind.FEATURE_FLAG,
    defaultEnabled: true,
  },
  {
    code: 'pharmacy.batch',
    name: 'Batch management',
    category: 'PHARMACY',
    technicalStatus: 'AVAILABLE',
    commercialAvailability: 'AVAILABLE',
    entitlementKind: EntitlementCapabilityKind.FEATURE_FLAG,
    defaultEnabled: true,
  },
  {
    code: 'pharmacy.expiry',
    name: 'Expiry management',
    category: 'PHARMACY',
    technicalStatus: 'AVAILABLE',
    commercialAvailability: 'AVAILABLE',
    entitlementKind: EntitlementCapabilityKind.FEATURE_FLAG,
    defaultEnabled: true,
  },
  {
    code: 'purchasing',
    name: 'Purchasing & replenishment',
    category: 'PROCUREMENT',
    technicalStatus: 'AVAILABLE',
    commercialAvailability: 'AVAILABLE',
    entitlementKind: EntitlementCapabilityKind.FEATURE_FLAG,
    defaultEnabled: true,
  },
  {
    code: 'stock_transfers',
    name: 'Inter-site stock transfers',
    category: 'INVENTORY',
    technicalStatus: 'AVAILABLE',
    commercialAvailability: 'AVAILABLE',
    entitlementKind: EntitlementCapabilityKind.FEATURE_FLAG,
    defaultEnabled: true,
  },
  {
    code: 'reporting',
    name: 'Operational reporting',
    category: 'ANALYTICS',
    technicalStatus: 'AVAILABLE',
    commercialAvailability: 'AVAILABLE',
    entitlementKind: EntitlementCapabilityKind.FEATURE_FLAG,
    defaultEnabled: true,
  },
  {
    code: 'warehouse',
    name: 'Warehouse management',
    category: 'WAREHOUSE',
    technicalStatus: 'AVAILABLE',
    commercialAvailability: 'AVAILABLE',
    entitlementKind: EntitlementCapabilityKind.FEATURE_FLAG,
    defaultEnabled: true,
  },
  {
    code: 'b2b_sales',
    name: 'B2B sales & credit',
    category: 'WHOLESALE',
    technicalStatus: 'AVAILABLE',
    commercialAvailability: 'AVAILABLE',
    entitlementKind: EntitlementCapabilityKind.FEATURE_FLAG,
    defaultEnabled: true,
  },
  {
    code: 'api',
    name: 'API access',
    category: 'INTEGRATION',
    technicalStatus: 'AVAILABLE',
    commercialAvailability: 'AVAILABLE',
    entitlementKind: EntitlementCapabilityKind.FEATURE_FLAG,
    defaultEnabled: true,
  },
  {
    code: 'analytics',
    name: 'Advanced analytics',
    category: 'ANALYTICS',
    technicalStatus: 'AVAILABLE',
    commercialAvailability: 'AVAILABLE',
    entitlementKind: EntitlementCapabilityKind.FEATURE_FLAG,
    defaultEnabled: true,
  },
  {
    code: 'sso',
    name: 'SSO / IAM enterprise',
    category: 'SECURITY',
    technicalStatus: 'AVAILABLE',
    commercialAvailability: 'AVAILABLE',
    entitlementKind: EntitlementCapabilityKind.FEATURE_FLAG,
    defaultEnabled: true,
  },
  {
    code: 'governance',
    name: 'Advanced governance',
    category: 'PLATFORM',
    technicalStatus: 'AVAILABLE',
    commercialAvailability: 'AVAILABLE',
    entitlementKind: EntitlementCapabilityKind.FEATURE_FLAG,
    defaultEnabled: true,
  },
  {
    code: 'max_organizations',
    name: 'Max establishments (organizations)',
    category: 'QUOTA',
    technicalStatus: 'AVAILABLE',
    commercialAvailability: 'AVAILABLE',
    entitlementKind: EntitlementCapabilityKind.QUOTA,
    defaultLimit: 1,
  },
  {
    code: 'max_users',
    name: 'Max users',
    category: 'QUOTA',
    technicalStatus: 'AVAILABLE',
    commercialAvailability: 'AVAILABLE',
    entitlementKind: EntitlementCapabilityKind.QUOTA,
    defaultLimit: 5,
  },
  {
    code: 'max_warehouses',
    name: 'Max warehouses',
    category: 'QUOTA',
    technicalStatus: 'AVAILABLE',
    commercialAvailability: 'AVAILABLE',
    entitlementKind: EntitlementCapabilityKind.QUOTA,
    defaultLimit: 0,
  },
] as const;

export const SYNTIX_SEGMENTS = [
  { code: 'PHARMA_RETAIL_INDEPENDENT', name: 'Independent retail pharmacy' },
  { code: 'PHARMA_CHAIN', name: 'Pharmacy chain' },
  { code: 'PHARMA_WHOLESALE', name: 'Pharmaceutical wholesaler' },
  { code: 'PHARMA_DISTRIBUTION', name: 'Pharmaceutical distribution' },
  { code: 'PHARMA_IMPORTER', name: 'Pharmaceutical importer' },
  { code: 'PHARMA_HOSPITAL', name: 'Hospital / institutional pharmacy' },
  { code: 'PHARMA_HYBRID', name: 'Hybrid pharmaceutical organization' },
] as const;

export const SYNTIX_PROFILES = [
  {
    code: 'INDEPENDENT_RETAIL_PHARMACY',
    name: 'Independent retail pharmacy',
    segmentCode: 'PHARMA_RETAIL_INDEPENDENT',
  },
  {
    code: 'MULTI_BRANCH_PHARMACY_GROUP',
    name: 'Multi-branch pharmacy group',
    segmentCode: 'PHARMA_CHAIN',
  },
  {
    code: 'PHARMACEUTICAL_WHOLESALER',
    name: 'Pharmaceutical wholesaler',
    segmentCode: 'PHARMA_WHOLESALE',
  },
  {
    code: 'PHARMACEUTICAL_DISTRIBUTOR',
    name: 'Pharmaceutical distributor',
    segmentCode: 'PHARMA_DISTRIBUTION',
  },
] as const;

export const SYNTIX_OPERATING_MODELS = [
  { code: 'SALES_B2C', name: 'B2C sales', dimension: 'SALES' },
  { code: 'SALES_B2B', name: 'B2B sales', dimension: 'SALES' },
  { code: 'FULFILL_COUNTER', name: 'Counter sales', dimension: 'FULFILLMENT' },
  { code: 'FULFILL_DELIVERY', name: 'Delivery', dimension: 'FULFILLMENT' },
  { code: 'INV_BATCH_EXPIRY', name: 'Batch + expiry tracked', dimension: 'INVENTORY' },
  { code: 'INV_MULTI_WAREHOUSE', name: 'Multi-warehouse', dimension: 'INVENTORY' },
  { code: 'PROCURE_CENTRAL', name: 'Centralized procurement', dimension: 'PROCUREMENT' },
  { code: 'PROCURE_BRANCH', name: 'Branch-level procurement', dimension: 'PROCUREMENT' },
  { code: 'ORG_SINGLE', name: 'Single branch', dimension: 'ORGANIZATION' },
  { code: 'ORG_MULTI_BRANCH', name: 'Multi-branch', dimension: 'ORGANIZATION' },
  { code: 'CHANNEL_DIRECT', name: 'Direct channel', dimension: 'CHANNEL' },
  { code: 'CHANNEL_DISTRIBUTOR', name: 'Distributor channel', dimension: 'CHANNEL' },
] as const;

export const SYNTIX_ICPS = [
  {
    code: 'ICP_INDEPENDENT_GROWTH',
    name: 'Independent pharmacy in growth',
    segmentCode: 'PHARMA_RETAIL_INDEPENDENT',
  },
  {
    code: 'ICP_PHARMACY_CHAIN',
    name: 'Pharmacy chain',
    segmentCode: 'PHARMA_CHAIN',
  },
  {
    code: 'ICP_WHOLESALER',
    name: 'Regional/national wholesaler',
    segmentCode: 'PHARMA_WHOLESALE',
  },
  {
    code: 'ICP_DISTRIBUTOR',
    name: 'National distributor',
    segmentCode: 'PHARMA_DISTRIBUTION',
  },
] as const;

export const SYNTIX_PERSONAS = [
  {
    code: 'PERSONA_OWNER_PHARMACIST',
    name: 'Owner pharmacist',
    roleLabel: 'Owner / Pharmacist-in-charge',
  },
  {
    code: 'PERSONA_OPS_DIRECTOR',
    name: 'Operations director',
    roleLabel: 'Operations Director',
  },
  {
    code: 'PERSONA_PROCUREMENT',
    name: 'Procurement lead',
    roleLabel: 'Procurement / Buying Lead',
  },
  {
    code: 'PERSONA_IT_ADMIN',
    name: 'IT / Systems admin',
    roleLabel: 'IT Administrator',
  },
] as const;

export const SYNTIX_VALUE_PROPOSITIONS = [
  {
    code: 'VP_RETAIL_CONTROL',
    name: 'Retail pharmacy operational control',
    segmentCode: 'PHARMA_RETAIL_INDEPENDENT',
    customerProblem: 'Fragmented stock, batch/expiry risk, and counter operations',
    proposedSolution: 'Unified POS + inventory + pharmacy batch/expiry controls',
    expectedOutcome: 'Fewer stockouts and expiry losses; faster counter throughput',
    differentiation: 'Edge-governed entitlements with BB pharmacy runtime',
  },
  {
    code: 'VP_CHAIN_VISIBILITY',
    name: 'Multi-branch pharmacy visibility',
    segmentCode: 'PHARMA_CHAIN',
    customerProblem: 'Inconsistent branch operations and weak transfer control',
    proposedSolution: 'Chain package with transfers, reporting, and establishment quotas',
    expectedOutcome: 'Centralized visibility across establishments of the same product',
    differentiation: 'Multi-establishment = same product footprint, not multi-product',
  },
  {
    code: 'VP_WHOLESALE_WAREHOUSE',
    name: 'Wholesale warehouse readiness',
    segmentCode: 'PHARMA_WHOLESALE',
    customerProblem: 'B2B sales without warehouse and credit-aware operations',
    proposedSolution: 'Wholesale package: warehouse + B2B sales + purchasing',
    expectedOutcome: 'Operable wholesale fulfillment under Edge commercial grants',
    differentiation: 'Commercial package maps to BB warehouse + sales modules',
  },
  {
    code: 'VP_DISTRIBUTION_SCALE',
    name: 'Distribution scale operations',
    segmentCode: 'PHARMA_DISTRIBUTION',
    customerProblem: 'National distribution needs multi-warehouse + API integrations',
    proposedSolution: 'Distribution package with API, transfers, and warehouse capacity',
    expectedOutcome: 'Scalable distribution footprint with governed entitlements',
    differentiation: 'Enterprise plan overlays SSO/governance without inventing prices',
  },
] as const;

export const SYNTIX_PRICING_UNITS = [
  { code: 'PU_SITE', name: 'Per establishment / site', unitCategory: 'LOCATION' },
  { code: 'PU_USER', name: 'Per user', unitCategory: 'USER' },
  { code: 'PU_WAREHOUSE', name: 'Per warehouse', unitCategory: 'WAREHOUSE' },
] as const;

type PlanTier = 'LITE' | 'PROFESSIONAL' | 'BUSINESS' | 'ENTERPRISE';

export type SeedPlanDef = {
  readonly code: string;
  readonly name: string;
  readonly planTier: PlanTier;
  readonly capabilityCodes: readonly string[];
  readonly quotas: Readonly<Record<string, number>>;
  readonly packageCode: string | null;
};

export type SeedPackageDef = {
  readonly code: string;
  readonly name: string;
  readonly capabilityCodes: readonly string[];
};

const CORE_RETAIL = [
  'identity',
  'pharmacy',
  'inventory',
  'pos',
  'sales',
  'pharmacy.batch',
  'pharmacy.expiry',
] as const;

export const SYNTIX_PACKAGES: readonly SeedPackageDef[] = [
  {
    code: 'PKG_RETAIL_PHARMACY',
    name: 'Retail Pharmacy Package',
    capabilityCodes: [...CORE_RETAIL, 'purchasing'],
  },
  {
    code: 'PKG_PHARMACY_CHAIN',
    name: 'Pharmacy Chain Package',
    capabilityCodes: [...CORE_RETAIL, 'purchasing', 'stock_transfers', 'reporting'],
  },
  {
    code: 'PKG_WHOLESALE',
    name: 'Wholesale Package',
    capabilityCodes: [
      ...CORE_RETAIL.filter((c) => c !== 'pos'),
      'purchasing',
      'warehouse',
      'b2b_sales',
      'reporting',
    ],
  },
  {
    code: 'PKG_DISTRIBUTION',
    name: 'Distribution Package',
    capabilityCodes: [
      'identity',
      'pharmacy',
      'inventory',
      'pharmacy.batch',
      'pharmacy.expiry',
      'purchasing',
      'warehouse',
      'b2b_sales',
      'stock_transfers',
      'reporting',
      'api',
    ],
  },
];

export const SYNTIX_PLANS: readonly SeedPlanDef[] = [
  {
    code: 'SYNTIX_LITE',
    name: 'Syntix Pharma Lite',
    planTier: 'LITE',
    packageCode: 'PKG_RETAIL_PHARMACY',
    capabilityCodes: [...CORE_RETAIL],
    quotas: { max_organizations: 1, max_users: 5, max_warehouses: 0 },
  },
  {
    code: 'SYNTIX_PROFESSIONAL',
    name: 'Syntix Pharma Professional',
    planTier: 'PROFESSIONAL',
    packageCode: 'PKG_RETAIL_PHARMACY',
    capabilityCodes: [...CORE_RETAIL, 'purchasing', 'stock_transfers', 'reporting'],
    quotas: { max_organizations: 3, max_users: 25, max_warehouses: 1 },
  },
  {
    code: 'SYNTIX_BUSINESS',
    name: 'Syntix Pharma Business',
    planTier: 'BUSINESS',
    packageCode: 'PKG_PHARMACY_CHAIN',
    capabilityCodes: [
      ...CORE_RETAIL,
      'purchasing',
      'stock_transfers',
      'reporting',
      'warehouse',
      'b2b_sales',
      'api',
      'analytics',
    ],
    quotas: { max_organizations: 15, max_users: 100, max_warehouses: 5 },
  },
  {
    code: 'SYNTIX_ENTERPRISE',
    name: 'Syntix Pharma Enterprise',
    planTier: 'ENTERPRISE',
    packageCode: 'PKG_DISTRIBUTION',
    capabilityCodes: [
      ...CORE_RETAIL,
      'purchasing',
      'stock_transfers',
      'reporting',
      'warehouse',
      'b2b_sales',
      'api',
      'analytics',
      'sso',
      'governance',
    ],
    quotas: { max_organizations: 100, max_users: 1000, max_warehouses: 50 },
  },
];

export const SYNTIX_ADDONS = [
  {
    code: 'ADDON_EXTRA_WAREHOUSE',
    name: 'Additional warehouse',
    capabilityCodes: ['warehouse'] as const,
  },
  {
    code: 'ADDON_API_CAPACITY',
    name: 'API capacity',
    capabilityCodes: ['api'] as const,
  },
  {
    code: 'ADDON_ADVANCED_ANALYTICS',
    name: 'Advanced analytics',
    capabilityCodes: ['analytics'] as const,
  },
] as const;

export function entitlementSourcesForPlan(planCode: string): EntitlementSource[] {
  const plan = SYNTIX_PLANS.find((p) => p.code === planCode);
  if (!plan) return [];
  const sources: EntitlementSource[] = [];
  for (const code of plan.capabilityCodes) {
    const def = SYNTIX_CAPABILITIES.find((c) => c.code === code);
    if (!def || def.entitlementKind !== EntitlementCapabilityKind.FEATURE_FLAG) continue;
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

/** Snapshot shape stored on subscription items / offer configuration. */
export function planEntitlementSnapshot(planCode: string): {
  planCode: string;
  capabilities: EntitlementSource[];
} {
  return {
    planCode,
    capabilities: entitlementSourcesForPlan(planCode),
  };
}

export function assertPlanCapabilityNesting(): void {
  const byTier = Object.fromEntries(SYNTIX_PLANS.map((p) => [p.planTier, new Set(p.capabilityCodes)]));
  const lite = byTier.LITE!;
  const pro = byTier.PROFESSIONAL!;
  const biz = byTier.BUSINESS!;
  const ent = byTier.ENTERPRISE!;
  for (const code of lite) {
    if (!pro.has(code)) throw new Error(`PROFESSIONAL missing Lite cap ${code}`);
    if (!biz.has(code)) throw new Error(`BUSINESS missing Lite cap ${code}`);
    if (!ent.has(code)) throw new Error(`ENTERPRISE missing Lite cap ${code}`);
  }
  for (const code of pro) {
    if (!biz.has(code)) throw new Error(`BUSINESS missing Professional cap ${code}`);
    if (!ent.has(code)) throw new Error(`ENTERPRISE missing Professional cap ${code}`);
  }
}
