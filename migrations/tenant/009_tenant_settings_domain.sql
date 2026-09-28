-- Migration 009: Tenant settings domain collections

CREATE TABLE IF NOT EXISTS tenant_currencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(3) NOT NULL,
  name VARCHAR(100) NOT NULL,
  decimals SMALLINT NOT NULL DEFAULT 2,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  is_secondary BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (code)
);

CREATE TABLE IF NOT EXISTS tenant_fx_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_code VARCHAR(3) NOT NULL,
  to_code VARCHAR(3) NOT NULL,
  rate NUMERIC(24, 10) NOT NULL,
  source VARCHAR(100) NOT NULL DEFAULT 'manual',
  effective_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fx_pair_effective
  ON tenant_fx_rates (from_code, to_code, effective_at DESC);

CREATE TABLE IF NOT EXISTS tenant_fiscal_years (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label VARCHAR(50) NOT NULL,
  starts_on DATE NOT NULL,
  ends_on DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN', 'CLOSED', 'LOCKED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tenant_fiscal_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fiscal_year_id UUID NOT NULL REFERENCES tenant_fiscal_years(id) ON DELETE CASCADE,
  label VARCHAR(50) NOT NULL,
  period_index SMALLINT NOT NULL,
  starts_on DATE NOT NULL,
  ends_on DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN', 'CLOSED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (fiscal_year_id, period_index)
);

CREATE TABLE IF NOT EXISTS tenant_tax_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tenant_tax_jurisdictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  country VARCHAR(2),
  region VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tenant_tax_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  rate_percent NUMERIC(8, 4) NOT NULL,
  category_id UUID REFERENCES tenant_tax_categories(id) ON DELETE SET NULL,
  jurisdiction_id UUID REFERENCES tenant_tax_jurisdictions(id) ON DELETE SET NULL,
  kind VARCHAR(30) NOT NULL DEFAULT 'VAT'
    CHECK (kind IN ('VAT', 'SALES', 'WITHHOLDING', 'EXCISE', 'OTHER')),
  is_compound BOOLEAN NOT NULL DEFAULT false,
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tenant_tax_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(150) NOT NULL,
  priority INT NOT NULL DEFAULT 100,
  jurisdiction_id UUID REFERENCES tenant_tax_jurisdictions(id) ON DELETE SET NULL,
  category_id UUID REFERENCES tenant_tax_categories(id) ON DELETE SET NULL,
  tax_rate_id UUID REFERENCES tenant_tax_rates(id) ON DELETE SET NULL,
  conditions JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tenant_tax_exemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  reason TEXT,
  certificate_ref TEXT,
  valid_from DATE,
  valid_to DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tenant_number_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type VARCHAR(30) NOT NULL,
  prefix VARCHAR(30) NOT NULL DEFAULT '',
  suffix VARCHAR(30) NOT NULL DEFAULT '',
  next_value BIGINT NOT NULL DEFAULT 1,
  pad_length SMALLINT NOT NULL DEFAULT 6,
  reset_policy VARCHAR(20) NOT NULL DEFAULT 'YEAR'
    CHECK (reset_policy IN ('NEVER', 'YEAR', 'MONTH')),
  scope VARCHAR(20) NOT NULL DEFAULT 'TENANT'
    CHECK (scope IN ('TENANT', 'ORG', 'FISCAL_YEAR')),
  organization_id UUID,
  manual_allowed BOOLEAN NOT NULL DEFAULT false,
  unique_check BOOLEAN NOT NULL DEFAULT true,
  last_reset_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (document_type, scope, organization_id)
);

INSERT INTO tenant_number_sequences (document_type, prefix, pad_length, reset_policy)
VALUES
  ('INV', 'INV-', 6, 'YEAR'),
  ('PO', 'PO-', 6, 'YEAR'),
  ('SO', 'SO-', 6, 'YEAR'),
  ('CUS', 'CUS-', 6, 'NEVER'),
  ('PRD', 'PRD-', 6, 'NEVER')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS tenant_document_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type VARCHAR(50) NOT NULL,
  language VARCHAR(10) NOT NULL DEFAULT 'en',
  name VARCHAR(150) NOT NULL,
  body_html TEXT,
  footer TEXT,
  legal_mentions TEXT,
  terms TEXT,
  logo_override_url TEXT,
  watermark TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tenant_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR(100) NOT NULL,
  category VARCHAR(50) NOT NULL
    CHECK (category IN (
      'Payment', 'Email', 'SMS', 'WhatsApp', 'Accounting', 'Banking',
      'Tax', 'Storage', 'ERP', 'CRM', 'IdentityProvider', 'Webhooks', 'BI', 'Other'
    )),
  display_name VARCHAR(150) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'DISCONNECTED'
    CHECK (status IN ('CONNECTED', 'DISCONNECTED', 'ERROR', 'PENDING')),
  health VARCHAR(30) NOT NULL DEFAULT 'UNKNOWN'
    CHECK (health IN ('HEALTHY', 'DEGRADED', 'DOWN', 'UNKNOWN')),
  last_sync_at TIMESTAMPTZ,
  sync_frequency VARCHAR(50),
  credentials_ref TEXT,
  config JSONB NOT NULL DEFAULT '{}',
  permissions JSONB NOT NULL DEFAULT '[]',
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tenant_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(150) NOT NULL,
  key_prefix VARCHAR(16) NOT NULL,
  key_hash VARCHAR(128) NOT NULL,
  scopes JSONB NOT NULL DEFAULT '[]',
  rate_limit INT,
  expires_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tenant_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL,
  events JSONB NOT NULL DEFAULT '[]',
  secret_ref TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'PAUSED', 'DISABLED')),
  allowed_origins JSONB NOT NULL DEFAULT '[]',
  last_delivery_at TIMESTAMPTZ,
  last_status_code INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tenant_oauth_apps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(150) NOT NULL,
  client_id VARCHAR(100) NOT NULL UNIQUE,
  client_secret_ref TEXT,
  redirect_uris JSONB NOT NULL DEFAULT '[]',
  scopes JSONB NOT NULL DEFAULT '[]',
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tenant_service_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(150) NOT NULL,
  description TEXT,
  scopes JSONB NOT NULL DEFAULT '[]',
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tenant_billing_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_code VARCHAR(64),
  status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'PAST_DUE', 'CANCELLED', 'TRIALING')),
  renew_at TIMESTAMPTZ,
  seats INT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tenant_billing_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number VARCHAR(50) NOT NULL UNIQUE,
  amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
  currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
  status VARCHAR(30) NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'OPEN', 'PAID', 'VOID', 'UNCOLLECTIBLE')),
  period_start DATE,
  period_end DATE,
  pdf_ref TEXT,
  issued_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tenant_data_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type VARCHAR(30) NOT NULL
    CHECK (job_type IN ('export', 'import', 'backup', 'restore', 'archive', 'purge', 'migration', 'integrity')),
  status VARCHAR(30) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED')),
  progress SMALLINT NOT NULL DEFAULT 0,
  result_ref TEXT,
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO schema_migrations (version) VALUES ('009_tenant_settings_domain') ON CONFLICT DO NOTHING;
