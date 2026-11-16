import { describe, expect, it } from 'vitest';
import { assertFormSchemaDefinitionPublishable } from './form-validation.js';
import { parseRequiredConsents } from '../marketing/marketing-consent.js';
import {
  PRODUCT_ACQUISITION_CONTRACT_CODES,
  getProductAcquisitionContract,
  listProductAcquisitionContracts,
} from './product-acquisition-contracts.js';

describe('product-acquisition-contracts', () => {
  it('exposes the four versioned product contract codes', () => {
    expect(PRODUCT_ACQUISITION_CONTRACT_CODES).toEqual(
      expect.arrayContaining([
        'pharmacy.retail.v1',
        'restaurant.hospitality.v1',
        'retail.commerce.v1',
        'enterprise.deployment.v1',
      ]),
    );
    expect(PRODUCT_ACQUISITION_CONTRACT_CODES).toHaveLength(4);
    expect(listProductAcquisitionContracts()).toHaveLength(4);
  });

  it('each contract template is publishable and declares consents + document types', () => {
    for (const code of PRODUCT_ACQUISITION_CONTRACT_CODES) {
      const contract = getProductAcquisitionContract(code);
      expect(contract).not.toBeNull();
      expect(contract!.contractCode).toBe(code);
      expect(Array.isArray(contract!.schemaDefinition.fields)).toBe(true);
      expect(contract!.schemaDefinition.fields!.length).toBeGreaterThan(0);
      expect(Array.isArray(contract!.schemaDefinition.sections)).toBe(true);
      expect(contract!.requiredDocumentTypes.length).toBeGreaterThan(0);
      expect(contract!.requiredConsents.length).toBeGreaterThan(0);

      expect(() =>
        assertFormSchemaDefinitionPublishable(
          contract!.schemaDefinition,
          contract!.conditionRules,
        ),
      ).not.toThrow();

      expect(() => parseRequiredConsents(contract!.requiredConsents)).not.toThrow();
      expect(() =>
        parseRequiredConsents(contract!.schemaDefinition.requiredConsents as unknown[]),
      ).not.toThrow();
    }
  });

  it('returns null for unknown contract codes', () => {
    expect(getProductAcquisitionContract('unknown.vertical.v9')).toBeNull();
    expect(getProductAcquisitionContract('')).toBeNull();
  });
});
