-- Migration 021: Commercial requirements 71-87
-- Pharma attributes, serialization, price history, read models,
-- webhook deliveries, reconciliation, commercial jobs/notifications.

-- ========== 71 PHARMA ATTRIBUTES ==========
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS cold_chain_required BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS controlled_substance BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS controlled_schedule VARCHAR(40),
  ADD COLUMN IF NOT EXISTS requires_prescription BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS min_shelf_life_days INT,
  ADD COLUMN IF NOT EXISTS storage_conditions JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE stock_lots
  ADD COLUMN IF NOT EXISTS temperature_min NUMERIC(8, 2),
  ADD COLUMN IF NOT EXISTS temperature_max NUMERIC(8, 2),
  ADD COLUMN IF NOT EXISTS cold_chain_breach BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recalled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS recall_reason TEXT;

CREATE TABLE IF NOT EXISTS stock_serials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  sku_id UUID NOT NULL REFERENCES product_skus(id) ON DELETE CASCADE,
  lot_id UUID REFERENCES stock_lots(id) ON DELETE SET NULL,
  serial_number VARCHAR(200) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'AVAILABLE'
    CHECK (status IN ('AVAILABLE', 'RESERVED', 'ALLOCATED', 'ISSUED', 'RETURNED', 'QUARANTINE', 'RECALLED')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, sku_id, serial_number)
);

CREATE INDEX IF NOT EXISTS idx_stock_serials_lot ON stock_serials (lot_id) WHERE lot_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS product_recalls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  recall_number VARCHAR(50) NOT NULL,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  sku_id UUID REFERENCES product_skus(id) ON DELETE SET NULL,
  lot_id UUID REFERENCES stock_lots(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN', 'IN_PROGRESS', 'CLOSED', 'CANCELLED')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  created_by VARCHAR(100),
  UNIQUE (organization_id, recall_number)
);

-- ========== 73 PRICE HISTORY ==========
CREATE TABLE IF NOT EXISTS price_list_item_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  price_list_id UUID NOT NULL,
  sku_id UUID NOT NULL,
  unit_price NUMERIC(18, 6) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  valid_from TIMESTAMPTZ NOT NULL,
  valid_to TIMESTAMPTZ,
  changed_by VARCHAR(100),
  change_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_price_item_history_sku
  ON price_list_item_history (organization_id, sku_id, valid_from DESC);

-- ========== 79 READ MODELS ==========
CREATE TABLE IF NOT EXISTS rm_order_summary (
  order_id UUID PRIMARY KEY,
  organization_id UUID NOT NULL,
  order_number VARCHAR(50) NOT NULL,
  status VARCHAR(40) NOT NULL,
  customer_id UUID,
  customer_name TEXT,
  channel_id UUID,
  currency VARCHAR(3),
  grand_total NUMERIC(18, 4) NOT NULL DEFAULT 0,
  fulfillment_status VARCHAR(40),
  payment_status VARCHAR(40),
  confirmed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rm_order_summary_org
  ON rm_order_summary (organization_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS rm_customer_commercial_summary (
  customer_id UUID NOT NULL,
  organization_id UUID NOT NULL,
  open_order_count INT NOT NULL DEFAULT 0,
  open_ar_balance NUMERIC(18, 4) NOT NULL DEFAULT 0,
  credit_limit NUMERIC(18, 4),
  credit_used NUMERIC(18, 4) NOT NULL DEFAULT 0,
  last_order_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (organization_id, customer_id)
);

CREATE TABLE IF NOT EXISTS rm_product_availability (
  organization_id UUID NOT NULL,
  sku_id UUID NOT NULL,
  warehouse_id UUID NOT NULL,
  on_hand NUMERIC(18, 4) NOT NULL DEFAULT 0,
  reserved NUMERIC(18, 4) NOT NULL DEFAULT 0,
  sellable NUMERIC(18, 4) NOT NULL DEFAULT 0,
  as_of TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (organization_id, sku_id, warehouse_id)
);

CREATE TABLE IF NOT EXISTS rm_customer_balance (
  organization_id UUID NOT NULL,
  customer_id UUID NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  open_balance NUMERIC(18, 4) NOT NULL DEFAULT 0,
  overdue_balance NUMERIC(18, 4) NOT NULL DEFAULT 0,
  as_of TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (organization_id, customer_id, currency)
);

CREATE TABLE IF NOT EXISTS rm_fulfillment_status (
  sales_order_id UUID PRIMARY KEY,
  organization_id UUID NOT NULL,
  status VARCHAR(40) NOT NULL,
  shipped_qty NUMERIC(18, 4) NOT NULL DEFAULT 0,
  delivered_qty NUMERIC(18, 4) NOT NULL DEFAULT 0,
  last_shipment_id UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ========== 83 RECONCILIATION ==========
CREATE TABLE IF NOT EXISTS commercial_reconciliation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID,
  job_type VARCHAR(80) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'RUNNING'
    CHECK (status IN ('RUNNING', 'COMPLETED', 'FAILED')),
  drift_count INT NOT NULL DEFAULT 0,
  report JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_commercial_recon_type
  ON commercial_reconciliation_runs (job_type, started_at DESC);

-- ========== 84 JOB RUN LOG ==========
CREATE TABLE IF NOT EXISTS commercial_job_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name VARCHAR(100) NOT NULL,
  organization_id UUID,
  status VARCHAR(30) NOT NULL DEFAULT 'RUNNING'
    CHECK (status IN ('RUNNING', 'COMPLETED', 'FAILED', 'PARTIAL')),
  processed_count INT NOT NULL DEFAULT 0,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- ========== 85 COMMERCIAL NOTIFICATIONS ==========
CREATE TABLE IF NOT EXISTS commercial_notification_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  channel VARCHAR(30) NOT NULL
    CHECK (channel IN ('IN_APP', 'EMAIL', 'SMS', 'PUSH', 'WEBHOOK')),
  recipient VARCHAR(300),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(30) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'SENT', 'FAILED', 'DEAD_LETTER')),
  attempts INT NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_commercial_notif_pending
  ON commercial_notification_outbox (status, created_at)
  WHERE status = 'PENDING';

-- ========== 86 WEBHOOK DELIVERY ==========
CREATE TABLE IF NOT EXISTS webhook_delivery_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID NOT NULL REFERENCES tenant_webhooks(id) ON DELETE CASCADE,
  event_type VARCHAR(100) NOT NULL,
  idempotency_key VARCHAR(120) NOT NULL,
  payload JSONB NOT NULL,
  signature VARCHAR(256),
  status VARCHAR(30) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'DELIVERED', 'FAILED', 'DEAD_LETTER')),
  attempts INT NOT NULL DEFAULT 0,
  last_status_code INT,
  last_error TEXT,
  next_attempt_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  UNIQUE (webhook_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_webhook_delivery_pending
  ON webhook_delivery_logs (status, next_attempt_at)
  WHERE status IN ('PENDING', 'FAILED');

-- Ensure organization scope on tenant_webhooks for commercial (nullable for tenant-level)
ALTER TABLE tenant_webhooks
  ADD COLUMN IF NOT EXISTS organization_id UUID,
  ADD COLUMN IF NOT EXISTS max_retries INT NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS backoff_seconds INT NOT NULL DEFAULT 30;

INSERT INTO tenant_number_sequences (document_type, prefix, pad_length, reset_policy)
VALUES ('RCL', 'RCL-', 6, 'YEAR')
ON CONFLICT DO NOTHING;

INSERT INTO schema_migrations (version) VALUES ('021_commercial_reqs_71_87') ON CONFLICT DO NOTHING;
