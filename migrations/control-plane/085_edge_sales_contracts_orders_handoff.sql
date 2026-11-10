-- Migration 085: P4.8–P4.10 — Contracts, Sales Orders, Handoff, Forecast helpers
-- Contract EXECUTED only after signature provider confirmation.
-- Handoff never creates tenants/subscriptions directly.
-- Idempotent handoff via correlation_id + attempt dedupe.

-- ---------------------------------------------------------------------------
-- Contracts
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_sales_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_number VARCHAR(32) NOT NULL,
  account_id UUID NOT NULL REFERENCES edge_sales_commercial_accounts(id) ON DELETE RESTRICT,
  opportunity_id UUID REFERENCES edge_sales_opportunities(id) ON DELETE SET NULL,
  quote_id UUID REFERENCES edge_sales_quotes(id) ON DELETE SET NULL,
  contract_type VARCHAR(64) NOT NULL DEFAULT 'SAAS_SUBSCRIPTION'
    CHECK (contract_type IN (
      'SAAS_SUBSCRIPTION','ENTERPRISE','FRAMEWORK','ORDER_FORM','ADDENDUM',
      'RENEWAL','AMENDMENT','PARTNER','RESELLER','PROFESSIONAL_SERVICES'
    )),
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN (
      'DRAFT','INTERNAL_REVIEW','APPROVED','SENT_FOR_SIGNATURE',
      'PARTIALLY_SIGNED','EXECUTED','ACTIVE','EXPIRED','TERMINATED',
      'REJECTED','CANCELLED','SUPERSEDED'
    )),
  current_version INT NOT NULL DEFAULT 1,
  product_id UUID REFERENCES edge_products(id) ON DELETE SET NULL,
  plan_id UUID,
  package_id UUID,
  addon_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  contract_value NUMERIC(19,4),
  start_date DATE,
  end_date DATE,
  renewal_terms JSONB NOT NULL DEFAULT '{}'::jsonb,
  termination_terms JSONB NOT NULL DEFAULT '{}'::jsonb,
  payment_terms JSONB NOT NULL DEFAULT '{}'::jsonb,
  commercial_terms_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  sla_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  parties JSONB NOT NULL DEFAULT '[]'::jsonb,
  signers JSONB NOT NULL DEFAULT '[]'::jsonb,
  document_ref VARCHAR(512),
  signature_provider VARCHAR(64),
  signature_external_id VARCHAR(255),
  signature_confirmed_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,
  activated_at TIMESTAMPTZ,
  supersedes_contract_id UUID REFERENCES edge_sales_contracts(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_sales_contracts_number_key UNIQUE (contract_number)
);

CREATE SEQUENCE IF NOT EXISTS edge_sales_contract_number_seq START 1000;

CREATE INDEX IF NOT EXISTS idx_edge_sales_contracts_account
  ON edge_sales_contracts (account_id, status);

CREATE TABLE IF NOT EXISTS edge_sales_contract_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES edge_sales_contracts(id) ON DELETE CASCADE,
  version INT NOT NULL,
  status_snapshot VARCHAR(32) NOT NULL,
  document_ref VARCHAR(512),
  commercial_terms_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  change_summary TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (contract_id, version)
);

CREATE TABLE IF NOT EXISTS edge_sales_contract_amendments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES edge_sales_contracts(id) ON DELETE CASCADE,
  amendment_number VARCHAR(32) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT','APPROVED','EXECUTED','CANCELLED')),
  summary TEXT NOT NULL,
  changes JSONB NOT NULL DEFAULT '{}'::jsonb,
  document_ref VARCHAR(512),
  executed_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (contract_id, amendment_number)
);

CREATE TABLE IF NOT EXISTS edge_sales_signature_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES edge_sales_contracts(id) ON DELETE CASCADE,
  event_type VARCHAR(64) NOT NULL
    CHECK (event_type IN (
      'REQUESTED','VIEWED','SIGNED','DECLINED','VOIDED',
      'COMPLETED','PROVIDER_CONFIRMED','PROVIDER_FAILED'
    )),
  provider VARCHAR(64),
  provider_event_id VARCHAR(255),
  signer_email VARCHAR(255),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_edge_sales_signature_provider_event
  ON edge_sales_signature_events (provider, provider_event_id)
  WHERE provider_event_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Sales orders
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_sales_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number VARCHAR(32) NOT NULL,
  account_id UUID NOT NULL REFERENCES edge_sales_commercial_accounts(id) ON DELETE RESTRICT,
  contract_id UUID REFERENCES edge_sales_contracts(id) ON DELETE SET NULL,
  opportunity_id UUID REFERENCES edge_sales_opportunities(id) ON DELETE SET NULL,
  quote_id UUID REFERENCES edge_sales_quotes(id) ON DELETE SET NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN (
      'DRAFT','PENDING_APPROVAL','APPROVED','CONFIRMED',
      'HANDOFF_PENDING','HANDOFF_ACCEPTED','FULFILLMENT_IN_PROGRESS',
      'FULFILLED','CANCELLED'
    )),
  product_id UUID REFERENCES edge_products(id) ON DELETE SET NULL,
  vertical_id UUID REFERENCES edge_verticals(id) ON DELETE SET NULL,
  offer_configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  total_amount NUMERIC(19,4) NOT NULL DEFAULT 0,
  requested_go_live_date DATE,
  owner_administrator_id UUID REFERENCES edge_administrators(id) ON DELETE SET NULL,
  commercial_terms JSONB NOT NULL DEFAULT '{}'::jsonb,
  provisioning_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_sales_orders_number_key UNIQUE (order_number)
);

CREATE SEQUENCE IF NOT EXISTS edge_sales_order_number_seq START 1000;

CREATE TABLE IF NOT EXISTS edge_sales_order_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES edge_sales_orders(id) ON DELETE CASCADE,
  line_number INT NOT NULL,
  description VARCHAR(512) NOT NULL,
  quantity NUMERIC(19,4) NOT NULL DEFAULT 1,
  unit_price NUMERIC(19,4) NOT NULL DEFAULT 0,
  line_total NUMERIC(19,4) NOT NULL DEFAULT 0,
  product_id UUID,
  plan_id UUID,
  package_id UUID,
  addon_id UUID,
  p2_refs JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (order_id, line_number)
);

-- ---------------------------------------------------------------------------
-- Handoff (subscription/provisioning transfer — no direct tenant create)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_sales_handoffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_order_id UUID NOT NULL REFERENCES edge_sales_orders(id) ON DELETE RESTRICT,
  account_id UUID NOT NULL REFERENCES edge_sales_commercial_accounts(id) ON DELETE RESTRICT,
  opportunity_id UUID REFERENCES edge_sales_opportunities(id) ON DELETE SET NULL,
  contract_id UUID REFERENCES edge_sales_contracts(id) ON DELETE SET NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'REQUESTED'
    CHECK (status IN (
      'REQUESTED','ACCEPTED','REJECTED','IN_PROGRESS',
      'PROVISIONING_PENDING','PROVISIONING_CONFIRMED','FAILED','CANCELLED'
    )),
  correlation_id UUID NOT NULL,
  package_payload JSONB NOT NULL,
  target_domain VARCHAR(64) NOT NULL DEFAULT 'SUBSCRIPTION_PROVISIONING',
  last_error TEXT,
  accepted_at TIMESTAMPTZ,
  provisioning_confirmed_at TIMESTAMPTZ,
  provisioning_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_sales_handoffs_correlation_key UNIQUE (correlation_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_edge_sales_handoff_order_active
  ON edge_sales_handoffs (sales_order_id)
  WHERE status NOT IN ('REJECTED','FAILED','CANCELLED');

CREATE TABLE IF NOT EXISTS edge_sales_handoff_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  handoff_id UUID NOT NULL REFERENCES edge_sales_handoffs(id) ON DELETE CASCADE,
  attempt_no INT NOT NULL,
  idempotency_key VARCHAR(128) NOT NULL,
  request_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  response_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  success BOOLEAN NOT NULL DEFAULT FALSE,
  error_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (handoff_id, attempt_no),
  UNIQUE (idempotency_key)
);

CREATE TABLE IF NOT EXISTS edge_sales_provisioning_references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  handoff_id UUID NOT NULL REFERENCES edge_sales_handoffs(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES edge_sales_commercial_accounts(id) ON DELETE RESTRICT,
  external_system VARCHAR(64) NOT NULL,
  external_ref VARCHAR(255) NOT NULL,
  ref_type VARCHAR(64) NOT NULL DEFAULT 'TENANT'
    CHECK (ref_type IN ('TENANT','SUBSCRIPTION','ENTITLEMENT','OTHER')),
  product_id UUID REFERENCES edge_products(id) ON DELETE SET NULL,
  confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  confirmed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (external_system, external_ref)
);

-- ---------------------------------------------------------------------------
-- Forecast snapshots (assumptions versioned; never claim as recognized revenue)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_sales_forecast_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_type VARCHAR(16) NOT NULL
    CHECK (period_type IN ('MONTH','QUARTER','YEAR')),
  period_key VARCHAR(16) NOT NULL,
  scope_type VARCHAR(32) NOT NULL DEFAULT 'GLOBAL'
    CHECK (scope_type IN ('GLOBAL','TEAM','OWNER','PRODUCT','VERTICAL','MARKET')),
  scope_id UUID,
  model VARCHAR(32) NOT NULL
    CHECK (model IN ('PIPELINE','WEIGHTED','BEST_CASE','COMMIT','MOST_LIKELY')),
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  amount NUMERIC(19,4) NOT NULL DEFAULT 0,
  opportunity_count INT NOT NULL DEFAULT 0,
  assumptions JSONB NOT NULL DEFAULT '{}'::jsonb,
  version INT NOT NULL DEFAULT 1,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (period_type, period_key, scope_type, scope_id, model, version)
);

-- Operator contracts/orders read+manage (no handoff execute / contract approve for operator)
INSERT INTO edge_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM edge_roles r
INNER JOIN edge_permissions p ON p.code IN (
  'platform:sales:contracts:read',
  'platform:sales:contracts:manage',
  'platform:sales:orders:manage',
  'platform:sales:forecast:read'
)
WHERE r.code = 'EDGE_PLATFORM_OPERATOR'
ON CONFLICT DO NOTHING;

INSERT INTO schema_migrations (version) VALUES ('085_edge_sales_contracts_orders_handoff')
ON CONFLICT DO NOTHING;
