export interface TenantProfileFields {
  readonly legalName: string | null;
  readonly displayName: string | null;
  readonly tradeName: string | null;
  readonly description: string | null;
  readonly companyType: string | null;
  readonly industry: string | null;
  readonly registrationNumber: string | null;
  readonly taxId: string | null;
  readonly commerceRegister: string | null;
  readonly legalIdentifiers: Record<string, unknown>;
  readonly logoUrl: string | null;
  readonly logoCompactUrl: string | null;
  readonly faviconUrl: string | null;
  readonly country: string | null;
  readonly adminRegion: string | null;
  readonly city: string | null;
  readonly addressLine1: string | null;
  readonly addressLine2: string | null;
  readonly postalCode: string | null;
  readonly phone: string | null;
  readonly email: string | null;
  readonly website: string | null;
  readonly timezone: string;
  readonly locale: string;
  readonly defaultCurrency: string;
  readonly defaultLanguage: string;
  readonly dateFormat: string;
  readonly timeFormat: string;
  readonly numberFormat: string;
  readonly fiscalCalendar: string;
  readonly fiscalYearStartMonth: number;
  readonly fiscalYearStartDay: number;
  readonly primaryContactName: string | null;
  readonly primaryContactEmail: string | null;
  readonly primaryContactPhone: string | null;
  readonly planReference: string | null;
  readonly defaultOrganizationId: string | null;
  readonly primaryEstablishmentId: string | null;
  readonly referenceOrganizationId: string | null;
}

export interface TenantProfileUpdate {
  legalName?: string | null;
  displayName?: string | null;
  tradeName?: string | null;
  description?: string | null;
  companyType?: string | null;
  industry?: string | null;
  registrationNumber?: string | null;
  taxId?: string | null;
  commerceRegister?: string | null;
  legalIdentifiers?: Record<string, unknown>;
  logoUrl?: string | null;
  logoCompactUrl?: string | null;
  faviconUrl?: string | null;
  country?: string | null;
  adminRegion?: string | null;
  city?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  postalCode?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  timezone?: string;
  locale?: string;
  defaultCurrency?: string;
  defaultLanguage?: string;
  dateFormat?: string;
  timeFormat?: string;
  numberFormat?: string;
  fiscalCalendar?: string;
  fiscalYearStartMonth?: number;
  fiscalYearStartDay?: number;
  primaryContactName?: string | null;
  primaryContactEmail?: string | null;
  primaryContactPhone?: string | null;
  planReference?: string | null;
  defaultOrganizationId?: string | null;
  primaryEstablishmentId?: string | null;
  referenceOrganizationId?: string | null;
}

/** Shared SELECT list for tenants table (control plane). */
export const TENANT_SELECT_COLUMNS = `
  id, slug, status, database_host, database_port, database_name, database_username,
  database_credentials_ref, region, environment,
  legal_name, display_name, trade_name, description, company_type, industry,
  registration_number, tax_id, commerce_register, legal_identifiers,
  logo_url, logo_compact_url, favicon_url,
  country, admin_region, city, address_line1, address_line2, postal_code,
  phone, email, website,
  timezone, locale, default_currency, default_language,
  date_format, time_format, number_format,
  fiscal_calendar, fiscal_year_start_month, fiscal_year_start_day,
  primary_contact_name, primary_contact_email, primary_contact_phone,
  plan_reference, plan_id,
  max_organizations_override, max_users_override,
  max_customers_override, max_products_override,
  keycloak_realm,
  provisioning_step, failure_reason, failure_step, last_attempt_at, retry_count,
  default_organization_id, primary_establishment_id, reference_organization_id,
  provision_idempotency_key,
  created_at, updated_at
`;

export const TENANT_PROFILE_COLUMN_MAP: Record<keyof TenantProfileUpdate, string> = {
  legalName: 'legal_name',
  displayName: 'display_name',
  tradeName: 'trade_name',
  description: 'description',
  companyType: 'company_type',
  industry: 'industry',
  registrationNumber: 'registration_number',
  taxId: 'tax_id',
  commerceRegister: 'commerce_register',
  legalIdentifiers: 'legal_identifiers',
  logoUrl: 'logo_url',
  logoCompactUrl: 'logo_compact_url',
  faviconUrl: 'favicon_url',
  country: 'country',
  adminRegion: 'admin_region',
  city: 'city',
  addressLine1: 'address_line1',
  addressLine2: 'address_line2',
  postalCode: 'postal_code',
  phone: 'phone',
  email: 'email',
  website: 'website',
  timezone: 'timezone',
  locale: 'locale',
  defaultCurrency: 'default_currency',
  defaultLanguage: 'default_language',
  dateFormat: 'date_format',
  timeFormat: 'time_format',
  numberFormat: 'number_format',
  fiscalCalendar: 'fiscal_calendar',
  fiscalYearStartMonth: 'fiscal_year_start_month',
  fiscalYearStartDay: 'fiscal_year_start_day',
  primaryContactName: 'primary_contact_name',
  primaryContactEmail: 'primary_contact_email',
  primaryContactPhone: 'primary_contact_phone',
  planReference: 'plan_reference',
  defaultOrganizationId: 'default_organization_id',
  primaryEstablishmentId: 'primary_establishment_id',
  referenceOrganizationId: 'reference_organization_id',
};
