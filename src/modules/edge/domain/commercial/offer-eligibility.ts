/**
 * RGOM-E2 — Offer eligibility labels for configurator / sales.
 * Available / Recommended / Restricted / Unavailable / Custom Quote.
 */

export type OfferEligibilityLabel =
  | 'AVAILABLE'
  | 'RECOMMENDED'
  | 'RESTRICTED'
  | 'UNAVAILABLE'
  | 'CUSTOM_QUOTE';

export type OfferEligibilityInput = {
  readonly planStatus: string;
  readonly productPublished: boolean;
  readonly commerciallyIncludable: boolean;
  readonly fitsScale: boolean | null;
  readonly needsSalesAssist: boolean;
  readonly enterpriseOnly: boolean;
  readonly geoAllowed: boolean | null;
};

export type OfferEligibilityResult = {
  readonly label: OfferEligibilityLabel;
  readonly reasons: string[];
};

export function evaluateOfferEligibility(input: OfferEligibilityInput): OfferEligibilityResult {
  const reasons: string[] = [];
  if (!input.productPublished) {
    reasons.push('Product not PUBLISHED');
    return { label: 'UNAVAILABLE', reasons };
  }
  if (!input.commerciallyIncludable) {
    reasons.push('Capability/plan not commercially includable (e.g. PLANNED)');
    return { label: 'UNAVAILABLE', reasons };
  }
  if (String(input.planStatus).toUpperCase() !== 'PUBLISHED') {
    reasons.push(`Plan status ${input.planStatus}`);
    return { label: 'UNAVAILABLE', reasons };
  }
  if (input.geoAllowed === false) {
    reasons.push('Geographic scope not allowed');
    return { label: 'RESTRICTED', reasons };
  }
  if (input.enterpriseOnly || input.needsSalesAssist) {
    reasons.push(
      input.enterpriseOnly
        ? 'Enterprise-only — custom quote path'
        : 'Needs sales-assisted configuration',
    );
    return { label: 'CUSTOM_QUOTE', reasons };
  }
  if (input.fitsScale === false) {
    reasons.push('Scale outside plan headroom — restricted or upsell');
    return { label: 'RESTRICTED', reasons };
  }
  if (input.fitsScale === true) {
    reasons.push('Fits published offer and scale');
    return { label: 'RECOMMENDED', reasons };
  }
  reasons.push('Published and includable — available without strong recommend signal');
  return { label: 'AVAILABLE', reasons };
}
