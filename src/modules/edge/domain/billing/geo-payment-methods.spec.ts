import { describe, expect, it } from 'vitest';
import { DomainError } from '../../../../core/domain/errors/domain-error.js';
import {
  assertPaymentMethodAllowedForGeo,
  listGeoPaymentMethods,
} from './geo-payment-methods.js';

describe('geo-payment-methods beachhead', () => {
  it('lists Mobile Money for CI / XOF', () => {
    const methods = listGeoPaymentMethods({ country: 'CI', currency: 'XOF' });
    expect(methods.some((m) => m.methodType === 'MOBILE_MONEY' && m.brand === 'MTN')).toBe(
      true,
    );
    expect(methods.some((m) => m.methodType === 'CARD')).toBe(true);
  });

  it('allows MTN Mobile Money for beachhead geo', () => {
    const offer = assertPaymentMethodAllowedForGeo({
      methodType: 'MOBILE_MONEY',
      brand: 'MTN',
      country: 'CI',
      currency: 'XOF',
      provider: 'hyperswitch',
    });
    expect(offer.code).toBe('MM_MTN_CI');
  });

  it('rejects unknown Mobile Money brand for geo', () => {
    expect(() =>
      assertPaymentMethodAllowedForGeo({
        methodType: 'MOBILE_MONEY',
        brand: 'UNKNOWN_OPERATOR',
        country: 'CI',
        currency: 'XOF',
      }),
    ).toThrow(DomainError);
  });

  it('allows international card without country filter', () => {
    const offer = assertPaymentMethodAllowedForGeo({
      methodType: 'CARD',
      currency: 'USD',
      provider: 'sandbox',
    });
    expect(offer.code).toBe('CARD_INTERNATIONAL');
  });
});
