/**
 * RGOM-E2 — Geographic pricing rules beachhead (1 market first: CI / XOF).
 * Rules declare currency + country eligibility — never invent unit prices.
 */

export type GeographicPricingRule = {
  readonly code: string;
  readonly countries: readonly string[];
  readonly currency: string;
  readonly priceBookCode: string;
  readonly status: 'ACTIVE' | 'DRAFT' | 'RESTRICTED';
  readonly note: string;
};

export const GEOGRAPHIC_PRICING_BEACHHEAD: readonly GeographicPricingRule[] = [
  {
    code: 'GEO_CI_XOF',
    countries: ['CI'],
    currency: 'XOF',
    priceBookCode: 'PB_SYNTIX_BEACHHEAD',
    status: 'DRAFT',
    note: 'Côte d’Ivoire beachhead — amounts NEEDS_RESEARCH (no invented prices).',
  },
  {
    code: 'GEO_CI_XOF_RESTAURANT',
    countries: ['CI'],
    currency: 'XOF',
    priceBookCode: 'PB_OKAPI_RESTAURANT_BEACHHEAD',
    status: 'DRAFT',
    note: 'Restaurant CI beachhead — amounts NEEDS_RESEARCH.',
  },
  {
    code: 'GEO_WAEMU_XOF',
    countries: ['CI', 'SN', 'BJ', 'TG', 'BF', 'ML', 'NE', 'GW'],
    currency: 'XOF',
    priceBookCode: 'PB_SYNTIX_BEACHHEAD',
    status: 'DRAFT',
    note: 'WAEMU expansion of same currency book — still DRAFT amounts.',
  },
] as const;

export function listGeographicPricingForCountry(country: string): GeographicPricingRule[] {
  const c = country.trim().toUpperCase();
  return GEOGRAPHIC_PRICING_BEACHHEAD.filter((r) => r.countries.includes(c));
}

export function isCountryPriced(country: string): boolean {
  return listGeographicPricingForCountry(country).some((r) => r.status !== 'RESTRICTED');
}
