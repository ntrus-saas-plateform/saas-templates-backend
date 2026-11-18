import { describe, expect, it } from 'vitest';
import { evaluateOfferEligibility } from './offer-eligibility.js';
import { isCountryPriced, listGeographicPricingForCountry } from './geographic-pricing.js';
import { evaluateDiscountApproval } from './discount-policy.js';
import { runSolutionWizard } from './solution-wizard.js';

describe('E2 offer eligibility / geo / discount', () => {
  it('labels AVAILABLE / RECOMMENDED / CUSTOM_QUOTE / UNAVAILABLE', () => {
    expect(
      evaluateOfferEligibility({
        planStatus: 'PUBLISHED',
        productPublished: true,
        commerciallyIncludable: true,
        fitsScale: true,
        needsSalesAssist: false,
        enterpriseOnly: false,
        geoAllowed: true,
      }).label,
    ).toBe('RECOMMENDED');
    expect(
      evaluateOfferEligibility({
        planStatus: 'PUBLISHED',
        productPublished: true,
        commerciallyIncludable: true,
        fitsScale: true,
        needsSalesAssist: true,
        enterpriseOnly: true,
        geoAllowed: true,
      }).label,
    ).toBe('CUSTOM_QUOTE');
    expect(
      evaluateOfferEligibility({
        planStatus: 'DRAFT',
        productPublished: true,
        commerciallyIncludable: true,
        fitsScale: null,
        needsSalesAssist: false,
        enterpriseOnly: false,
        geoAllowed: null,
      }).label,
    ).toBe('UNAVAILABLE');
  });

  it('lists CI geographic pricing without inventing amounts', () => {
    expect(isCountryPriced('CI')).toBe(true);
    expect(listGeographicPricingForCountry('CI').every((r) => r.currency === 'XOF')).toBe(true);
  });

  it('enforces discount approval matrix', () => {
    expect(
      evaluateDiscountApproval({ discountPercent: 10, actorTier: 'AE' }).allowed,
    ).toBe(false);
    expect(
      evaluateDiscountApproval({ discountPercent: 10, actorTier: 'MANAGER' }).allowed,
    ).toBe(true);
    expect(evaluateDiscountApproval({ discountPercent: null, actorTier: 'CFO' }).allowed).toBe(
      false,
    );
  });
});

describe('E3 solution wizard', () => {
  it('never grants entitlements', () => {
    const r = runSolutionWizard({
      productCode: 'OKAPI_RESTAURANT',
      sites: 1,
      users: 5,
    });
    expect(r.grantsEntitlements).toBe(false);
    expect(r.recommendedPlanCode).toBe('OKAPI_REST_STARTER');
  });

  it('recommends multi-site and allows profile correction', () => {
    const r = runSolutionWizard({
      productCode: 'OKAPI_RESTAURANT',
      sites: 4,
      correctedProfileCode: 'MULTI_SITE_RESTAURANT',
      mode: 'GUIDED',
    });
    expect(r.recommendedPlanCode).toBe('OKAPI_REST_MULTI');
    expect(r.resolvedProfileCode).toBe('MULTI_SITE_RESTAURANT');
  });

  it('golden Wholesale-ish scale maps to Business on Pharma', () => {
    const r = runSolutionWizard({
      productCode: 'SYNTIX_PHARMA',
      sites: 3,
      users: 45,
      needs: ['warehouse'],
    });
    expect(r.recommendedPlanCode).toBe('SYNTIX_BUSINESS');
    expect(r.snapshot.goldenWholesaleHint).toBe(true);
    expect(r.grantsEntitlements).toBe(false);
  });
});
