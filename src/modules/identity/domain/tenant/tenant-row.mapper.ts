import type { Tenant, TenantProvisioningStep, TenantStatus } from './tenant.entity.js';

export interface TenantRow {
  id: string;
  slug: string;
  status: TenantStatus;
  database_host: string;
  database_port: number;
  database_name: string;
  database_username: string | null;
  database_credentials_ref: string;
  region: string;
  environment: string;
  legal_name: string | null;
  display_name: string | null;
  trade_name: string | null;
  description: string | null;
  company_type: string | null;
  industry: string | null;
  registration_number: string | null;
  tax_id: string | null;
  commerce_register: string | null;
  legal_identifiers: Record<string, unknown> | null;
  logo_url: string | null;
  logo_compact_url: string | null;
  favicon_url: string | null;
  country: string | null;
  admin_region: string | null;
  city: string | null;
  address_line1: string | null;
  address_line2: string | null;
  postal_code: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  timezone: string | null;
  locale: string | null;
  default_currency: string | null;
  default_language: string | null;
  date_format: string | null;
  time_format: string | null;
  number_format: string | null;
  fiscal_calendar: string | null;
  fiscal_year_start_month: number | null;
  fiscal_year_start_day: number | null;
  primary_contact_name: string | null;
  primary_contact_email: string | null;
  primary_contact_phone: string | null;
  plan_reference: string | null;
  plan_id: string | null;
  max_organizations_override: number | null;
  max_users_override: number | null;
  max_customers_override: number | null;
  max_products_override: number | null;
  keycloak_realm: string | null;
  provisioning_step: string | null;
  failure_reason: string | null;
  failure_step: string | null;
  last_attempt_at: Date | null;
  retry_count: number;
  default_organization_id: string | null;
  primary_establishment_id: string | null;
  reference_organization_id: string | null;
  provision_idempotency_key: string | null;
  created_at: Date;
  updated_at: Date;
}

export function mapTenantRow(row: TenantRow): Tenant {
  return {
    id: row.id,
    slug: row.slug,
    status: row.status,
    database: {
      host: row.database_host,
      port: row.database_port,
      name: row.database_name,
      username: row.database_username ?? null,
      credentialsReference: row.database_credentials_ref,
    },
    region: row.region,
    environment: row.environment,
    legalName: row.legal_name,
    displayName: row.display_name,
    tradeName: row.trade_name ?? null,
    description: row.description,
    companyType: row.company_type ?? null,
    industry: row.industry ?? null,
    registrationNumber: row.registration_number ?? null,
    taxId: row.tax_id ?? null,
    commerceRegister: row.commerce_register ?? null,
    legalIdentifiers: row.legal_identifiers ?? {},
    logoUrl: row.logo_url,
    logoCompactUrl: row.logo_compact_url ?? null,
    faviconUrl: row.favicon_url ?? null,
    country: row.country,
    adminRegion: row.admin_region ?? null,
    city: row.city ?? null,
    addressLine1: row.address_line1 ?? null,
    addressLine2: row.address_line2 ?? null,
    postalCode: row.postal_code ?? null,
    phone: row.phone ?? null,
    email: row.email ?? null,
    website: row.website ?? null,
    timezone: row.timezone ?? 'UTC',
    locale: row.locale ?? 'en',
    defaultCurrency: row.default_currency ?? 'EUR',
    defaultLanguage: row.default_language ?? 'en',
    dateFormat: row.date_format ?? 'YYYY-MM-DD',
    timeFormat: row.time_format ?? '24h',
    numberFormat: row.number_format ?? '1,234.56',
    fiscalCalendar: row.fiscal_calendar ?? 'gregorian',
    fiscalYearStartMonth: row.fiscal_year_start_month ?? 1,
    fiscalYearStartDay: row.fiscal_year_start_day ?? 1,
    primaryContactName: row.primary_contact_name ?? null,
    primaryContactEmail: row.primary_contact_email ?? null,
    primaryContactPhone: row.primary_contact_phone ?? null,
    planReference: row.plan_reference,
    planId: row.plan_id ?? null,
    maxOrganizationsOverride: row.max_organizations_override ?? null,
    maxUsersOverride: row.max_users_override ?? null,
    maxCustomersOverride: row.max_customers_override ?? null,
    maxProductsOverride: row.max_products_override ?? null,
    keycloakRealm: row.keycloak_realm ?? null,
    provisioningStep: (row.provisioning_step as TenantProvisioningStep | null) ?? null,
    failureReason: row.failure_reason ?? null,
    failureStep: row.failure_step ?? null,
    lastAttemptAt: row.last_attempt_at ?? null,
    retryCount: row.retry_count ?? 0,
    defaultOrganizationId: row.default_organization_id ?? null,
    primaryEstablishmentId: row.primary_establishment_id ?? null,
    referenceOrganizationId: row.reference_organization_id ?? null,
    provisionIdempotencyKey: row.provision_idempotency_key ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
