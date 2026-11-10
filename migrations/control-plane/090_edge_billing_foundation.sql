-- Migration 090: P6 — Billing foundation (accounts, parties, profiles, schedules, periods)
-- Invoicing, tax, and payments land in 091–092. No PSP vault or Hyperswitch tables.

-- ---------------------------------------------------------------------------
-- Billing accounts (aggregate root)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_billing_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_number VARCHAR(32) NOT NULL,
  commercial_account_id UUID NOT NULL REFERENCES edge_sales_commercial_accounts(id) ON DELETE RESTRICT,
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE','INACTIVE','SUSPENDED','ARCHIVED')),
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  payment_terms_days INT NOT NULL DEFAULT 30,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  CONSTRAINT edge_billing_accounts_number_key UNIQUE (account_number)
);

CREATE SEQUENCE IF NOT EXISTS edge_billing_account_number_seq START 1000;

CREATE INDEX IF NOT EXISTS idx_edge_billing_accounts_commercial
  ON edge_billing_accounts (commercial_account_id, status);

CREATE INDEX IF NOT EXISTS idx_edge_billing_accounts_status
  ON edge_billing_accounts (status, created_at DESC);

-- ---------------------------------------------------------------------------
-- Billing parties (bill-to, sold-to, payer, service recipient)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_billing_parties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_account_id UUID NOT NULL REFERENCES edge_billing_accounts(id) ON DELETE CASCADE,
  party_role VARCHAR(32) NOT NULL
    CHECK (party_role IN ('BILL_TO','SOLD_TO','PAYER','SERVICE_RECIPIENT')),
  legal_name VARCHAR(255) NOT NULL,
  tax_id VARCHAR(128),
  country VARCHAR(64),
  address JSONB NOT NULL DEFAULT '{}'::jsonb,
  email VARCHAR(320),
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE','INACTIVE')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edge_billing_parties_account
  ON edge_billing_parties (billing_account_id, party_role);

-- ---------------------------------------------------------------------------
-- Versioned billing profiles (invoice presentation snapshot source)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_billing_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_account_id UUID NOT NULL REFERENCES edge_billing_accounts(id) ON DELETE CASCADE,
  version INT NOT NULL,
  legal_name VARCHAR(255) NOT NULL,
  trade_name VARCHAR(255),
  country VARCHAR(64),
  region VARCHAR(128),
  city VARCHAR(128),
  postal_code VARCHAR(32),
  address_line1 VARCHAR(255),
  tax_identifier VARCHAR(128),
  registration_number VARCHAR(128),
  invoice_email VARCHAR(320),
  locale VARCHAR(16),
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  payment_terms_days INT NOT NULL DEFAULT 30,
  is_current BOOLEAN NOT NULL DEFAULT FALSE,
  snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_billing_profiles_account_version_key UNIQUE (billing_account_id, version)
);

CREATE INDEX IF NOT EXISTS idx_edge_billing_profiles_account_current
  ON edge_billing_profiles (billing_account_id)
  WHERE is_current = TRUE;

-- ---------------------------------------------------------------------------
-- Subscription links (many subscriptions may bill to one billing account)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_billing_account_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_account_id UUID NOT NULL REFERENCES edge_billing_accounts(id) ON DELETE CASCADE,
  subscription_id UUID NOT NULL REFERENCES edge_subscriptions(id) ON DELETE CASCADE,
  linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE','INACTIVE')),
  CONSTRAINT edge_billing_account_subscriptions_subscription_key UNIQUE (subscription_id)
);

CREATE INDEX IF NOT EXISTS idx_edge_billing_account_subscriptions_account
  ON edge_billing_account_subscriptions (billing_account_id, status);

-- ---------------------------------------------------------------------------
-- Billing schedules (cadence and next bill anchor)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_billing_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES edge_subscriptions(id) ON DELETE CASCADE,
  billing_account_id UUID NOT NULL REFERENCES edge_billing_accounts(id) ON DELETE RESTRICT,
  frequency VARCHAR(32) NOT NULL DEFAULT 'MONTHLY'
    CHECK (frequency IN (
      'MONTHLY','QUARTERLY','SEMI_ANNUAL','ANNUAL','CUSTOM','ONE_TIME'
    )),
  next_bill_at TIMESTAMPTZ,
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE','INACTIVE','PAUSED')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edge_billing_schedules_subscription
  ON edge_billing_schedules (subscription_id, status);

CREATE INDEX IF NOT EXISTS idx_edge_billing_schedules_next_bill
  ON edge_billing_schedules (next_bill_at)
  WHERE status = 'ACTIVE' AND next_bill_at IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Billing periods (billable windows; distinct from P5 service periods)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_billing_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES edge_subscriptions(id) ON DELETE CASCADE,
  billing_account_id UUID NOT NULL REFERENCES edge_billing_accounts(id) ON DELETE RESTRICT,
  period_number INT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  bill_at TIMESTAMPTZ,
  due_at TIMESTAMPTZ,
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  status VARCHAR(32) NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN','BILLED','CLOSED','WAIVED')),
  source_change_ref VARCHAR(255),
  snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (subscription_id, period_number)
);

CREATE INDEX IF NOT EXISTS idx_edge_billing_periods_account
  ON edge_billing_periods (billing_account_id, status);

CREATE INDEX IF NOT EXISTS idx_edge_billing_periods_bill_at
  ON edge_billing_periods (bill_at)
  WHERE status = 'OPEN' AND bill_at IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Permissions (platform:billing:* — Edge RBAC convention)
-- ---------------------------------------------------------------------------

INSERT INTO edge_permissions (code, description)
VALUES
  ('platform:billing:accounts:read', 'Read billing accounts'),
  ('platform:billing:accounts:create', 'Create billing accounts'),
  ('platform:billing:accounts:update', 'Update billing accounts'),
  ('platform:billing:profiles:read', 'Read billing profiles'),
  ('platform:billing:profiles:manage', 'Manage billing profiles'),
  ('platform:billing:schedules:manage', 'Manage billing schedules'),
  ('platform:billing:invoices:read', 'Read invoices'),
  ('platform:billing:invoices:preview', 'Preview draft invoices'),
  ('platform:billing:invoices:create', 'Create draft invoices'),
  ('platform:billing:invoices:approve', 'Approve invoices for issue'),
  ('platform:billing:invoices:issue', 'Issue invoices'),
  ('platform:billing:invoices:void', 'Void invoices'),
  ('platform:billing:payments:read', 'Read payments and intents'),
  ('platform:billing:payments:initiate', 'Initiate payment intents'),
  ('platform:billing:payments:confirm', 'Confirm captured payments'),
  ('platform:billing:payments:cancel', 'Cancel payment intents'),
  ('platform:billing:refunds:create', 'Create refund requests'),
  ('platform:billing:refunds:approve', 'Approve refund requests'),
  ('platform:billing:collections:manage', 'Manage collection cases and dunning'),
  ('platform:billing:reconciliation:execute', 'Execute reconciliation runs'),
  ('platform:billing:reconciliation:resolve', 'Resolve reconciliation exceptions'),
  ('platform:billing:ledger:read', 'Read financial journal entries'),
  ('platform:billing:reports:read', 'Read billing reports'),
  ('platform:billing:policies:manage', 'Manage billing policies'),
  ('platform:billing:audit:read', 'Read billing audit trails'),
  ('platform:billing:integrations:manage', 'Manage billing integration adapters')
ON CONFLICT (code) DO NOTHING;

INSERT INTO edge_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM edge_roles r
CROSS JOIN edge_permissions p
WHERE r.code = 'EDGE_PLATFORM_SUPER_ADMIN'
  AND p.code LIKE 'platform:billing:%'
ON CONFLICT DO NOTHING;

INSERT INTO edge_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM edge_roles r
INNER JOIN edge_permissions p ON p.code IN (
  'platform:billing:accounts:read',
  'platform:billing:accounts:create',
  'platform:billing:accounts:update',
  'platform:billing:profiles:read',
  'platform:billing:profiles:manage',
  'platform:billing:invoices:read',
  'platform:billing:invoices:preview',
  'platform:billing:invoices:create',
  'platform:billing:payments:read',
  'platform:billing:payments:initiate',
  'platform:billing:collections:manage',
  'platform:billing:reports:read',
  'platform:billing:ledger:read'
)
WHERE r.code = 'EDGE_PLATFORM_OPERATOR'
ON CONFLICT DO NOTHING;

INSERT INTO edge_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM edge_roles r
INNER JOIN edge_permissions p ON p.code IN (
  'platform:billing:accounts:read',
  'platform:billing:invoices:read',
  'platform:billing:payments:read',
  'platform:billing:reports:read'
)
WHERE r.code IN ('VERTICAL_OWNER', 'VERTICAL_ADMIN')
ON CONFLICT DO NOTHING;

INSERT INTO schema_migrations (version) VALUES ('090_edge_billing_foundation')
ON CONFLICT DO NOTHING;
