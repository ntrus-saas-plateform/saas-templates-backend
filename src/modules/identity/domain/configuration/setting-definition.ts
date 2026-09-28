import { z } from 'zod';

export type SettingScope = 'platform' | 'tenant' | 'organization' | 'user';
export type SettingType = 'string' | 'number' | 'boolean' | 'json';

export interface SettingDefinition {
  readonly key: string;
  readonly namespace: string;
  readonly type: SettingType;
  readonly default: unknown;
  readonly scope: SettingScope;
  readonly overrideable: boolean;
  readonly sensitive: boolean;
  readonly validation: z.ZodType;
  readonly description?: string;
}

const mfaPolicySchema = z.enum([
  'optional',
  'required',
  'required_for_admins',
  'required_for_sensitive_ops',
]);

function def(
  namespace: string,
  key: string,
  type: SettingType,
  defaultValue: unknown,
  validation: z.ZodType,
  opts?: Partial<Pick<SettingDefinition, 'overrideable' | 'sensitive' | 'scope' | 'description'>>,
): SettingDefinition {
  return {
    key,
    namespace,
    type,
    default: defaultValue,
    scope: opts?.scope ?? 'tenant',
    overrideable: opts?.overrideable ?? false,
    sensitive: opts?.sensitive ?? false,
    validation,
    description: opts?.description,
  };
}

function entries(
  defs: SettingDefinition[],
): Record<string, SettingDefinition> {
  return Object.fromEntries(defs.map((d) => [`${d.namespace}.${d.key}`, d]));
}

const MODULE_KEYS = [
  'core',
  'identity',
  'customer',
  'commerce',
  'pharmacy',
  'platform',
  'catalog',
  'pricing',
  'fulfillment',
  'inventory',
  'sales',
  'purchasing',
  'crm',
  'pos',
  'accounting',
  'hr',
  'payroll',
  'supply_chain',
  'reporting',
  'analytics',
  'documents',
  'workflow',
] as const;

const FEATURE_KEYS = [
  'invitations',
  'keycloakSync',
  'inventory.read',
  'inventory.adjustment',
  'inventory.expiration',
  'inventory.recall',
  'inventory.serial_tracking',
  'inventory.batch_tracking',
  'inventory.multi_warehouse',
  'pharmacy.dispensing',
  'pharmacy.controlled_substances',
  'commerce.pos',
  'commerce.loyalty',
  'sales.quotes',
  'purchasing.approvals',
  'enable_ctp',
  'enable_ai_replenishment',
  'enable_mobile_pos',
  'enable_loyalty',
  'enable_consignment',
] as const;

export const SETTINGS_NAMESPACES = [
  'general',
  'company',
  'localization',
  'regional',
  'currency',
  'fiscal',
  'tax',
  'numbering',
  'documents',
  'branding',
  'modules',
  'features',
  'notifications',
  'integrations',
  'security',
  'privacy',
  'compliance',
  'data',
  'storage',
  'automation',
  'workflow',
  'audit',
  'api',
  'webhooks',
  'billing',
  'advanced',
  'ui',
  'commerce',
  'sales',
  'purchasing',
  'inventory',
  'pos',
  'accounting',
  'hr',
] as const;

export type SettingsNamespaceName = (typeof SETTINGS_NAMESPACES)[number];

export const SETTING_DEFINITIONS: Readonly<Record<string, SettingDefinition>> = entries([
  // general
  def('general', 'industry', 'string', null, z.string().max(100).nullable()),
  def('general', 'companyType', 'string', null, z.string().max(100).nullable()),
  def('general', 'defaultOrganizationId', 'string', null, z.string().uuid().nullable()),
  def('general', 'primaryEstablishmentId', 'string', null, z.string().uuid().nullable()),
  def('general', 'referenceOrganizationId', 'string', null, z.string().uuid().nullable()),

  // company (operational mirrors)
  def('company', 'legalMentions', 'string', '', z.string()),
  def('company', 'termsUrl', 'string', '', z.string()),
  def('company', 'privacyPolicyUrl', 'string', '', z.string()),

  // localization
  def('localization', 'timezone', 'string', 'UTC', z.string().min(1), { overrideable: true }),
  def('localization', 'locale', 'string', 'en', z.string().min(2).max(15), { overrideable: true }),
  def('localization', 'currency', 'string', 'EUR', z.string().length(3), { overrideable: true }),
  def('localization', 'defaultLanguage', 'string', 'en', z.string().min(2).max(10), {
    overrideable: true,
  }),
  def('localization', 'languages', 'json', ['en'], z.array(z.string().min(2).max(10))),
  def('localization', 'dateFormat', 'string', 'YYYY-MM-DD', z.string().min(4).max(30), {
    overrideable: true,
  }),
  def('localization', 'timeFormat', 'string', '24h', z.enum(['12h', '24h']), { overrideable: true }),
  def('localization', 'numberFormat', 'string', '1,234.56', z.string().min(3).max(30), {
    overrideable: true,
  }),
  def('localization', 'decimalSeparator', 'string', '.', z.string().length(1)),
  def('localization', 'thousandsSeparator', 'string', ',', z.string().max(1)),
  def('localization', 'firstDayOfWeek', 'number', 1, z.number().int().min(0).max(6), {
    overrideable: true,
  }),
  def('localization', 'calendar', 'string', 'gregorian', z.string().min(3).max(40)),
  def('localization', 'addressFormat', 'string', 'default', z.string().max(50)),
  def('localization', 'phoneFormat', 'string', 'international', z.string().max(50)),
  def('localization', 'postalFormat', 'string', 'default', z.string().max(50)),

  // regional
  def('regional', 'country', 'string', null, z.string().length(2).nullable(), { overrideable: true }),
  def('regional', 'preferredRegions', 'json', [], z.array(z.string())),
  def('regional', 'addressFormatCountryRules', 'json', {}, z.record(z.string(), z.unknown())),

  // currency
  def('currency', 'primary', 'string', 'EUR', z.string().length(3), { overrideable: true }),
  def('currency', 'display', 'string', 'EUR', z.string().length(3), { overrideable: true }),
  def('currency', 'transaction', 'string', 'EUR', z.string().length(3), { overrideable: true }),
  def('currency', 'functional', 'string', 'EUR', z.string().length(3)),
  def('currency', 'reporting', 'string', 'EUR', z.string().length(3)),
  def('currency', 'secondaries', 'json', [], z.array(z.string().length(3))),
  def('currency', 'decimals', 'number', 2, z.number().int().min(0).max(6), { overrideable: true }),
  def('currency', 'roundingMode', 'string', 'half_up', z.enum(['half_up', 'half_even', 'down', 'up']), {
    overrideable: true,
  }),
  def('currency', 'fxSource', 'string', 'manual', z.string().max(50)),
  def('currency', 'fxUpdateFrequency', 'string', 'daily', z.enum(['manual', 'hourly', 'daily', 'weekly'])),

  // fiscal
  def('fiscal', 'yearStartMonth', 'number', 1, z.number().int().min(1).max(12)),
  def('fiscal', 'yearStartDay', 'number', 1, z.number().int().min(1).max(31)),
  def('fiscal', 'calendar', 'string', 'gregorian', z.string().max(40)),
  def('fiscal', 'closeRules', 'json', {}, z.record(z.string(), z.unknown())),
  def('fiscal', 'reopenAllowed', 'boolean', true, z.boolean()),
  def('fiscal', 'roundingFiscal', 'string', 'half_up', z.enum(['half_up', 'half_even', 'down', 'up'])),
  def('fiscal', 'withholdingEnabled', 'boolean', false, z.boolean()),

  // tax
  def('tax', 'pricesIncludeTax', 'boolean', false, z.boolean(), { overrideable: true }),
  def('tax', 'compoundTax', 'boolean', false, z.boolean()),
  def('tax', 'defaultJurisdiction', 'string', null, z.string().max(50).nullable(), {
    overrideable: true,
  }),
  def('tax', 'defaultCategory', 'string', null, z.string().max(50).nullable(), { overrideable: true }),
  def('tax', 'reportingEnabled', 'boolean', true, z.boolean()),

  // numbering
  def('numbering', 'manualAllowedDefault', 'boolean', false, z.boolean()),
  def('numbering', 'uniquenessScope', 'string', 'TENANT', z.enum(['TENANT', 'ORG', 'FISCAL_YEAR'])),

  // documents
  def('documents', 'defaultLanguage', 'string', 'en', z.string().min(2).max(10), { overrideable: true }),
  def('documents', 'pdfFormat', 'string', 'A4', z.enum(['A4', 'Letter']), { overrideable: true }),
  def('documents', 'printFormat', 'string', 'A4', z.enum(['A4', 'Letter', 'Receipt']), {
    overrideable: true,
  }),
  def('documents', 'watermarkEnabled', 'boolean', false, z.boolean()),
  def('documents', 'defaultFooter', 'string', '', z.string(), { overrideable: true }),
  def('documents', 'defaultLegalMentions', 'string', '', z.string(), { overrideable: true }),
  def('documents', 'defaultTerms', 'string', '', z.string(), { overrideable: true }),

  // branding
  def('branding', 'displayName', 'string', '', z.string().max(255)),
  def('branding', 'slogan', 'string', '', z.string().max(255)),
  def('branding', 'primaryColor', 'string', '#0F766E', z.string().max(20)),
  def('branding', 'secondaryColor', 'string', '#134E4A', z.string().max(20)),
  def('branding', 'themeLight', 'json', {}, z.record(z.string(), z.unknown())),
  def('branding', 'themeDark', 'json', {}, z.record(z.string(), z.unknown())),
  def('branding', 'loginBranding', 'json', {}, z.record(z.string(), z.unknown())),
  def('branding', 'emailBranding', 'json', {}, z.record(z.string(), z.unknown())),
  def('branding', 'documentBranding', 'json', {}, z.record(z.string(), z.unknown())),
  def('branding', 'pdfBranding', 'json', {}, z.record(z.string(), z.unknown())),
  def('branding', 'portalEnabled', 'boolean', false, z.boolean()),
  def('branding', 'customDomain', 'string', '', z.string().max(255)),
  def('branding', 'subdomain', 'string', '', z.string().max(100)),
  def('branding', 'publicAppUrl', 'string', '', z.string().max(2048), {
    description:
      'Public app URL for invitation and email links. Empty uses the tenant primary domain, then subdomain + TENANT_BASE_DOMAIN, then platform PUBLIC_APP_URL.',
  }),

  // modules overlays (AND with plan)
  ...MODULE_KEYS.map((k) =>
    def('modules', k, 'boolean', true, z.boolean(), {
      description: `Overlay enablement for module ${k}`,
    }),
  ),

  // features / entitlements
  ...FEATURE_KEYS.map((k) => def('features', k, 'boolean', k === 'invitations' || k === 'keycloakSync', z.boolean())),

  // notifications
  def('notifications', 'emailEnabled', 'boolean', true, z.boolean(), { overrideable: true }),
  def('notifications', 'mailFrom', 'string', '', z.string().max(320), {
    description:
      'From address for invitation and transactional email (Name <addr@domain> or addr@domain). Empty uses platform MAIL_FROM.',
  }),
  def('notifications', 'smsEnabled', 'boolean', false, z.boolean(), { overrideable: true }),
  def('notifications', 'inAppEnabled', 'boolean', true, z.boolean(), { overrideable: true }),
  def('notifications', 'pushEnabled', 'boolean', true, z.boolean(), { overrideable: true }),
  def('notifications', 'digestFrequency', 'string', 'daily', z.enum(['immediate', 'hourly', 'daily', 'weekly']), {
    overrideable: true,
  }),
  def(
    'notifications',
    'channels',
    'json',
    { email: true, sms: false, inApp: true, push: true },
    z.record(z.string(), z.boolean()),
  ),

  // integrations defaults
  def('integrations', 'defaultSyncFrequency', 'string', 'daily', z.enum(['manual', 'hourly', 'daily', 'weekly'])),
  def('integrations', 'retryPolicy', 'json', { maxRetries: 3, backoffSeconds: 60 }, z.record(z.string(), z.unknown())),

  // automation / workflow
  def('automation', 'enabled', 'boolean', true, z.boolean(), { overrideable: true }),
  def('automation', 'defaults', 'json', {}, z.record(z.string(), z.unknown()), { overrideable: true }),
  def('workflow', 'enabled', 'boolean', true, z.boolean(), { overrideable: true }),
  def('workflow', 'defaults', 'json', {}, z.record(z.string(), z.unknown()), { overrideable: true }),

  // org operational namespaces — stock/ATP SoT is inventory_policies + commercial_org_config (not these mirrors)
  def('commerce', 'pricesIncludeTax', 'boolean', false, z.boolean(), { overrideable: true }),
  def('commerce', 'defaultPaymentMethods', 'json', [], z.array(z.string()), { overrideable: true }),
  def('commerce', 'allowNegativeStock', 'boolean', false, z.boolean(), {
    overrideable: true,
    description:
      'DEPRECATED — ignored at runtime. Use inventory_policies.allow_negative_stock (PUT /inventory/policies).',
  }),
  def('sales', 'defaultPriceListId', 'string', null, z.string().uuid().nullable(), { overrideable: true }),
  def('sales', 'discountApprovalRequired', 'boolean', true, z.boolean(), { overrideable: true }),
  def('purchasing', 'purchaseApprovalRequired', 'boolean', true, z.boolean(), { overrideable: true }),
  def('purchasing', 'defaultSupplierLeadDays', 'number', 7, z.number().int().min(0).max(365), {
    overrideable: true,
  }),
  def('inventory', 'valuationMethod', 'string', 'FEFO', z.enum(['FEFO', 'FIFO', 'AVERAGE', 'STANDARD']), {
    overrideable: true,
    description:
      'DEPRECATED — ignored for allocation. Use commercial_org_config.allocation_strategy / inventory_policies.enable_fefo.',
  }),
  def('inventory', 'defaultWarehouseId', 'string', null, z.string().uuid().nullable(), {
    overrideable: true,
  }),
  def('inventory', 'allowNegativeStock', 'boolean', false, z.boolean(), {
    overrideable: true,
    description:
      'DEPRECATED — ignored at runtime. Use inventory_policies.allow_negative_stock (PUT /inventory/policies).',
  }),
  def('inventory', 'lotTrackingRequired', 'boolean', true, z.boolean(), { overrideable: true }),
  def('inventory', 'expiryTrackingRequired', 'boolean', true, z.boolean(), { overrideable: true }),
  def('pos', 'defaultTerminalId', 'string', null, z.string().uuid().nullable(), { overrideable: true }),
  def('pos', 'defaultCashRegisterId', 'string', null, z.string().uuid().nullable(), { overrideable: true }),
  def('pos', 'offlineEnabled', 'boolean', false, z.boolean(), { overrideable: true }),
  def('pos', 'receiptTemplate', 'string', 'default', z.string().max(100), { overrideable: true }),
  def('accounting', 'journalPrefix', 'string', '', z.string().max(20), { overrideable: true }),
  def('accounting', 'costCenterRequired', 'boolean', false, z.boolean(), { overrideable: true }),
  def('hr', 'leaveApprovalRequired', 'boolean', true, z.boolean(), { overrideable: true }),
  def('hr', 'defaultDepartment', 'string', '', z.string().max(150), { overrideable: true }),

  // security
  def('security', 'mfaPolicy', 'string', 'optional', mfaPolicySchema),
  def('security', 'mfaMethods', 'json', ['totp'], z.array(z.enum(['totp', 'webauthn', 'sms', 'email']))),
  def('security', 'sessionLifetimeMinutes', 'number', 480, z.number().int().min(5).max(10080)),
  def('security', 'idleTimeoutMinutes', 'number', 30, z.number().int().min(1).max(1440)),
  def('security', 'maxSessionDurationMinutes', 'number', 1440, z.number().int().min(5).max(10080)),
  def('security', 'rememberMe', 'boolean', true, z.boolean()),
  def('security', 'sessionConcurrency', 'number', 5, z.number().int().min(1).max(100)),
  def('security', 'failedLoginThreshold', 'number', 5, z.number().int().min(1).max(50)),
  def('security', 'accountLockoutMinutes', 'number', 15, z.number().int().min(1).max(1440)),
  def('security', 'passwordMinLength', 'number', 12, z.number().int().min(8).max(128)),
  def('security', 'passwordRequireUpper', 'boolean', true, z.boolean()),
  def('security', 'passwordRequireNumber', 'boolean', true, z.boolean()),
  def('security', 'passwordRequireSymbol', 'boolean', true, z.boolean()),
  def('security', 'ipAllowlist', 'json', [], z.array(z.string())),
  def('security', 'ipDenylist', 'json', [], z.array(z.string())),
  def('security', 'countryRestrictions', 'json', [], z.array(z.string().length(2))),
  def('security', 'organizationRestrictions', 'json', [], z.array(z.string().uuid())),
  def('security', 'devicePolicies', 'json', {}, z.record(z.string(), z.unknown())),
  def('security', 'browserPolicies', 'json', {}, z.record(z.string(), z.unknown())),
  def('security', 'suspiciousLoginDetection', 'boolean', true, z.boolean()),
  def('security', 'ssoProviders', 'json', [], z.array(z.enum(['google', 'microsoft', 'apple', 'ldap', 'ad', 'saml', 'oidc']))),

  // privacy
  def('privacy', 'dataRetentionDays', 'number', 365, z.number().int().min(30).max(3650)),
  def('privacy', 'logRetentionDays', 'number', 90, z.number().int().min(7).max(1825)),
  def('privacy', 'auditRetentionDays', 'number', 365, z.number().int().min(30).max(3650)),
  def('privacy', 'exportEnabled', 'boolean', true, z.boolean()),
  def('privacy', 'deletionEnabled', 'boolean', true, z.boolean()),
  def('privacy', 'anonymizationEnabled', 'boolean', true, z.boolean()),
  def('privacy', 'privacyPolicyUrl', 'string', '', z.string()),
  def('privacy', 'consentRequired', 'boolean', false, z.boolean()),
  def('privacy', 'dataProcessingPolicies', 'json', {}, z.record(z.string(), z.unknown())),
  def('privacy', 'legalHold', 'boolean', false, z.boolean()),

  // compliance
  def('compliance', 'frameworks', 'json', [], z.array(z.string())),
  def('compliance', 'policyDocumentRefs', 'json', [], z.array(z.string())),
  def('compliance', 'hipaaMode', 'boolean', false, z.boolean()),

  // data
  def('data', 'autoBackupEnabled', 'boolean', true, z.boolean()),
  def('data', 'backupFrequency', 'string', 'daily', z.enum(['hourly', 'daily', 'weekly'])),
  def('data', 'purgeAfterDays', 'number', 0, z.number().int().min(0).max(3650)),
  def('data', 'migrationStatus', 'string', 'ready', z.string().max(50)),

  // storage
  def('storage', 'softQuotaGb', 'number', 10, z.number().min(0)),
  def('storage', 'warnAtPercent', 'number', 80, z.number().min(1).max(100)),

  // audit
  def('audit', 'retentionDays', 'number', 365, z.number().int().min(30).max(3650)),
  def('audit', 'exportEnabled', 'boolean', true, z.boolean()),

  // api
  def('api', 'defaultRateLimit', 'number', 1000, z.number().int().min(10).max(1_000_000)),
  def('api', 'allowedOrigins', 'json', [], z.array(z.string())),
  def('api', 'defaultApiVersion', 'string', 'v1', z.string().max(10)),

  // webhooks
  def('webhooks', 'retryPolicy', 'json', { maxRetries: 5, backoffSeconds: 30 }, z.record(z.string(), z.unknown())),
  def('webhooks', 'signingEnabled', 'boolean', true, z.boolean()),

  // billing
  def('billing', 'billingContactName', 'string', '', z.string().max(255)),
  def('billing', 'billingContactEmail', 'string', '', z.string().email().or(z.literal(''))),
  def('billing', 'renewalDay', 'number', 1, z.number().int().min(1).max(28)),
  def('billing', 'currency', 'string', 'EUR', z.string().length(3)),
  def('billing', 'paymentMethods', 'json', [], z.array(z.record(z.string(), z.unknown()))),

  // advanced
  def('advanced', 'experimentalFeatures', 'boolean', false, z.boolean()),
  def('advanced', 'debugMode', 'boolean', false, z.boolean()),
  def('advanced', 'customJson', 'json', {}, z.record(z.string(), z.unknown())),

  // ui (legacy)
  def('ui', 'theme', 'string', 'system', z.enum(['system', 'light', 'dark']), { overrideable: true }),
  def('ui', 'density', 'string', 'comfortable', z.enum(['compact', 'comfortable', 'spacious']), {
    overrideable: true,
  }),
]);

export function validateSettingValue(fullKey: string, value: unknown): unknown {
  const definition = SETTING_DEFINITIONS[fullKey];
  if (!definition) return value;
  return definition.validation.parse(value);
}

export function getNamespaceSettingKeys(namespace: string): readonly string[] {
  return Object.keys(SETTING_DEFINITIONS).filter((k) => k.startsWith(`${namespace}.`));
}

export function getSettingsCatalog(): Array<{
  namespace: string;
  keys: Array<{
    key: string;
    type: SettingType;
    default: unknown;
    overrideable: boolean;
    sensitive: boolean;
    description?: string;
  }>;
}> {
  const byNs = new Map<string, SettingDefinition[]>();
  for (const defn of Object.values(SETTING_DEFINITIONS)) {
    const list = byNs.get(defn.namespace) ?? [];
    list.push(defn);
    byNs.set(defn.namespace, list);
  }
  return [...byNs.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([namespace, defs]) => ({
      namespace,
      keys: defs.map((d) => ({
        key: d.key,
        type: d.type,
        default: d.default,
        overrideable: d.overrideable,
        sensitive: d.sensitive,
        description: d.description,
      })),
    }));
}
