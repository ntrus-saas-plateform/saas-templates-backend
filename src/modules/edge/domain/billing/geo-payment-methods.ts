import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';

/**
 * RGOM-E8.3 — Geo payment methods beachhead (Syntix / WAEMU-first).
 * Catalog is declarative availability — not a claim that the PSP is live.
 * Never invent collected cash; methods are tokenized refs only.
 */

export type GeoPaymentMethodType =
  | 'CARD'
  | 'MOBILE_MONEY'
  | 'BANK_TRANSFER'
  | 'WALLET'
  | 'MANUAL'
  | 'OTHER';

export type GeoPaymentMethodOffer = {
  readonly code: string;
  readonly methodType: GeoPaymentMethodType;
  /** Operator / network brand when MOBILE_MONEY (MTN, ORANGE, WAVE, MOOV…). */
  readonly brand: string | null;
  readonly countries: readonly string[];
  readonly currencies: readonly string[];
  readonly providers: readonly string[];
  readonly status: 'AVAILABLE' | 'PLANNED' | 'RESTRICTED';
  readonly notes: string;
};

/** Beachhead catalog — WAEMU + universal card/transfer. */
export const GEO_PAYMENT_BEACHHEAD_CATALOG: readonly GeoPaymentMethodOffer[] = [
  {
    code: 'CARD_INTERNATIONAL',
    methodType: 'CARD',
    brand: null,
    countries: ['*'],
    currencies: ['USD', 'EUR', 'XOF', 'XAF'],
    providers: ['hyperswitch', 'http_webhook', 'sandbox'],
    status: 'AVAILABLE',
    notes: 'Card via PSP orchestration — never store PAN/CVV in Edge.',
  },
  {
    code: 'BANK_TRANSFER_LOCAL',
    methodType: 'BANK_TRANSFER',
    brand: null,
    countries: ['CI', 'SN', 'BJ', 'TG', 'BF', 'ML', 'NE', 'GW'],
    currencies: ['XOF'],
    providers: ['hyperswitch', 'http_webhook', 'manual'],
    status: 'AVAILABLE',
    notes: 'Local bank transfer / deposit — reconciliation required.',
  },
  {
    code: 'MM_MTN_CI',
    methodType: 'MOBILE_MONEY',
    brand: 'MTN',
    countries: ['CI', 'BJ', 'TG', 'GW'],
    currencies: ['XOF'],
    providers: ['hyperswitch', 'http_webhook', 'sandbox'],
    status: 'AVAILABLE',
    notes: 'MTN Mobile Money — beachhead WAEMU; requires PSP rail.',
  },
  {
    code: 'MM_ORANGE_CI',
    methodType: 'MOBILE_MONEY',
    brand: 'ORANGE',
    countries: ['CI', 'SN', 'ML', 'BF', 'NE'],
    currencies: ['XOF'],
    providers: ['hyperswitch', 'http_webhook', 'sandbox'],
    status: 'AVAILABLE',
    notes: 'Orange Money — beachhead WAEMU.',
  },
  {
    code: 'MM_WAVE_SN',
    methodType: 'MOBILE_MONEY',
    brand: 'WAVE',
    countries: ['SN', 'CI'],
    currencies: ['XOF'],
    providers: ['hyperswitch', 'http_webhook', 'sandbox'],
    status: 'AVAILABLE',
    notes: 'Wave wallet — Senegal/Côte d’Ivoire beachhead.',
  },
  {
    code: 'MM_MOOV_BJ',
    methodType: 'MOBILE_MONEY',
    brand: 'MOOV',
    countries: ['BJ', 'TG', 'CI', 'BF'],
    currencies: ['XOF'],
    providers: ['hyperswitch', 'http_webhook', 'sandbox'],
    status: 'AVAILABLE',
    notes: 'Moov Money — selected WAEMU markets.',
  },
  {
    code: 'MANUAL_OPS',
    methodType: 'MANUAL',
    brand: null,
    countries: ['*'],
    currencies: ['USD', 'EUR', 'XOF', 'XAF'],
    providers: ['manual'],
    status: 'RESTRICTED',
    notes: 'Ops-recorded manual settlement — never auto-activate without proof.',
  },
] as const;

export function listGeoPaymentMethods(input?: {
  country?: string | null;
  currency?: string | null;
  methodType?: string | null;
  includePlanned?: boolean;
}): GeoPaymentMethodOffer[] {
  const country = input?.country?.trim().toUpperCase() || null;
  const currency = input?.currency?.trim().toUpperCase() || null;
  const methodType = input?.methodType?.trim().toUpperCase() || null;
  const includePlanned = input?.includePlanned === true;

  return GEO_PAYMENT_BEACHHEAD_CATALOG.filter((offer) => {
    if (!includePlanned && offer.status === 'PLANNED') return false;
    if (methodType && offer.methodType !== methodType) return false;
    if (country && country !== '*') {
      const ok =
        offer.countries.includes('*') || offer.countries.includes(country);
      if (!ok) return false;
    }
    if (currency) {
      if (!offer.currencies.includes(currency)) return false;
    }
    return true;
  });
}

export function assertPaymentMethodAllowedForGeo(input: {
  methodType: string;
  brand?: string | null;
  country?: string | null;
  currency?: string | null;
  provider?: string | null;
}): GeoPaymentMethodOffer {
  const methodType = String(input.methodType).trim().toUpperCase();
  const brand = input.brand?.trim().toUpperCase() || null;
  const country = input.country?.trim().toUpperCase() || null;
  const currency = input.currency?.trim().toUpperCase() || null;
  const provider = input.provider?.trim().toLowerCase() || null;

  const candidates = listGeoPaymentMethods({
    country: country ?? undefined,
    currency: currency ?? undefined,
    methodType,
    includePlanned: false,
  }).filter((o) => o.status === 'AVAILABLE' || o.status === 'RESTRICTED');

  const match = candidates.find((o) => {
    if (o.methodType !== methodType) return false;
    if (methodType === 'MOBILE_MONEY') {
      if (!brand || !o.brand) return false;
      if (o.brand.toUpperCase() !== brand) return false;
    }
    if (provider && !o.providers.map((p) => p.toLowerCase()).includes(provider)) {
      return false;
    }
    return true;
  });

  if (!match) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      `Payment method ${methodType}${brand ? `/${brand}` : ''} not allowed for geo ${country ?? '*'} / ${currency ?? '*'}`,
      [
        {
          code: 'GEO_PAYMENT_METHOD_NOT_ALLOWED',
          methodType,
          brand,
          country,
          currency,
          provider,
        },
      ],
    );
  }

  if (match.status === 'RESTRICTED' && methodType === 'MANUAL') {
    // Allowed but flagged — caller may require elevated ops.
    return match;
  }

  return match;
}
