import {
  assertCapabilityCommerciallyIncludable,
  assertSameProductOwnership,
  CommercialInclusionType,
  type CommercialCapabilityRef,
} from './commercial.entity.js';

export enum OfferConfiguratorMode {
  MANUAL_CONFIGURATION = 'MANUAL_CONFIGURATION',
  RULE_BASED_RECOMMENDATION = 'RULE_BASED_RECOMMENDATION',
  GUIDED_CONFIGURATION = 'GUIDED_CONFIGURATION',
}

export enum EligibilityDecision {
  ELIGIBLE = 'ELIGIBLE',
  ELIGIBLE_WITH_RESTRICTIONS = 'ELIGIBLE_WITH_RESTRICTIONS',
  INELIGIBLE = 'INELIGIBLE',
  NEEDS_REVIEW = 'NEEDS_REVIEW',
  INSUFFICIENT_INFORMATION = 'INSUFFICIENT_INFORMATION',
}

export type OfferConfigurationInput = {
  readonly mode: OfferConfiguratorMode;
  readonly productId: string;
  readonly productLifecycleStatus: string;
  readonly planId: string;
  readonly planProductId: string;
  readonly planStatus: string;
  readonly packageId?: string | null;
  readonly packageProductId?: string | null;
  readonly addonIds?: readonly string[];
  readonly addonProductIds?: readonly string[];
  readonly capabilityRefs: readonly CommercialCapabilityRef[];
  readonly inclusions: readonly {
    capabilityId: string;
    inclusionType: CommercialInclusionType;
  }[];
  readonly geographicScope?: string | null;
  readonly allowedGeographicScopes?: readonly string[] | null;
  readonly deploymentMode?: string | null;
  readonly validatedDeploymentModes?: readonly string[] | null;
  readonly rulesVersion: number;
};

export type OfferConfigurationResult = {
  readonly decision: EligibilityDecision;
  readonly mode: OfferConfiguratorMode;
  readonly appliedRules: readonly string[];
  readonly satisfied: readonly string[];
  readonly unsatisfied: readonly string[];
  readonly includedCapabilities: readonly string[];
  readonly excludedCapabilities: readonly string[];
  readonly restrictions: readonly string[];
  readonly rulesVersion: number;
  readonly evaluatedAt: string;
  /** Configurator never grants entitlements — explicit contract marker. */
  readonly grantsEntitlements: false;
};

export function configureCommercialOffer(
  input: OfferConfigurationInput,
): OfferConfigurationResult {
  const appliedRules: string[] = [];
  const satisfied: string[] = [];
  const unsatisfied: string[] = [];
  const restrictions: string[] = [];
  const includedCapabilities: string[] = [];
  const excludedCapabilities: string[] = [];

  appliedRules.push('product.ownership');
  try {
    assertSameProductOwnership({
      productId: input.productId,
      otherProductId: input.planProductId,
      context: 'configurator-plan',
    });
    satisfied.push('plan_belongs_to_product');
  } catch {
    unsatisfied.push('plan_belongs_to_product');
  }

  if (input.packageId && input.packageProductId) {
    appliedRules.push('package.ownership');
    try {
      assertSameProductOwnership({
        productId: input.productId,
        otherProductId: input.packageProductId,
        context: 'configurator-package',
      });
      satisfied.push('package_belongs_to_product');
    } catch {
      unsatisfied.push('package_belongs_to_product');
    }
  }

  if (input.addonIds?.length) {
    appliedRules.push('addon.ownership');
    for (let i = 0; i < input.addonIds.length; i += 1) {
      const addonProductId = input.addonProductIds?.[i];
      if (!addonProductId) {
        unsatisfied.push(`addon_product_unknown:${input.addonIds[i]}`);
        continue;
      }
      try {
        assertSameProductOwnership({
          productId: input.productId,
          otherProductId: addonProductId,
          context: 'configurator-addon',
        });
        satisfied.push(`addon_belongs_to_product:${input.addonIds[i]}`);
      } catch {
        unsatisfied.push(`addon_belongs_to_product:${input.addonIds[i]}`);
      }
    }
  }

  appliedRules.push('product.lifecycle');
  if (input.productLifecycleStatus === 'PUBLISHED') {
    satisfied.push('product_published');
  } else {
    unsatisfied.push('product_published');
    restrictions.push('product_not_published');
  }

  appliedRules.push('capability.inclusion');
  const capMap = new Map(input.capabilityRefs.map((c) => [c.capabilityId, c]));
  for (const inc of input.inclusions) {
    if (
      inc.inclusionType === CommercialInclusionType.NOT_INCLUDED ||
      inc.inclusionType === CommercialInclusionType.RESTRICTED
    ) {
      excludedCapabilities.push(inc.capabilityId);
      continue;
    }
    const cap = capMap.get(inc.capabilityId);
    if (!cap) {
      unsatisfied.push(`capability_exists:${inc.capabilityId}`);
      continue;
    }
    try {
      assertCapabilityCommerciallyIncludable(cap, inc.inclusionType);
      includedCapabilities.push(inc.capabilityId);
      satisfied.push(`capability_includable:${inc.capabilityId}`);
    } catch {
      unsatisfied.push(`capability_includable:${inc.capabilityId}`);
    }
  }

  if (input.allowedGeographicScopes && input.allowedGeographicScopes.length > 0) {
    appliedRules.push('geography.scope');
    if (!input.geographicScope) {
      unsatisfied.push('geographic_scope_provided');
    } else if (input.allowedGeographicScopes.includes(input.geographicScope)) {
      satisfied.push('geographic_scope_allowed');
    } else {
      unsatisfied.push('geographic_scope_allowed');
      restrictions.push('geographic_restriction');
    }
  }

  if (input.validatedDeploymentModes && input.validatedDeploymentModes.length > 0) {
    appliedRules.push('deployment.mode');
    if (!input.deploymentMode) {
      unsatisfied.push('deployment_mode_provided');
    } else if (input.validatedDeploymentModes.includes(input.deploymentMode)) {
      satisfied.push('deployment_mode_validated');
    } else {
      unsatisfied.push('deployment_mode_validated');
      restrictions.push('deployment_mode_not_validated_in_p1');
    }
  }

  let decision: EligibilityDecision;
  if (unsatisfied.some((u) => u.startsWith('plan_belongs') || u.startsWith('package_belongs') || u.startsWith('addon_belongs') || u.startsWith('capability_'))) {
    decision = EligibilityDecision.INELIGIBLE;
  } else if (unsatisfied.includes('product_published')) {
    decision = EligibilityDecision.NEEDS_REVIEW;
  } else if (restrictions.length > 0) {
    decision = EligibilityDecision.ELIGIBLE_WITH_RESTRICTIONS;
  } else if (
    (input.allowedGeographicScopes?.length && !input.geographicScope) ||
    (input.validatedDeploymentModes?.length && !input.deploymentMode)
  ) {
    decision = EligibilityDecision.INSUFFICIENT_INFORMATION;
  } else {
    decision = EligibilityDecision.ELIGIBLE;
  }

  return {
    decision,
    mode: input.mode,
    appliedRules,
    satisfied,
    unsatisfied,
    includedCapabilities,
    excludedCapabilities,
    restrictions,
    rulesVersion: input.rulesVersion,
    evaluatedAt: new Date().toISOString(),
    grantsEntitlements: false,
  };
}
