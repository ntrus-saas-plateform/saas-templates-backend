import { z } from 'zod';

export const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().min(1).default('0.0.0.0'),
  /** Override displayed/called API base URL (Swagger, banner). Example: https://api.example.com */
  PUBLIC_BASE_URL: z.string().url().optional(),
  PUBLIC_BASE_URL_PROTOCOL: z.enum(['http', 'https']).default('http'),
  SERVICE_NAME: z.string().min(1).default('platform-core'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // Control plane database
  CONTROL_PLANE_DB_HOST: z.string().min(1).default('localhost'),
  CONTROL_PLANE_DB_PORT: z.coerce.number().int().positive().default(5432),
  CONTROL_PLANE_DB_NAME: z.string().min(1).default('platform_control'),
  CONTROL_PLANE_DB_USER: z.string().min(1).default('platform'),
  CONTROL_PLANE_DB_PASSWORD: z.string().min(1).default('platform'),
  /** Tenant DB password on the same PostgreSQL cluster (defaults to CONTROL_PLANE_DB_PASSWORD). */
  TENANT_DB_PASSWORD: z.string().min(1).optional(),
  CONTROL_PLANE_DB_SSL: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),
  CONTROL_PLANE_DB_SSL_REJECT_UNAUTHORIZED: z
    .string()
    .transform((v) => v === 'true')
    .default('true'),

  // Redis
  REDIS_HOST: z.string().min(1).default('localhost'),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.coerce.number().int().min(0).default(0),

  // RabbitMQ
  RABBITMQ_URL: z.string().min(1).default('amqp://platform:platform@localhost:5672'),
  RABBITMQ_EXCHANGE: z.string().min(1).default('platform.events'),
  RABBITMQ_CONSUMER_ENABLED: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),
  RABBITMQ_MAX_RETRIES: z.coerce.number().int().min(0).max(10).default(3),
  RABBITMQ_PREFETCH: z.coerce.number().int().positive().default(10),

  // Observability / ops
  METRICS_AUTH_TOKEN: z.string().optional(),
  SWAGGER_ENABLED: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),

  // Keycloak (local default: host-mapped Keycloak on :8181)
  KEYCLOAK_ISSUER: z.string().url().default('http://localhost:8181/realms/platform'),
  KEYCLOAK_JWKS_URI: z.string().url().default('http://localhost:8181/realms/platform/protocol/openid-connect/certs'),
  KEYCLOAK_AUDIENCE: z.string().min(1).default('platform-api'),
  KEYCLOAK_CLIENT_ID: z.string().min(1).default('platform-api'),
  KEYCLOAK_CLIENT_SECRET: z.string().default(''),
  KEYCLOAK_B2C_CLIENT_ID: z.string().min(1).default('platform-b2c'),
  KEYCLOAK_B2C_AUDIENCE: z.string().min(1).default('platform-b2c'),
  KEYCLOAK_TOKEN_INTROSPECTION_ENABLED: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
  TOKEN_DENYLIST_ENABLED: z
    .string()
    .transform((v) => v === 'true')
    .default('true'),
  TOKEN_DENYLIST_TTL_SECONDS: z.coerce.number().int().min(60).default(86400),

  // Keycloak Admin API (Phase 4 — reconciliation, sessions)
  KEYCLOAK_ADMIN_ENABLED: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),
  KEYCLOAK_ADMIN_URL: z.string().url().default('http://localhost:8181'),
  KEYCLOAK_ADMIN_REALM: z.string().min(1).default('platform'),
  KEYCLOAK_ADMIN_CLIENT_ID: z.string().min(1).default('platform-admin'),
  KEYCLOAK_ADMIN_CLIENT_SECRET: z.string().default('platform-admin-secret'),

  // Okapi Edge Admin realm (isolated from ERP platform realm)
  EDGE_KEYCLOAK_ISSUER: z
    .string()
    .url()
    .default('http://localhost:8181/realms/edge-admin'),
  EDGE_KEYCLOAK_JWKS_URI: z
    .string()
    .url()
    .default('http://localhost:8181/realms/edge-admin/protocol/openid-connect/certs'),
  EDGE_KEYCLOAK_AUDIENCE: z.string().min(1).default('edge-admin-api'),
  EDGE_KEYCLOAK_ADMIN_REALM: z.string().min(1).default('edge-admin'),
  EDGE_KEYCLOAK_ADMIN_CLIENT_ID: z.string().min(1).default('edge-admin-api'),
  EDGE_KEYCLOAK_ADMIN_CLIENT_SECRET: z.string().default('edge-admin-api-secret'),
  EDGE_WORKSPACE_SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(28800),
  EDGE_INVITATION_TTL_HOURS: z.coerce.number().int().positive().default(72),
  PUBLIC_EDGE_APP_URL: z.string().url().default('http://localhost:3001/edge'),

  // OPA external policy engine (optional)
  OPA_ENABLED: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),
  OPA_URL: z.string().url().default('http://localhost:8181'),
  OPA_POLICY_PATH: z.string().min(1).default('platform/authz/allow'),
  OPA_TIMEOUT_MS: z.coerce.number().int().min(100).max(30000).default(3000),

  // Reconciliation job (Phase 4)
  RECONCILIATION_JOB_ENABLED: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),
  RECONCILIATION_JOB_INTERVAL_SECONDS: z.coerce.number().int().min(60).default(3600),

  // Security
  /** Extra allowed browser origins; server public URL is always included automatically. */
  CORS_ORIGINS: z.string().default(''),
  RATE_LIMIT_TTL: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_LIMIT: z.coerce.number().int().positive().default(100),
  MAX_PAYLOAD_SIZE: z.string().default('1mb'),

  // Database pool
  DB_POOL_MAX: z.coerce.number().int().positive().default(10),
  DB_POOL_IDLE_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
  DB_POOL_CONNECTION_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
  DB_STATEMENT_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
  DB_POOL_EVICTION_MS: z.coerce.number().int().positive().default(600000),
  DB_POOL_MAX_TENANTS: z.coerce.number().int().positive().default(100),
  /**
   * Maximum number of PostgreSQL server connections (pg_settings max_connections).
   * Used to validate that DB_POOL_MAX * DB_POOL_MAX_TENANTS does not exceed this limit.
   * Default is intentionally high so local defaults (10×100) remain valid; set to your real PG limit in prod.
   */
  POSTGRES_MAX_CONNECTIONS: z.coerce.number().int().positive().default(2000),

  // Secrets
  SECRET_PROVIDER: z.enum(['local', 'env', 'vault']).default('env'),
  /** AES key material for secret_store encryption (env/local). Falls back to CONTROL_PLANE_DB_PASSWORD. */
  SECRET_ENCRYPTION_KEY: z.string().min(8).optional(),
  VAULT_ADDR: z.string().url().optional(),
  VAULT_TOKEN: z.string().optional(),
  VAULT_KV_MOUNT: z.string().min(1).default('secret'),
  VAULT_NAMESPACE: z.string().optional(),

  // Idempotency
  IDEMPOTENCY_TTL_SECONDS: z.coerce.number().int().positive().default(86400),

  // OpenTelemetry
  OTEL_ENABLED: z
    .string()
    .transform((v) => v === 'true')
    .default('true'),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),

  // Storage
  STORAGE_PROVIDER: z.enum(['local', 's3']).default('local'),
  S3_BUCKET: z.string().default('platform-files'),
  S3_REGION: z.string().default('auto'),
  S3_ENDPOINT: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().default(''),
  S3_SECRET_ACCESS_KEY: z.string().default(''),
  S3_FORCE_PATH_STYLE: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),

  /**
   * Invitation / transactional email.
   * - none: never send (token still returned once on create)
   * - smtp: generic SMTP (including Resend SMTP: smtp.resend.com)
   * - resend: Resend HTTP API
   * - auto: Resend API key → resend, else SMTP_HOST → smtp, else none
   */
  MAIL_PROVIDER: z.enum(['none', 'smtp', 'resend', 'auto']).default('auto'),
  /** Platform fallback From address. Prefer tenant setting notifications.mailFrom. */
  MAIL_FROM: z.string().min(1).default('Atlas <noreply@localhost>'),
  /** Platform fallback public web URL. Prefer tenant branding.publicAppUrl or primary domain. */
  PUBLIC_APP_URL: z.string().url().default('http://localhost:3001'),
  RESEND_API_KEY: z
    .string()
    .optional()
    .transform((v) => (v?.trim() ? v.trim() : undefined)),
  /** Svix signing secret from Resend webhook endpoint (`whsec_…`). */
  RESEND_WEBHOOK_SECRET: z
    .string()
    .optional()
    .transform((v) => (v?.trim() ? v.trim() : undefined)),
  /** Optional marketing From override; falls back to MAIL_FROM. */
  MARKETING_RESEND_FROM: z
    .string()
    .optional()
    .transform((v) => (v?.trim() ? v.trim() : undefined)),
  SMTP_HOST: z
    .string()
    .optional()
    .transform((v) => (v?.trim() ? v.trim() : undefined)),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),
  SMTP_USER: z
    .string()
    .optional()
    .transform((v) => (v?.trim() ? v.trim() : undefined)),
  SMTP_PASSWORD: z
    .string()
    .optional()
    .transform((v) => (v?.trim() ? v.trim() : undefined)),

  // Security - CSRF (for cookie-based sessions)
  CSRF_ENABLED: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),

  // Circuit breaker
  CIRCUIT_BREAKER_THRESHOLD: z.coerce.number().int().positive().default(5),
  CIRCUIT_BREAKER_RESET_MS: z.coerce.number().int().positive().default(30000),

  // Outbox
  OUTBOX_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(5000),

  // Edge marketing channel adapters + journey WAIT worker (P3)
  MARKETING_CHANNEL_ADAPTER: z
    .enum(['unavailable', 'logging_accepted', 'http_webhook', 'resend', 'auto'])
    .default('unavailable'),
  MARKETING_CHANNEL_WEBHOOK_URL: z.string().url().optional(),
  MARKETING_CHANNEL_WEBHOOK_TIMEOUT_MS: z.coerce.number().int().positive().default(8000),
  MARKETING_WAIT_WORKER_ENABLED: z
    .string()
    .transform((v) => v === 'true')
    .default('true'),
  MARKETING_WAIT_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(15000),
  MARKETING_WAIT_BATCH_SIZE: z.coerce.number().int().positive().default(50),

  // Edge sales e-sign + calendar adapters (P4) — default UNAVAILABLE; never invent confirmation
  SALES_SIGNATURE_ADAPTER: z
    .enum(['unavailable', 'docusign', 'hellosign', 'auto'])
    .default('unavailable'),
  DOCUSIGN_ACCESS_TOKEN: z
    .string()
    .optional()
    .transform((v) => (v?.trim() ? v.trim() : undefined)),
  DOCUSIGN_ACCOUNT_ID: z
    .string()
    .optional()
    .transform((v) => (v?.trim() ? v.trim() : undefined)),
  DOCUSIGN_BASE_URL: z
    .string()
    .url()
    .default('https://demo.docusign.net/restapi'),
  HELLOSIGN_API_KEY: z
    .string()
    .optional()
    .transform((v) => (v?.trim() ? v.trim() : undefined)),
  HELLOSIGN_CLIENT_ID: z
    .string()
    .optional()
    .transform((v) => (v?.trim() ? v.trim() : undefined)),
  HELLOSIGN_TEST_MODE: z
    .string()
    .transform((v) => v !== 'false')
    .default('true'),
  SALES_CALENDAR_ADAPTER: z
    .enum(['unavailable', 'google', 'outlook', 'auto'])
    .default('unavailable'),
  GOOGLE_CALENDAR_ACCESS_TOKEN: z
    .string()
    .optional()
    .transform((v) => (v?.trim() ? v.trim() : undefined)),
  GOOGLE_CALENDAR_ID: z.string().default('primary'),
  OUTLOOK_CALENDAR_ACCESS_TOKEN: z
    .string()
    .optional()
    .transform((v) => (v?.trim() ? v.trim() : undefined)),

  // Edge billing payment adapters (P6) — default UNAVAILABLE; never invent payment success
  BILLING_PAYMENT_ADAPTER: z
    .enum(['unavailable', 'http_webhook', 'auto'])
    .default('unavailable'),
  BILLING_PAYMENT_WEBHOOK_URL: z.string().url().optional(),
  BILLING_PAYMENT_WEBHOOK_TIMEOUT_MS: z.coerce.number().int().positive().default(8000),
  BILLING_JOBS_ENABLED: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),
  BILLING_PROCESS_DUE_INTERVAL_SECONDS: z.coerce.number().int().positive().default(3600),
  BILLING_OVERDUE_INTERVAL_SECONDS: z.coerce.number().int().positive().default(1800),

  // P7.1 provisioning authorization — default-off (C-02); Unavailable until durable
  EDGE_P7_PROVISIONING_ADAPTER: z.enum(['unavailable', 'durable']).default('unavailable'),
  /** JSON array: [{ "keyId","algorithm","publicKeyPem" }] — never private keys */
  EDGE_P7_AUTHORIZATION_PUBLIC_KEYS_JSON: z.string().optional(),
  /** Comma-separated allowed issuers; empty = any issuer still needs signature */
  EDGE_P7_AUTHORIZATION_ALLOWED_ISSUERS: z.string().optional(),
  EDGE_P5_AUTHORIZATION_STATUS_URL: z.string().url().optional(),
  EDGE_P5_AUTHORIZATION_STATUS_TIMEOUT_MS: z.coerce.number().int().positive().default(2000),

  // Push delivery (staff devices — FCM / Web Push / APNs stub)
  PUSH_DELIVERY_ENABLED: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),
  FCM_SERVER_KEY: z.string().optional(),
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().default('mailto:platform@localhost'),
  APNS_KEY_ID: z.string().optional(),
  APNS_TEAM_ID: z.string().optional(),
  APNS_PRIVATE_KEY: z.string().optional(),
  APNS_BUNDLE_ID: z.string().optional(),

  // WhatsApp Cloud API / phone KYC OTP + CRM campaign channel
  WHATSAPP_OTP_ENABLED: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  /** Approved WhatsApp template name (auth/OTP category). */
  WHATSAPP_OTP_TEMPLATE_NAME: z.string().optional(),
  WHATSAPP_OTP_TEMPLATE_LANGUAGE: z.string().default('en'),
  /** Template button: none | url | otp (Meta auth templates often use url or otp). */
  WHATSAPP_OTP_BUTTON_SUBTYPE: z.enum(['none', 'url', 'otp']).default('none'),
  WHATSAPP_API_VERSION: z.string().default('v21.0'),
  /** CRM campaigns: noop (default) | meta Cloud API — SMS is not supported. */
  WHATSAPP_PROVIDER: z.enum(['noop', 'meta']).default('noop'),
  /** Optional marketing/utility template for WHATSAPP campaigns. */
  WHATSAPP_CAMPAIGN_TEMPLATE_NAME: z.string().optional(),
  WHATSAPP_CAMPAIGN_TEMPLATE_LANGUAGE: z.string().default('en'),
  /** Meta app secret for X-Hub-Signature-256 on marketing WhatsApp webhooks. */
  WHATSAPP_APP_SECRET: z
    .string()
    .optional()
    .transform((v) => (v?.trim() ? v.trim() : undefined)),
  /** Verify token echoed during Meta webhook subscription handshake. */
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: z
    .string()
    .optional()
    .transform((v) => (v?.trim() ? v.trim() : undefined)),

  // Domain registry
  /**
   * Base domain for automatic subdomain provisioning.
   * When set, tenant provisioning creates a primary SUBDOMAIN entry `{slug}.{TENANT_BASE_DOMAIN}`.
   * Example: `example.com` → tenant slug `acme` gets `acme.example.com`.
   */
  TENANT_BASE_DOMAIN: z.string().optional(),

  /**
   * When true, SUSPENDED tenants are allowed read (GET) requests through TenantGuard.
   * Mutations are always blocked by TenantWritableGuard regardless of this flag.
   */
  TENANT_SUSPENDED_ALLOW_READS: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),

  /**
   * When true, TenantHostGuard prefers X-Forwarded-Host over Host.
   * Enable only behind a reverse proxy that overwrites/strips client-supplied X-Forwarded-Host.
   */
  TRUST_X_FORWARDED_HOST: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),

  /**
   * When true, PermissionGuard denies handlers without @RequirePermissions/@RequireRoles
   * (except @Public / customer routes). Unset → true in production|staging, false otherwise.
   */
  AUTH_PERMISSION_DENY_BY_DEFAULT: z
    .string()
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),

  /**
   * When true, CapabilityGuard allows orgs with no business profile (legacy tenants).
   * Production should keep false (fail-closed).
   */
  BUSINESS_CONFIG_LEGACY_CAPABILITY_BYPASS: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),
}).superRefine((data, ctx) => {
  if (data.NODE_ENV === 'production' && !data.METRICS_AUTH_TOKEN) {
    ctx.addIssue({
      code: 'custom',
      message: 'METRICS_AUTH_TOKEN is required in production',
      path: ['METRICS_AUTH_TOKEN'],
    });
  }

  const totalPoolConnections = data.DB_POOL_MAX * data.DB_POOL_MAX_TENANTS;
  if (totalPoolConnections > data.POSTGRES_MAX_CONNECTIONS) {
    ctx.addIssue({
      code: 'custom',
      message:
        `DB_POOL_MAX (${data.DB_POOL_MAX}) * DB_POOL_MAX_TENANTS (${data.DB_POOL_MAX_TENANTS}) = ` +
        `${totalPoolConnections} exceeds POSTGRES_MAX_CONNECTIONS (${data.POSTGRES_MAX_CONNECTIONS}). ` +
        `Reduce pool sizes or increase POSTGRES_MAX_CONNECTIONS.`,
      path: ['DB_POOL_MAX'],
    });
  }

  if (data.SECRET_PROVIDER === 'vault') {
    if (!data.VAULT_ADDR) {
      ctx.addIssue({
        code: 'custom',
        message: 'VAULT_ADDR is required when SECRET_PROVIDER=vault',
        path: ['VAULT_ADDR'],
      });
    }
    if (!data.VAULT_TOKEN) {
      ctx.addIssue({
        code: 'custom',
        message: 'VAULT_TOKEN is required when SECRET_PROVIDER=vault',
        path: ['VAULT_TOKEN'],
      });
    }
  }

  if (
    data.NODE_ENV === 'production' &&
    (data.SECRET_PROVIDER === 'env' || data.SECRET_PROVIDER === 'local') &&
    !data.SECRET_ENCRYPTION_KEY
  ) {
    ctx.addIssue({
      code: 'custom',
      message:
        'SECRET_ENCRYPTION_KEY is required in production when SECRET_PROVIDER=env|local (do not rely on CONTROL_PLANE_DB_PASSWORD)',
      path: ['SECRET_ENCRYPTION_KEY'],
    });
  }
});

export type EnvironmentConfig = z.infer<typeof environmentSchema> & {
  readonly TENANT_DB_PASSWORD: string;
  readonly AUTH_PERMISSION_DENY_BY_DEFAULT: boolean;
};

export function parseEnvironment(env: Record<string, string | undefined>): EnvironmentConfig {
  const result = environmentSchema.safeParse(env);
  if (!result.success) {
    const formatted = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${formatted}`);
  }

  const introspectionExplicit = env.KEYCLOAK_TOKEN_INTROSPECTION_ENABLED !== undefined;
  const denyByDefaultExplicit = env.AUTH_PERMISSION_DENY_BY_DEFAULT !== undefined;

  return {
    ...result.data,
    TENANT_DB_PASSWORD: result.data.TENANT_DB_PASSWORD ?? result.data.CONTROL_PLANE_DB_PASSWORD,
    KEYCLOAK_TOKEN_INTROSPECTION_ENABLED: introspectionExplicit
      ? result.data.KEYCLOAK_TOKEN_INTROSPECTION_ENABLED
      : result.data.NODE_ENV === 'production',
    AUTH_PERMISSION_DENY_BY_DEFAULT: denyByDefaultExplicit
      ? Boolean(result.data.AUTH_PERMISSION_DENY_BY_DEFAULT)
      : result.data.NODE_ENV === 'production' || result.data.NODE_ENV === 'staging',
  };
}
