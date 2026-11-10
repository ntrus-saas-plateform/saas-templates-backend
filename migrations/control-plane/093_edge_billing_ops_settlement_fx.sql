-- Migration 093: P6 ops — settlements, disputes/chargebacks, FX rates, provider tx mirror
-- Completes schema gaps for reconciliation/settlement without a live PSP dependency.

-- ---------------------------------------------------------------------------
-- FX rate registry (immutable snapshots; never rewrite historical rates)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_billing_fx_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_currency CHAR(3) NOT NULL,
  quote_currency CHAR(3) NOT NULL,
  rate NUMERIC(19,8) NOT NULL,
  source VARCHAR(64) NOT NULL DEFAULT 'MANUAL',
  effective_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_billing_fx_rates_pair_version UNIQUE (base_currency, quote_currency, version)
);

CREATE INDEX IF NOT EXISTS idx_edge_billing_fx_rates_pair
  ON edge_billing_fx_rates (base_currency, quote_currency, effective_at DESC);

-- ---------------------------------------------------------------------------
-- Provider transaction mirror (for reconciliation)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_provider_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR(64) NOT NULL,
  provider_txn_id VARCHAR(255) NOT NULL,
  payment_intent_id UUID REFERENCES edge_payment_intents(id) ON DELETE SET NULL,
  amount NUMERIC(19,4) NOT NULL,
  currency CHAR(3) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'SETTLED'
    CHECK (status IN ('PENDING','SETTLED','FAILED','REFUNDED','DISPUTED')),
  fees NUMERIC(19,4) NOT NULL DEFAULT 0,
  raw JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_provider_transactions_provider_txn UNIQUE (provider, provider_txn_id)
);

CREATE INDEX IF NOT EXISTS idx_edge_provider_transactions_intent
  ON edge_provider_transactions (payment_intent_id)
  WHERE payment_intent_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Settlement batches
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_settlement_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR(64) NOT NULL,
  merchant_account VARCHAR(128),
  settlement_date DATE NOT NULL,
  gross_amount NUMERIC(19,4) NOT NULL DEFAULT 0,
  fees NUMERIC(19,4) NOT NULL DEFAULT 0,
  refunds NUMERIC(19,4) NOT NULL DEFAULT 0,
  chargebacks NUMERIC(19,4) NOT NULL DEFAULT 0,
  net_amount NUMERIC(19,4) NOT NULL DEFAULT 0,
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  bank_reference VARCHAR(255),
  status VARCHAR(32) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING','RECEIVED','RECONCILED','DISPUTED')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edge_settlement_batches_provider
  ON edge_settlement_batches (provider, settlement_date DESC);

CREATE TABLE IF NOT EXISTS edge_settlement_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES edge_settlement_batches(id) ON DELETE CASCADE,
  provider_transaction_id UUID REFERENCES edge_provider_transactions(id) ON DELETE SET NULL,
  amount NUMERIC(19,4) NOT NULL,
  currency CHAR(3) NOT NULL,
  item_type VARCHAR(32) NOT NULL DEFAULT 'PAYMENT'
    CHECK (item_type IN ('PAYMENT','REFUND','FEE','CHARGEBACK','ADJUSTMENT')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edge_settlement_items_batch
  ON edge_settlement_items (batch_id);

-- ---------------------------------------------------------------------------
-- Disputes / chargebacks
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_billing_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_intent_id UUID REFERENCES edge_payment_intents(id) ON DELETE SET NULL,
  invoice_id UUID REFERENCES edge_invoices(id) ON DELETE SET NULL,
  billing_account_id UUID NOT NULL REFERENCES edge_billing_accounts(id) ON DELETE RESTRICT,
  provider VARCHAR(64) NOT NULL,
  provider_dispute_id VARCHAR(255),
  dispute_type VARCHAR(64) NOT NULL DEFAULT 'CHARGEBACK',
  amount NUMERIC(19,4) NOT NULL,
  currency CHAR(3) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN','UNDER_REVIEW','WON','LOST','WITHDRAWN')),
  due_at TIMESTAMPTZ,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  resolution JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edge_billing_disputes_account
  ON edge_billing_disputes (billing_account_id, status);

CREATE INDEX IF NOT EXISTS idx_edge_billing_disputes_intent
  ON edge_billing_disputes (payment_intent_id)
  WHERE payment_intent_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Seed default FX identity rates + tax rate for ZZ_INTERNAL
-- ---------------------------------------------------------------------------

INSERT INTO edge_billing_fx_rates (base_currency, quote_currency, rate, source, version)
VALUES
  ('USD', 'USD', 1, 'IDENTITY', 1),
  ('EUR', 'EUR', 1, 'IDENTITY', 1),
  ('XOF', 'XOF', 1, 'IDENTITY', 1)
ON CONFLICT DO NOTHING;

INSERT INTO edge_billing_tax_rates (jurisdiction_id, category, rate, version)
SELECT j.id, 'STANDARD', 0.180000, 1
FROM edge_billing_tax_jurisdictions j
WHERE j.code = 'ZZ_INTERNAL'
  AND NOT EXISTS (
    SELECT 1 FROM edge_billing_tax_rates r
    WHERE r.jurisdiction_id = j.id AND r.category = 'STANDARD'
  );

INSERT INTO schema_migrations (version) VALUES ('093_edge_billing_ops_settlement_fx')
ON CONFLICT DO NOTHING;
