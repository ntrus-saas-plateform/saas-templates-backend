/**
 * RGOM-E3 — Solution configurator wizard beachhead.
 * product → activity → profile → operating model → scale → needs → recommendation.
 * ALWAYS grantsEntitlements: false.
 */

import { RESTAURANT_PLANS } from './okapi-restaurant-catalog.seed.js';
import { evaluateOfferEligibility, type OfferEligibilityLabel } from './offer-eligibility.js';

export type WizardProductCode = 'SYNTIX_PHARMA' | 'OKAPI_RESTAURANT';

export type SolutionWizardInput = {
  readonly productCode: WizardProductCode;
  readonly activityCodes?: readonly string[];
  readonly profileCode?: string | null;
  readonly operatingModelCodes?: readonly string[];
  readonly sites?: number | null;
  readonly users?: number | null;
  readonly needs?: readonly string[];
  readonly mode?: 'MANUAL' | 'RULE_BASED' | 'GUIDED';
  /** Prospect correction of inferred profile */
  readonly correctedProfileCode?: string | null;
};

export type WizardExplanation = {
  readonly code: string;
  readonly kind: 'why' | 'included' | 'optional' | 'unavailable' | 'needs_sales';
  readonly message: string;
};

export type SolutionWizardResult = {
  readonly productCode: WizardProductCode;
  readonly mode: 'MANUAL' | 'RULE_BASED' | 'GUIDED';
  readonly resolvedProfileCode: string | null;
  readonly recommendedPlanCode: string | null;
  readonly recommendedPackageCode: string | null;
  readonly recommendedAddons: readonly string[];
  readonly eligibilityLabel: OfferEligibilityLabel;
  readonly explanations: readonly WizardExplanation[];
  readonly snapshot: Record<string, unknown>;
  readonly grantsEntitlements: false;
};

function recommendRestaurant(input: SolutionWizardInput): SolutionWizardResult {
  const mode = input.mode ?? 'GUIDED';
  const profile =
    input.correctedProfileCode?.trim() ||
    input.profileCode?.trim() ||
    (input.sites != null && input.sites >= 2
      ? 'MULTI_SITE_RESTAURANT'
      : 'INDEPENDENT_RESTAURANT');

  const sites = input.sites ?? null;
  const users = input.users ?? null;
  const explanations: WizardExplanation[] = [];

  let plan = RESTAURANT_PLANS[0];
  if (sites != null && sites >= 15) {
    plan = RESTAURANT_PLANS.find((p) => p.code === 'OKAPI_REST_ENTERPRISE') ?? plan;
    explanations.push({
      code: 'scale.enterprise',
      kind: 'why',
      message: '≥15 sites → Enterprise multi-site / QSR package.',
    });
  } else if (sites != null && sites >= 2) {
    plan = RESTAURANT_PLANS.find((p) => p.code === 'OKAPI_REST_MULTI') ?? plan;
    explanations.push({
      code: 'scale.multi',
      kind: 'why',
      message: '2–14 sites → Multi-site plan.',
    });
  } else if (users != null && users > 8) {
    plan = RESTAURANT_PLANS.find((p) => p.code === 'OKAPI_REST_GROWTH') ?? plan;
    explanations.push({
      code: 'scale.growth',
      kind: 'why',
      message: 'Single site with >8 users → Growth.',
    });
  } else {
    explanations.push({
      code: 'scale.starter',
      kind: 'why',
      message: 'Single site small team → Starter.',
    });
  }

  for (const cap of plan.caps) {
    explanations.push({
      code: `included.${cap}`,
      kind: 'included',
      message: `${cap} included in ${plan.code}`,
    });
  }

  const needsSales = plan.tier === 'ENTERPRISE';
  if (needsSales) {
    explanations.push({
      code: 'needs_sales',
      kind: 'needs_sales',
      message: 'Enterprise tier — sales-assisted quote recommended.',
    });
  }

  const addons: string[] = [];
  if (input.needs?.includes('delivery') && !plan.caps.includes('delivery')) {
    explanations.push({
      code: 'optional.delivery',
      kind: 'optional',
      message: 'Delivery requested — available on Multi/Enterprise or as expansion quote.',
    });
  }
  if (input.needs?.includes('analytics') && !plan.caps.includes('analytics')) {
    addons.push('ADDON_ADVANCED_ANALYTICS');
    explanations.push({
      code: 'optional.analytics',
      kind: 'optional',
      message: 'Analytics add-on suggested (not silent entitlement).',
    });
  }

  const eligibility = evaluateOfferEligibility({
    planStatus: 'PUBLISHED',
    productPublished: true,
    commerciallyIncludable: true,
    fitsScale: true,
    needsSalesAssist: needsSales,
    enterpriseOnly: needsSales,
    geoAllowed: true,
  });

  return {
    productCode: 'OKAPI_RESTAURANT',
    mode,
    resolvedProfileCode: profile,
    recommendedPlanCode: plan.code,
    recommendedPackageCode: plan.packageCode,
    recommendedAddons: addons,
    eligibilityLabel: eligibility.label,
    explanations,
    snapshot: {
      productCode: 'OKAPI_RESTAURANT',
      profile,
      activities: input.activityCodes ?? [],
      operatingModels: input.operatingModelCodes ?? [],
      sites,
      users,
      needs: input.needs ?? [],
      recommendedPlanCode: plan.code,
      mode,
      linkedTo: ['Opportunity', 'Quote', 'AcquisitionApplication'],
    },
    grantsEntitlements: false,
  };
}

function recommendPharma(input: SolutionWizardInput): SolutionWizardResult {
  const mode = input.mode ?? 'GUIDED';
  const sites = input.sites ?? 1;
  const users = input.users ?? 5;
  const explanations: WizardExplanation[] = [];
  let planCode = 'SYNTIX_LITE';
  let packageCode = 'PKG_RETAIL_PHARMACY';
  if (sites >= 3 || (input.needs?.includes('warehouse') && users >= 45)) {
    planCode = 'SYNTIX_BUSINESS';
    packageCode = 'PKG_PHARMACY_CHAIN';
    explanations.push({
      code: 'wholesale_scale',
      kind: 'why',
      message: 'Multi-branch / warehouse scale → Business / Chain package.',
    });
  } else if (users > 10) {
    planCode = 'SYNTIX_PROFESSIONAL';
    explanations.push({
      code: 'pro_users',
      kind: 'why',
      message: 'User scale → Professional.',
    });
  } else {
    explanations.push({
      code: 'lite_default',
      kind: 'why',
      message: 'Retail independent default → Lite.',
    });
  }

  const eligibility = evaluateOfferEligibility({
    planStatus: 'PUBLISHED',
    productPublished: true,
    commerciallyIncludable: true,
    fitsScale: true,
    needsSalesAssist: planCode === 'SYNTIX_ENTERPRISE',
    enterpriseOnly: false,
    geoAllowed: true,
  });

  return {
    productCode: 'SYNTIX_PHARMA',
    mode,
    resolvedProfileCode:
      input.correctedProfileCode ?? input.profileCode ?? 'INDEPENDENT_RETAIL_PHARMACY',
    recommendedPlanCode: planCode,
    recommendedPackageCode: packageCode,
    recommendedAddons: input.needs?.includes('api') ? ['ADDON_API_CAPACITY'] : [],
    eligibilityLabel: eligibility.label,
    explanations,
    snapshot: {
      productCode: 'SYNTIX_PHARMA',
      sites,
      users,
      needs: input.needs ?? [],
      recommendedPlanCode: planCode,
      goldenWholesaleHint: sites === 3 && users === 45,
    },
    grantsEntitlements: false,
  };
}

export function runSolutionWizard(input: SolutionWizardInput): SolutionWizardResult {
  if (input.productCode === 'OKAPI_RESTAURANT') return recommendRestaurant(input);
  return recommendPharma(input);
}
