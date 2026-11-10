-- Migration 092: P6 — Payments, ledger, collections, reconciliation, policies
-- Tokenized provider refs only — never store full PAN or CVV. No Hyperswitch tables.

-- ---------------------------------------------------------------------------
-- Payment customers (provider-side customer refs)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_payment_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_account_id UUID NOT NULL REFERENCES edge_billing_accounts(id) ON DELETE CASCADE,
  provider VARCHAR(64) NOT NULL,
  provider_customer_ref VARCHAR(255) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE','INACTIVE','REVOKED')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_payment_customers_account_provider_key UNIQUE (billing_account_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_edge_payment_customers_provider
  ON edge_payment_customers (provider, provider_customer_ref);

-- ---------------------------------------------------------------------------
-- Payment methods (tokenized — last4/brand only; no PAN/CVV columns)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_account_id UUID NOT NULL REFERENCES edge_billing_accounts(id) ON DELETE CASCADE,
  provider VARCHAR(64) NOT NULL,
  provider_method_ref VARCHAR(255) NOT NULL,
  method_type VARCHAR(32) NOT NULL DEFAULT 'CARD'
    CHECK (method_type IN (
      'CARD','MOBILE_MONEY','BANK_TRANSFER','WALLET','MANUAL','OTHER'
    )),
  brand VARCHAR(64),
  last4 CHAR(4),
  exp_month SMALLINT,
  exp_year SMALLINT,
  country VARCHAR(64),
  currency CHAR(3),
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE','REVOKED','EXPIRED')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE edge_payment_methods IS
  'Stores tokenized payment method references from PSPs only. Never persist full PAN, CVV, or magnetic stripe data.';

CREATE INDEX IF NOT EXISTS idx_edge_payment_methods_account
  ON edge_payment_methods (billing_account_id, status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_edge_payment_methods_provider_ref
  ON edge_payment_methods (provider, provider_method_ref);

-- ---------------------------------------------------------------------------
-- Payment intents
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_payment_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_account_id UUID NOT NULL REFERENCES edge_billing_accounts(id) ON DELETE RESTRICT,
  invoice_id UUID REFERENCES edge_invoices(id) ON DELETE SET NULL,
  amount NUMERIC(19,4) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  status VARCHAR(32) NOT NULL DEFAULT 'CREATED'
    CHECK (status IN (
      'CREATED','REQUIRES_ACTION','PROCESSING','AUTHORIZED','CAPTURED',
      'SUCCEEDED','FAILED','CANCELLED','EXPIRED'
    )),
  provider VARCHAR(64) NOT NULL,
  provider_intent_ref VARCHAR(255),
  correlation_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_payment_intents_correlation_key UNIQUE (correlation_id)
);

CREATE INDEX IF NOT EXISTS idx_edge_payment_intents_account
  ON edge_payment_intents (billing_account_id, status);

CREATE INDEX IF NOT EXISTS idx_edge_payment_intents_invoice
  ON edge_payment_intents (invoice_id)
  WHERE invoice_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Payment attempts (per try against an intent)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_payment_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intent_id UUID NOT NULL REFERENCES edge_payment_intents(id) ON DELETE CASCADE,
  attempt_number INT NOT NULL,
  status VARCHAR(32) NOT NULL,
  provider_ref VARCHAR(255),
  failure_code VARCHAR(64),
  failure_message TEXT,
  raw_response JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (intent_id, attempt_number)
);

CREATE INDEX IF NOT EXISTS idx_edge_payment_attempts_intent
  ON edge_payment_attempts (intent_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Payment allocations (intent amount applied to invoices)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_payment_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_intent_id UUID NOT NULL REFERENCES edge_payment_intents(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES edge_invoices(id) ON DELETE RESTRICT,
  amount NUMERIC(19,4) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  allocated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_edge_payment_allocations_invoice
  ON edge_payment_allocations (invoice_id, allocated_at DESC);

-- ---------------------------------------------------------------------------
-- Refunds
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_intent_id UUID NOT NULL REFERENCES edge_payment_intents(id) ON DELETE RESTRICT,
  invoice_id UUID REFERENCES edge_invoices(id) ON DELETE SET NULL,
  amount NUMERIC(19,4) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  status VARCHAR(32) NOT NULL DEFAULT 'REQUESTED'
    CHECK (status IN (
      'REQUESTED','PENDING_APPROVAL','APPROVED','PROCESSING',
      'SUCCEEDED','FAILED','CANCELLED'
    )),
  reason TEXT,
  provider_ref VARCHAR(255),
  approved_by UUID,
  correlation_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edge_refunds_intent
  ON edge_refunds (payment_intent_id, status);

-- ---------------------------------------------------------------------------
-- Webhook ingest (idempotent by provider event id)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_payment_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR(64) NOT NULL,
  provider_event_id VARCHAR(255) NOT NULL,
  signature_valid BOOLEAN NOT NULL DEFAULT FALSE,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  processing_status VARCHAR(32) NOT NULL DEFAULT 'RECEIVED'
    CHECK (processing_status IN ('RECEIVED','PROCESSED','IGNORED','FAILED')),
  correlation_id UUID,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  CONSTRAINT edge_payment_webhook_events_provider_event_id_key UNIQUE (provider_event_id)
);

CREATE INDEX IF NOT EXISTS idx_edge_payment_webhook_events_status
  ON edge_payment_webhook_events (processing_status, received_at DESC);

-- ---------------------------------------------------------------------------
-- Collections and dunning
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_collection_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_account_id UUID NOT NULL REFERENCES edge_billing_accounts(id) ON DELETE RESTRICT,
  invoice_id UUID NOT NULL REFERENCES edge_invoices(id) ON DELETE CASCADE,
  status VARCHAR(32) NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN','IN_PROGRESS','ESCALATED','RESOLVED','WRITTEN_OFF')),
  overdue_since TIMESTAMPTZ,
  next_action_at TIMESTAMPTZ,
  policy_code VARCHAR(64),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edge_collection_cases_account
  ON edge_collection_cases (billing_account_id, status);

CREATE INDEX IF NOT EXISTS idx_edge_collection_cases_next_action
  ON edge_collection_cases (next_action_at)
  WHERE status IN ('OPEN','IN_PROGRESS','ESCALATED');

CREATE TABLE IF NOT EXISTS edge_dunning_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES edge_collection_cases(id) ON DELETE CASCADE,
  channel VARCHAR(32) NOT NULL DEFAULT 'EMAIL'
    CHECK (channel IN ('EMAIL','WHATSAPP','IN_APP','SMS','OTHER')),
  template_ref VARCHAR(255),
  status VARCHAR(32) NOT NULL DEFAULT 'SENT'
    CHECK (status IN ('SENT','FAILED','SKIPPED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edge_dunning_attempts_case
  ON edge_dunning_attempts (case_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Financial journal (append-only; corrections via reversing entries)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_financial_journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_type VARCHAR(64) NOT NULL,
  reference_type VARCHAR(64) NOT NULL,
  reference_id UUID NOT NULL,
  billing_account_id UUID NOT NULL REFERENCES edge_billing_accounts(id) ON DELETE RESTRICT,
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  amount NUMERIC(19,4) NOT NULL,
  direction VARCHAR(8) NOT NULL
    CHECK (direction IN ('DEBIT','CREDIT')),
  description TEXT,
  correlation_id UUID,
  actor_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE edge_financial_journal_entries IS
  'Append-only ledger. Do not UPDATE or DELETE rows; post reversing entries for corrections.';

CREATE INDEX IF NOT EXISTS idx_edge_financial_journal_entries_account
  ON edge_financial_journal_entries (billing_account_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_edge_financial_journal_entries_reference
  ON edge_financial_journal_entries (reference_type, reference_id);

-- ---------------------------------------------------------------------------
-- Reconciliation runs and exceptions
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_reconciliation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'RUNNING'
    CHECK (status IN ('RUNNING','COMPLETED','FAILED')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  summary JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_edge_reconciliation_runs_provider
  ON edge_reconciliation_runs (provider, started_at DESC);

CREATE TABLE IF NOT EXISTS edge_reconciliation_exceptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES edge_reconciliation_runs(id) ON DELETE CASCADE,
  status VARCHAR(32) NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN','RESOLVED')),
  exception_type VARCHAR(64) NOT NULL,
  internal_ref VARCHAR(255),
  provider_ref VARCHAR(255),
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_edge_reconciliation_exceptions_run
  ON edge_reconciliation_exceptions (run_id, status);

-- ---------------------------------------------------------------------------
-- API mutation idempotency
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_billing_idempotency_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key VARCHAR(128) NOT NULL,
  operation VARCHAR(128) NOT NULL,
  resource_type VARCHAR(64) NOT NULL,
  resource_id UUID,
  response_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_billing_idempotency_keys_key UNIQUE (idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_edge_billing_idempotency_keys_resource
  ON edge_billing_idempotency_keys (resource_type, resource_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Billing policies (dunning, issue gates, payment confirmation)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_billing_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(64) NOT NULL,
  policy_type VARCHAR(64) NOT NULL DEFAULT 'DUNNING'
    CHECK (policy_type IN ('DUNNING','ISSUE','PAYMENT','TAX','OTHER')),
  rules JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE','INACTIVE')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_billing_policies_code_key UNIQUE (code)
);

-- ---------------------------------------------------------------------------
-- Seeds (test jurisdiction + default dunning policy)
-- ---------------------------------------------------------------------------

INSERT INTO edge_billing_tax_jurisdictions (code, name, country, rules, status)
VALUES (
  'ZZ_INTERNAL',
  'Internal test jurisdiction',
  'ZZ',
  '{"testOnly":true}'::jsonb,
  'ACTIVE'
)
ON CONFLICT (code) DO NOTHING;

INSERT INTO edge_billing_policies (code, policy_type, rules, status)
VALUES (
  'DUNNING_DEFAULT',
  'DUNNING',
  '{"graceDays":7,"maxRetries":3}'::jsonb,
  'ACTIVE'
)
ON CONFLICT (code) DO NOTHING;

INSERT INTO schema_migrations (version) VALUES ('092_edge_billing_payments_ledger_collections')
ON CONFLICT DO NOTHING;
