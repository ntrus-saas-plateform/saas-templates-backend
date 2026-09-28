-- Migration 022: Commercial requirements 90-117
-- Targeted indexes, FX snapshots, commercial config, priority, retention, policies.

-- ========== 90 INDEXES (selective) ==========
CREATE INDEX IF NOT EXISTS idx_sales_orders_channel
  ON sales_orders (organization_id, channel_id)
  WHERE channel_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sales_orders_warehouse
  ON sales_orders (organization_id, warehouse_id)
  WHERE warehouse_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sales_order_lines_product
  ON sales_order_lines (product_id)
  WHERE product_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_commercial_payments_status
  ON commercial_payments (organization_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_commercial_payments_invoice
  ON commercial_payments (invoice_id)
  WHERE invoice_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_commercial_invoices_customer_status
  ON commercial_invoices (organization_id, customer_id, status);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier
  ON purchase_orders (organization_id, supplier_id);

CREATE INDEX IF NOT EXISTS idx_rm_order_summary_payment_status
  ON rm_order_summary (organization_id, payment_status)
  WHERE payment_status IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_reservations_wh_status
  ON inventory_reservations (warehouse_id, status)
  WHERE status = 'ACTIVE';

-- ========== 106 MULTI-CURRENCY SNAPSHOTS ==========
ALTER TABLE sales_orders
  ADD COLUMN IF NOT EXISTS base_currency VARCHAR(3),
  ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(18, 8),
  ADD COLUMN IF NOT EXISTS exchange_rate_date DATE;

ALTER TABLE commercial_invoices
  ADD COLUMN IF NOT EXISTS base_currency VARCHAR(3),
  ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(18, 8),
  ADD COLUMN IF NOT EXISTS exchange_rate_date DATE;

ALTER TABLE commercial_payments
  ADD COLUMN IF NOT EXISTS base_currency VARCHAR(3),
  ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(18, 8),
  ADD COLUMN IF NOT EXISTS exchange_rate_date DATE;

-- ========== 105 / 104 COMMERCIAL ORG CONFIG ==========
CREATE TABLE IF NOT EXISTS commercial_org_config (
  organization_id UUID PRIMARY KEY,
  reservation_timeout_minutes INT NOT NULL DEFAULT 30,
  allocation_strategy VARCHAR(40) NOT NULL DEFAULT 'FEFO',
  default_fulfillment_policy VARCHAR(40) NOT NULL DEFAULT 'SINGLE_WAREHOUSE',
  return_policy_code VARCHAR(50),
  credit_policy_code VARCHAR(50),
  approval_policy_code VARCHAR(50),
  availability_policy_code VARCHAR(50),
  base_currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  enable_ctp BOOLEAN NOT NULL DEFAULT true,
  enable_loyalty BOOLEAN NOT NULL DEFAULT false,
  enable_mobile_pos BOOLEAN NOT NULL DEFAULT true,
  enable_consignment BOOLEAN NOT NULL DEFAULT false,
  enable_ai_replenishment BOOLEAN NOT NULL DEFAULT false,
  audit_retention_days INT NOT NULL DEFAULT 2555,
  transaction_retention_days INT NOT NULL DEFAULT 3650,
  event_retention_days INT NOT NULL DEFAULT 730,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ========== 108 AVAILABILITY POLICY ==========
CREATE TABLE IF NOT EXISTS commercial_availability_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(200) NOT NULL,
  channel_code VARCHAR(50),
  safety_stock_pct NUMERIC(9, 4) NOT NULL DEFAULT 0,
  allow_protected_stock BOOLEAN NOT NULL DEFAULT false,
  allow_store_safety_stock BOOLEAN NOT NULL DEFAULT true,
  ownership_mode VARCHAR(30) NOT NULL DEFAULT 'DEFAULT'
    CHECK (ownership_mode IN ('DEFAULT', 'OWNED_ONLY')),
  rules JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'INACTIVE')),
  UNIQUE (organization_id, code)
);

-- ========== 109 PRIORITY ENGINE ==========
CREATE TABLE IF NOT EXISTS commercial_priority_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(200) NOT NULL,
  criteria JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- criteria example: [{ "factor": "CUSTOMER|ORDER|CHANNEL|PRODUCT|MARGIN|SLA|MEDICAL|CONTRACT|PAYMENT", "weight": 10 }]
  status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'INACTIVE')),
  UNIQUE (organization_id, code)
);

-- ========== 103 EXPLAIN TRAILS (cached narratives optional) ==========
CREATE TABLE IF NOT EXISTS commercial_explain_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  subject_type VARCHAR(40) NOT NULL
    CHECK (subject_type IN ('STOCK', 'REVENUE', 'MARGIN', 'RESERVED', 'ALLOCATED', 'AR')),
  subject_key VARCHAR(200) NOT NULL,
  as_of TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  narrative JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_explain_snapshots_subject
  ON commercial_explain_snapshots (organization_id, subject_type, subject_key, as_of DESC);

-- Expand policy types with ORDER (117)
ALTER TABLE commercial_policies DROP CONSTRAINT IF EXISTS commercial_policies_policy_type_check;
ALTER TABLE commercial_policies
  ADD CONSTRAINT commercial_policies_policy_type_check
  CHECK (policy_type IN (
    'ORDER', 'PRICING', 'ALLOCATION', 'CREDIT', 'DISCOUNT', 'FULFILLMENT',
    'RETURN', 'TAX', 'APPROVAL', 'BACKORDER'
  ));

INSERT INTO schema_migrations (version) VALUES ('022_commercial_reqs_90_117') ON CONFLICT DO NOTHING;
