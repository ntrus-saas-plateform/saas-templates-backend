import { describe, expect, it } from 'vitest';
import { CommercialInclusionType } from './commercial.entity.js';
import {
  configureCommercialOffer,
  EligibilityDecision,
  OfferConfiguratorMode,
} from './offer-configurator.js';

describe('offer configurator', () => {
  it('marks eligible when product published and capabilities valid', () => {
    const result = configureCommercialOffer({
      mode: OfferConfiguratorMode.MANUAL_CONFIGURATION,
      productId: 'p1',
      productLifecycleStatus: 'PUBLISHED',
      planId: 'plan1',
      planProductId: 'p1',
      planStatus: 'DRAFT',
      capabilityRefs: [
        {
          capabilityId: 'c1',
          technicalStatus: 'VALIDATED',
          commercialAvailability: 'AVAILABLE',
        },
      ],
      inclusions: [
        { capabilityId: 'c1', inclusionType: CommercialInclusionType.INCLUDED },
      ],
      rulesVersion: 1,
    });
    expect(result.decision).toBe(EligibilityDecision.ELIGIBLE);
    expect(result.grantsEntitlements).toBe(false);
    expect(result.includedCapabilities).toEqual(['c1']);
  });

  it('rejects cross-product plan', () => {
    const result = configureCommercialOffer({
      mode: OfferConfiguratorMode.GUIDED_CONFIGURATION,
      productId: 'p1',
      productLifecycleStatus: 'PUBLISHED',
      planId: 'plan1',
      planProductId: 'p2',
      planStatus: 'DRAFT',
      capabilityRefs: [],
      inclusions: [],
      rulesVersion: 1,
    });
    expect(result.decision).toBe(EligibilityDecision.INELIGIBLE);
    expect(result.unsatisfied).toContain('plan_belongs_to_product');
  });

  it('blocks unvalidated capability', () => {
    const result = configureCommercialOffer({
      mode: OfferConfiguratorMode.RULE_BASED_RECOMMENDATION,
      productId: 'p1',
      productLifecycleStatus: 'PUBLISHED',
      planId: 'plan1',
      planProductId: 'p1',
      planStatus: 'DRAFT',
      capabilityRefs: [
        {
          capabilityId: 'c1',
          technicalStatus: 'PLANNED',
          commercialAvailability: 'AVAILABLE',
        },
      ],
      inclusions: [
        { capabilityId: 'c1', inclusionType: CommercialInclusionType.INCLUDED },
      ],
      rulesVersion: 1,
    });
    expect(result.decision).toBe(EligibilityDecision.INELIGIBLE);
  });

  it('flags restricted geography', () => {
    const result = configureCommercialOffer({
      mode: OfferConfiguratorMode.MANUAL_CONFIGURATION,
      productId: 'p1',
      productLifecycleStatus: 'PUBLISHED',
      planId: 'plan1',
      planProductId: 'p1',
      planStatus: 'DRAFT',
      capabilityRefs: [],
      inclusions: [],
      geographicScope: 'XX',
      allowedGeographicScopes: ['CD', 'BI'],
      rulesVersion: 1,
    });
    expect(result.decision).toBe(EligibilityDecision.ELIGIBLE_WITH_RESTRICTIONS);
    expect(result.restrictions).toContain('geographic_restriction');
  });
});
