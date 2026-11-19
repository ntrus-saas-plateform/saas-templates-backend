import { describe, expect, it } from 'vitest';
import { EntitlementCapabilityKind } from '../subscription/subscription.entity.js';
import {
  mergeSqlCapabilityRowsIntoCatalogCapabilities,
  resolveCommercialCatalogEntitlements,
} from './resolve-commercial-catalog-entitlements.js';

describe('resolveCommercialCatalogEntitlements (universel toutes familles)', () => {
  it('résout Syntix, Restaurant, Café, Retail, Hospitality par le même helper', () => {
    const families = [
      'SYNTIX_LITE',
      'OKAPI_REST_STARTER',
      'OKAPI_REST_CAFE_CONTROLLED',
      'OKAPI_RETAIL_LITE',
      'OKAPI_HOSP_LITE',
    ];
    for (const planCode of families) {
      const caps = resolveCommercialCatalogEntitlements({ planCode });
      expect(caps.length, planCode).toBeGreaterThan(0);
    }
  });

  it('résout le package Café en fallback plan absent', () => {
    const caps = resolveCommercialCatalogEntitlements({
      packageCode: 'PKG_REST_CAFE_CONTROLLED',
    });
    expect(caps.length).toBeGreaterThan(0);
    expect(caps.some((c) => c.capabilityCode === 'max_customers')).toBe(true);
  });

  it('retourne [] sans config (pas de caps inventées)', () => {
    expect(resolveCommercialCatalogEntitlements({})).toEqual([]);
    expect(resolveCommercialCatalogEntitlements({ planCode: 'UNKNOWN_PLAN' })).toEqual([]);
  });
});

describe('mergeSqlCapabilityRowsIntoCatalogCapabilities', () => {
  const base = resolveCommercialCatalogEntitlements({ planCode: 'SYNTIX_LITE' });

  it('sans lignes SQL → snapshot TS inchangé', () => {
    expect(mergeSqlCapabilityRowsIntoCatalogCapabilities(base, [])).toEqual(base);
  });

  it('numericLimit SQL impose/ajoute la limite (gestion console)', () => {
    const merged = mergeSqlCapabilityRowsIntoCatalogCapabilities(base, [
      {
        capabilityCode: 'max_customers',
        inclusionType: 'INCLUDED',
        restrictions: { numericLimit: 777 },
      },
    ]);
    const src = merged.find((c) => c.capabilityCode === 'max_customers');
    expect(src?.numericLimit).toBe(777);
    expect(src?.kind).toBe(EntitlementCapabilityKind.QUOTA);
  });

  it('NOT_INCLUDED SQL retire la source TS', () => {
    const present = base.find((c) => c.kind === EntitlementCapabilityKind.FEATURE_FLAG);
    expect(present).toBeDefined();
    const code = present!.capabilityCode;
    const merged = mergeSqlCapabilityRowsIntoCatalogCapabilities(base, [
      { capabilityCode: code, inclusionType: 'NOT_INCLUDED', restrictions: {} },
    ]);
    expect(merged.find((c) => c.capabilityCode === code)).toBeUndefined();
    expect(merged.length).toBe(base.length - 1);
  });

  it('cap SQL absente du TS est ajoutée', () => {
    const merged = mergeSqlCapabilityRowsIntoCatalogCapabilities(base, [
      { capabilityCode: 'api', inclusionType: 'INCLUDED', restrictions: {} },
    ]);
    expect(merged.find((c) => c.capabilityCode === 'api')).toBeDefined();
  });

  it('quota SQL sans numericLimit conserve la valeur TS (pas 0)', () => {
    const merged = mergeSqlCapabilityRowsIntoCatalogCapabilities(base, [
      { capabilityCode: 'max_users', inclusionType: 'INCLUDED', restrictions: {} },
    ]);
    const src = merged.find((c) => c.capabilityCode === 'max_users');
    const orig = base.find((c) => c.capabilityCode === 'max_users');
    expect(src?.numericLimit).toBe(orig?.numericLimit);
    expect(src?.numericLimit).toBeGreaterThan(0);
  });
});
