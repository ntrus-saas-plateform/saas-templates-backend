import { describe, expect, it } from 'vitest';
import {
  EDGE_PRODUCT_FAMILY_BINDINGS,
  assertSellableOrThrow,
  bindingForProductCode,
  defaultProfileForProductCode,
  toBbProductProfileBindingsJson,
} from './product-family-bindings.js';

describe('product-family-bindings', () => {
  it('covers all ADR-055 Edge Product Tenants in roadmap', () => {
    const codes = EDGE_PRODUCT_FAMILY_BINDINGS.map((b) => b.productCode);
    expect(codes).toEqual(
      expect.arrayContaining([
        'SYNTIX_PHARMA',
        'OKAPI_RESTAURANT',
        'OKAPI_RETAIL',
        'OKAPI_HOSPITALITY',
        'OKAPI_MANUFACTURING',
        'OKAPI_EQUIPMENT_RENTAL',
      ]),
    );
  });

  it('only beachhead products are AVAILABLE', () => {
    const available = EDGE_PRODUCT_FAMILY_BINDINGS.filter(
      (b) => b.commercialAvailability === 'AVAILABLE',
    ).map((b) => b.productCode);
    expect(available.sort()).toEqual(['OKAPI_RESTAURANT', 'SYNTIX_PHARMA'].sort());
  });

  it('maps default BB profiles', () => {
    expect(defaultProfileForProductCode('SYNTIX_PHARMA')).toBe('PHARMACY');
    expect(defaultProfileForProductCode('OKAPI_RESTAURANT')).toBe('RESTAURANT');
    expect(defaultProfileForProductCode('OKAPI_RETAIL')).toBe('SUPERMARKET');
    expect(defaultProfileForProductCode('OKAPI_HOSPITALITY')).toBe('HOTEL_HOSPITALITY');
  });

  it('refuses selling PLANNED products', () => {
    const retail = bindingForProductCode('OKAPI_RETAIL')!;
    expect(() => assertSellableOrThrow(retail)).toThrow(/PRODUCT_NOT_SELLABLE/);
  });

  it('exports BB bindings JSON shape', () => {
    const parsed = JSON.parse(toBbProductProfileBindingsJson()) as Array<{
      productCode: string;
      profileCode: string;
    }>;
    expect(parsed.length).toBe(EDGE_PRODUCT_FAMILY_BINDINGS.length);
    expect(parsed.find((r) => r.productCode === 'OKAPI_HOSPITALITY')?.profileCode).toBe(
      'HOTEL_HOSPITALITY',
    );
  });
});
