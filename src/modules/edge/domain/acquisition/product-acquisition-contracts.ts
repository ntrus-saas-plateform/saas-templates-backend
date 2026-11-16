/**
 * Product-owned acquisition contract templates (versioned declarative definitions).
 * Controllers must not switch on vertical rules — they instantiate via contractCode.
 */

import type { FormFieldDefinition, FormSchemaDefinition } from './acquisition.types.js';
import type { RequiredConsentDefinition } from '../marketing/marketing-consent.js';

export type ProductAcquisitionDocumentType = {
  code: string;
  name: string;
  documentType: string;
  required?: boolean;
  description?: string | null;
};

export type ProductAcquisitionContractTemplate = {
  contractCode: string;
  name: string;
  description: string;
  schemaDefinition: FormSchemaDefinition;
  conditionRules: unknown[];
  requiredDocumentTypes: ProductAcquisitionDocumentType[];
  requiredConsents: RequiredConsentDefinition[];
};

function consent(
  purpose: string,
  channel: string,
  textVersion: string,
  extras?: Partial<RequiredConsentDefinition>,
): RequiredConsentDefinition {
  return { purpose, channel, textVersion, mandatory: true, ...extras };
}

function field(def: FormFieldDefinition): FormFieldDefinition {
  return def;
}

function buildSchema(input: {
  sections: Array<{ key: string; title: string; fields: FormFieldDefinition[] }>;
  requiredConsents: RequiredConsentDefinition[];
  requiredDocumentTypes: ProductAcquisitionDocumentType[];
  extra?: Record<string, unknown>;
}): FormSchemaDefinition {
  const fields = input.sections.flatMap((s) => s.fields);
  return {
    sections: input.sections,
    fields,
    requiredConsents: input.requiredConsents,
    requiredDocumentTypes: input.requiredDocumentTypes,
    ...(input.extra ?? {}),
  };
}

const PHARMACY_RETAIL_V1: ProductAcquisitionContractTemplate = {
  contractCode: 'pharmacy.retail.v1',
  name: 'Pharmacy retail acquisition',
  description: 'Licensed pharmacy onboarding for retail subscription acquisition',
  requiredConsents: [
    consent('acquisition_processing', 'WEB', 'pharmacy.retail.v1.processing.2026-01'),
    consent('marketing_updates', 'EMAIL', 'pharmacy.retail.v1.marketing.2026-01', {
      mandatory: false,
    }),
  ],
  requiredDocumentTypes: [
    {
      code: 'pharmacy_license',
      name: 'Pharmacy license',
      documentType: 'PHARMACY_LICENSE',
      required: true,
      description: 'Valid pharmacy operating license',
    },
    {
      code: 'pharmacist_id',
      name: 'Pharmacist ID',
      documentType: 'PROFESSIONAL_ID',
      required: true,
    },
  ],
  conditionRules: [],
  schemaDefinition: buildSchema({
    sections: [
      {
        key: 'business',
        title: 'Pharmacy details',
        fields: [
          field({ key: 'legalName', type: 'short_text', label: 'Legal name', required: true }),
          field({ key: 'tradingName', type: 'short_text', label: 'Trading name', required: false }),
          field({ key: 'email', type: 'email', label: 'Contact email', required: true }),
          field({
            key: 'pharmacyType',
            type: 'select',
            label: 'Pharmacy type',
            required: true,
            options: ['independent', 'chain', 'hospital_outpatient'],
          }),
          field({
            key: 'licenseNumber',
            type: 'short_text',
            label: 'License number',
            required: true,
          }),
          field({
            key: 'country',
            type: 'country',
            label: 'Country',
            required: true,
          }),
          field({
            key: 'address',
            type: 'address',
            label: 'Premises address',
            required: true,
          }),
          field({
            key: 'outletCount',
            type: 'number',
            label: 'Number of outlets',
            required: true,
            min: 1,
            max: 5000,
          }),
        ],
      },
      {
        key: 'documents',
        title: 'Supporting documents',
        fields: [
          field({
            key: 'licenseScan',
            type: 'file_upload',
            label: 'License scan',
            required: true,
          }),
          field({
            key: 'chainAgreement',
            type: 'file_upload',
            label: 'Chain agreement',
            required: true,
            condition: { op: 'EQ', field: 'pharmacyType', value: 'chain' },
          }),
        ],
      },
    ],
    requiredConsents: [
      consent('acquisition_processing', 'WEB', 'pharmacy.retail.v1.processing.2026-01'),
      consent('marketing_updates', 'EMAIL', 'pharmacy.retail.v1.marketing.2026-01', {
        mandatory: false,
      }),
    ],
    requiredDocumentTypes: [
      {
        code: 'pharmacy_license',
        name: 'Pharmacy license',
        documentType: 'PHARMACY_LICENSE',
        required: true,
      },
      {
        code: 'pharmacist_id',
        name: 'Pharmacist ID',
        documentType: 'PROFESSIONAL_ID',
        required: true,
      },
    ],
    extra: { contractCode: 'pharmacy.retail.v1', vertical: 'pharmacy' },
  }),
};

const RESTAURANT_HOSPITALITY_V1: ProductAcquisitionContractTemplate = {
  contractCode: 'restaurant.hospitality.v1',
  name: 'Restaurant hospitality acquisition',
  description: 'Restaurant / hospitality venue acquisition form',
  requiredConsents: [
    consent('acquisition_processing', 'WEB', 'restaurant.hospitality.v1.processing.2026-01'),
  ],
  requiredDocumentTypes: [
    {
      code: 'food_hygiene_cert',
      name: 'Food hygiene certificate',
      documentType: 'HYGIENE_CERTIFICATE',
      required: true,
    },
    {
      code: 'premises_lease',
      name: 'Premises lease or ownership proof',
      documentType: 'PREMISES_PROOF',
      required: false,
    },
  ],
  conditionRules: [],
  schemaDefinition: buildSchema({
    sections: [
      {
        key: 'venue',
        title: 'Venue',
        fields: [
          field({ key: 'venueName', type: 'short_text', label: 'Venue name', required: true }),
          field({ key: 'email', type: 'email', label: 'Manager email', required: true }),
          field({
            key: 'serviceModel',
            type: 'select',
            label: 'Service model',
            required: true,
            options: ['dine_in', 'takeaway', 'delivery', 'hybrid'],
          }),
          field({
            key: 'covers',
            type: 'number',
            label: 'Seating capacity',
            required: true,
            min: 1,
            max: 5000,
            condition: {
              op: 'OR',
              args: [
                { op: 'EQ', field: 'serviceModel', value: 'dine_in' },
                { op: 'EQ', field: 'serviceModel', value: 'hybrid' },
              ],
            },
          }),
          field({ key: 'country', type: 'country', label: 'Country', required: true }),
          field({ key: 'address', type: 'address', label: 'Venue address', required: true }),
          field({
            key: 'menuSample',
            type: 'file_upload',
            label: 'Sample menu',
            required: false,
          }),
        ],
      },
    ],
    requiredConsents: [
      consent('acquisition_processing', 'WEB', 'restaurant.hospitality.v1.processing.2026-01'),
    ],
    requiredDocumentTypes: [
      {
        code: 'food_hygiene_cert',
        name: 'Food hygiene certificate',
        documentType: 'HYGIENE_CERTIFICATE',
        required: true,
      },
      {
        code: 'premises_lease',
        name: 'Premises lease or ownership proof',
        documentType: 'PREMISES_PROOF',
        required: false,
      },
    ],
    extra: { contractCode: 'restaurant.hospitality.v1', vertical: 'restaurant' },
  }),
};

const RETAIL_COMMERCE_V1: ProductAcquisitionContractTemplate = {
  contractCode: 'retail.commerce.v1',
  name: 'Retail commerce acquisition',
  description: 'General retail / e-commerce acquisition form',
  requiredConsents: [
    consent('acquisition_processing', 'WEB', 'retail.commerce.v1.processing.2026-01'),
    consent('partner_sharing', 'WEB', 'retail.commerce.v1.partner.2026-01', { mandatory: false }),
  ],
  requiredDocumentTypes: [
    {
      code: 'company_registration',
      name: 'Company registration',
      documentType: 'COMPANY_REGISTRATION',
      required: true,
    },
  ],
  conditionRules: [],
  schemaDefinition: buildSchema({
    sections: [
      {
        key: 'merchant',
        title: 'Merchant profile',
        fields: [
          field({ key: 'brandName', type: 'short_text', label: 'Brand name', required: true }),
          field({ key: 'email', type: 'email', label: 'Business email', required: true }),
          field({
            key: 'channelMix',
            type: 'select',
            label: 'Primary channel',
            required: true,
            options: ['storefront', 'ecommerce', 'marketplace', 'omnichannel'],
          }),
          field({
            key: 'skuCount',
            type: 'number',
            label: 'Approximate SKU count',
            required: true,
            min: 1,
            max: 10_000_000,
          }),
          field({
            key: 'monthlyGmvBand',
            type: 'select',
            label: 'Monthly GMV band',
            required: true,
            options: ['lt_50k', '50k_250k', '250k_1m', 'gt_1m'],
          }),
          field({ key: 'country', type: 'country', label: 'HQ country', required: true }),
          field({ key: 'address', type: 'address', label: 'Billing address', required: true }),
          field({
            key: 'catalogExport',
            type: 'file_upload',
            label: 'Catalog sample',
            required: false,
            condition: {
              op: 'OR',
              args: [
                { op: 'EQ', field: 'channelMix', value: 'ecommerce' },
                { op: 'EQ', field: 'channelMix', value: 'marketplace' },
                { op: 'EQ', field: 'channelMix', value: 'omnichannel' },
              ],
            },
          }),
        ],
      },
    ],
    requiredConsents: [
      consent('acquisition_processing', 'WEB', 'retail.commerce.v1.processing.2026-01'),
      consent('partner_sharing', 'WEB', 'retail.commerce.v1.partner.2026-01', {
        mandatory: false,
      }),
    ],
    requiredDocumentTypes: [
      {
        code: 'company_registration',
        name: 'Company registration',
        documentType: 'COMPANY_REGISTRATION',
        required: true,
      },
    ],
    extra: { contractCode: 'retail.commerce.v1', vertical: 'retail' },
  }),
};

const ENTERPRISE_DEPLOYMENT_V1: ProductAcquisitionContractTemplate = {
  contractCode: 'enterprise.deployment.v1',
  name: 'Enterprise deployment acquisition',
  description: 'Enterprise quote-first deployment acquisition',
  requiredConsents: [
    consent('acquisition_processing', 'WEB', 'enterprise.deployment.v1.processing.2026-01'),
    consent('security_review_share', 'WEB', 'enterprise.deployment.v1.security.2026-01'),
  ],
  requiredDocumentTypes: [
    {
      code: 'security_questionnaire',
      name: 'Security questionnaire',
      documentType: 'SECURITY_QUESTIONNAIRE',
      required: true,
    },
    {
      code: 'msa_draft',
      name: 'MSA / legal pack',
      documentType: 'LEGAL_PACK',
      required: false,
    },
  ],
  conditionRules: [],
  schemaDefinition: buildSchema({
    sections: [
      {
        key: 'organization',
        title: 'Organization',
        fields: [
          field({
            key: 'organizationName',
            type: 'short_text',
            label: 'Organization name',
            required: true,
          }),
          field({ key: 'email', type: 'email', label: 'Procurement email', required: true }),
          field({
            key: 'employeeBand',
            type: 'select',
            label: 'Employee band',
            required: true,
            options: ['100_499', '500_1999', '2000_9999', '10000_plus'],
          }),
          field({
            key: 'deploymentRegions',
            type: 'number',
            label: 'Deployment regions',
            required: true,
            min: 1,
            max: 200,
          }),
          field({
            key: 'quoteRequired',
            type: 'select',
            label: 'Quote required',
            required: true,
            options: ['yes', 'no'],
          }),
          field({
            key: 'estimatedSeats',
            type: 'number',
            label: 'Estimated seats',
            required: true,
            min: 1,
            max: 1_000_000,
            condition: { op: 'EQ', field: 'quoteRequired', value: 'yes' },
          }),
          field({ key: 'country', type: 'country', label: 'Primary country', required: true }),
          field({
            key: 'billingAddress',
            type: 'address',
            label: 'Billing address',
            required: true,
          }),
          field({
            key: 'architectureBrief',
            type: 'file_upload',
            label: 'Architecture brief',
            required: false,
          }),
        ],
      },
    ],
    requiredConsents: [
      consent('acquisition_processing', 'WEB', 'enterprise.deployment.v1.processing.2026-01'),
      consent('security_review_share', 'WEB', 'enterprise.deployment.v1.security.2026-01'),
    ],
    requiredDocumentTypes: [
      {
        code: 'security_questionnaire',
        name: 'Security questionnaire',
        documentType: 'SECURITY_QUESTIONNAIRE',
        required: true,
      },
      {
        code: 'msa_draft',
        name: 'MSA / legal pack',
        documentType: 'LEGAL_PACK',
        required: false,
      },
    ],
    extra: {
      contractCode: 'enterprise.deployment.v1',
      vertical: 'enterprise',
      priceDisplayHint: 'ENTERPRISE_CUSTOM',
    },
  }),
};

export const PRODUCT_ACQUISITION_CONTRACTS: Readonly<
  Record<string, ProductAcquisitionContractTemplate>
> = {
  'pharmacy.retail.v1': PHARMACY_RETAIL_V1,
  'restaurant.hospitality.v1': RESTAURANT_HOSPITALITY_V1,
  'retail.commerce.v1': RETAIL_COMMERCE_V1,
  'enterprise.deployment.v1': ENTERPRISE_DEPLOYMENT_V1,
};

export const PRODUCT_ACQUISITION_CONTRACT_CODES = Object.keys(
  PRODUCT_ACQUISITION_CONTRACTS,
) as readonly string[];

export function getProductAcquisitionContract(
  contractCode: string,
): ProductAcquisitionContractTemplate | null {
  const key = contractCode?.trim();
  if (!key) return null;
  return PRODUCT_ACQUISITION_CONTRACTS[key] ?? null;
}

export function listProductAcquisitionContracts(): ProductAcquisitionContractTemplate[] {
  return Object.values(PRODUCT_ACQUISITION_CONTRACTS);
}
