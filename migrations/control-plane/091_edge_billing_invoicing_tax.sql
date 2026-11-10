-- Migration 091: P6 — Invoicing, tax reference data, credit notes
-- Payment capture and ledger in 092. Issued invoice financial fields are immutable by domain policy.

-- ---------------------------------------------------------------------------
-- Tax jurisdictions and rate reference (manual / snapshot engine — not Avalara)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_billing_tax_jurisdictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  country VARCHAR(64),
  rules JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE','INACTIVE')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_billing_tax_jurisdictions_code_key UNIQUE (code)
);

CREATE TABLE IF NOT EXISTS edge_billing_tax_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jurisdiction_id UUID NOT NULL REFERENCES edge_billing_tax_jurisdictions(id) ON DELETE CASCADE,
  category VARCHAR(64) NOT NULL DEFAULT 'STANDARD',
  rate NUMERIC(9,6) NOT NULL,
  valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_until TIMESTAMPTZ,
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edge_billing_tax_rates_jurisdiction
  ON edge_billing_tax_rates (jurisdiction_id, category, valid_from DESC);

-- ---------------------------------------------------------------------------
-- Invoices (aggregate)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number VARCHAR(32) NOT NULL,
  billing_account_id UUID NOT NULL REFERENCES edge_billing_accounts(id) ON DELETE RESTRICT,
  subscription_id UUID REFERENCES edge_subscriptions(id) ON DELETE SET NULL,
  period_id UUID REFERENCES edge_billing_periods(id) ON DELETE SET NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN (
      'DRAFT','PENDING_VALIDATION','PENDING_APPROVAL','APPROVED','ISSUED',
      'PARTIALLY_PAID','PAID','OVERDUE','DISPUTED','VOIDED','WRITTEN_OFF'
    )),
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  issue_at TIMESTAMPTZ,
  due_at TIMESTAMPTZ,
  subtotal NUMERIC(19,4) NOT NULL DEFAULT 0,
  discount_total NUMERIC(19,4) NOT NULL DEFAULT 0,
  tax_total NUMERIC(19,4) NOT NULL DEFAULT 0,
  total NUMERIC(19,4) NOT NULL DEFAULT 0,
  amount_paid NUMERIC(19,4) NOT NULL DEFAULT 0,
  amount_due NUMERIC(19,4) NOT NULL DEFAULT 0,
  profile_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  commercial_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  tax_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  numbering_series VARCHAR(64),
  correlation_id UUID,
  issued_document_ref VARCHAR(255),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  CONSTRAINT edge_invoices_number_key UNIQUE (invoice_number),
  CONSTRAINT edge_invoices_correlation_key UNIQUE (correlation_id)
);

COMMENT ON TABLE edge_invoices IS
  'Issued invoices (status ISSUED and beyond): subtotal, discount_total, tax_total, total, '
  'amount_paid, amount_due, issue_at, currency, and tax_snapshot must not be silently UPDATEd. '
  'Corrections use credit notes, void, or reversing ledger entries.';

CREATE SEQUENCE IF NOT EXISTS edge_invoice_number_seq START 1000;

CREATE INDEX IF NOT EXISTS idx_edge_invoices_billing_account
  ON edge_invoices (billing_account_id, status);

CREATE INDEX IF NOT EXISTS idx_edge_invoices_subscription
  ON edge_invoices (subscription_id, status)
  WHERE subscription_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_edge_invoices_due
  ON edge_invoices (due_at, status)
  WHERE status IN ('ISSUED','PARTIALLY_PAID','OVERDUE');

-- ---------------------------------------------------------------------------
-- Invoice lines
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_invoice_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES edge_invoices(id) ON DELETE CASCADE,
  line_number INT NOT NULL,
  description TEXT NOT NULL,
  quantity NUMERIC(19,4) NOT NULL DEFAULT 1,
  unit_price NUMERIC(19,4) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(19,4) NOT NULL DEFAULT 0,
  taxable_amount NUMERIC(19,4) NOT NULL DEFAULT 0,
  tax_rate NUMERIC(9,6),
  tax_amount NUMERIC(19,4) NOT NULL DEFAULT 0,
  line_total NUMERIC(19,4) NOT NULL DEFAULT 0,
  product_ref VARCHAR(255),
  plan_ref VARCHAR(255),
  addon_ref VARCHAR(255),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (invoice_id, line_number)
);

CREATE INDEX IF NOT EXISTS idx_edge_invoice_lines_invoice
  ON edge_invoice_lines (invoice_id, line_number);

-- ---------------------------------------------------------------------------
-- Invoice tax summary lines (frozen at issue)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_invoice_tax_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES edge_invoices(id) ON DELETE CASCADE,
  jurisdiction_code VARCHAR(64) NOT NULL,
  category VARCHAR(64) NOT NULL DEFAULT 'STANDARD',
  rate NUMERIC(9,6) NOT NULL,
  taxable_amount NUMERIC(19,4) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(19,4) NOT NULL DEFAULT 0,
  rule_version INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edge_invoice_tax_lines_invoice
  ON edge_invoice_tax_lines (invoice_id);

-- ---------------------------------------------------------------------------
-- Invoice status history (append-only)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_invoice_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES edge_invoices(id) ON DELETE CASCADE,
  from_status VARCHAR(32),
  to_status VARCHAR(32) NOT NULL,
  reason TEXT,
  actor_id UUID,
  correlation_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edge_invoice_status_history_invoice
  ON edge_invoice_status_history (invoice_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Issued invoice documents (PDF / e-invoice storage refs)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_invoice_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES edge_invoices(id) ON DELETE CASCADE,
  document_type VARCHAR(32) NOT NULL DEFAULT 'PDF'
    CHECK (document_type IN ('PDF','ELECTRONIC')),
  storage_ref VARCHAR(512) NOT NULL,
  content_sha256 CHAR(64),
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  immutable BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edge_invoice_documents_invoice
  ON edge_invoice_documents (invoice_id, issued_at DESC);

-- ---------------------------------------------------------------------------
-- Credit notes
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_credit_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_note_number VARCHAR(32) NOT NULL,
  invoice_id UUID REFERENCES edge_invoices(id) ON DELETE SET NULL,
  billing_account_id UUID NOT NULL REFERENCES edge_billing_accounts(id) ON DELETE RESTRICT,
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT','ISSUED','VOIDED')),
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  total NUMERIC(19,4) NOT NULL DEFAULT 0,
  reason TEXT,
  snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  correlation_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_credit_notes_number_key UNIQUE (credit_note_number)
);

CREATE SEQUENCE IF NOT EXISTS edge_credit_note_number_seq START 1000;

CREATE INDEX IF NOT EXISTS idx_edge_credit_notes_invoice
  ON edge_credit_notes (invoice_id)
  WHERE invoice_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_edge_credit_notes_account
  ON edge_credit_notes (billing_account_id, status);

INSERT INTO schema_migrations (version) VALUES ('091_edge_billing_invoicing_tax')
ON CONFLICT DO NOTHING;
