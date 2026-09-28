-- Migration 019: Commercial requirements 31-45 (+ replenishment 46)
-- Shipping POD/SLA/cost, returns + quality, credit/AR hardening, invoice types,
-- POS/mobile offline ops, omnichannel handoff, purchasing stack, demand/replenishment

-- ========== 31 SHIPPING ==========
ALTER TABLE shipments
  ADD COLUMN IF NOT EXISTS delivery_address JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS shipping_cost NUMERIC(18, 4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS sla_hours INT,
  ADD COLUMN IF NOT EXISTS promised_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS proof_of_delivery JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS delivery_status VARCHAR(40) NOT NULL DEFAULT 'PENDING'
    CHECK (delivery_status IN (
      'PENDING', 'LABELLED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY',
      'DELIVERED', 'FAILED', 'RETURNED_TO_SENDER', 'CANCELLED'
    ));

-- ========== 32-33 RETURNS ==========
CREATE TABLE IF NOT EXISTS commercial_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  return_number VARCHAR(50) NOT NULL,
  return_type VARCHAR(40) NOT NULL
    CHECK (return_type IN (
      'CUSTOMER', 'SUPPLIER', 'INTERNAL', 'RECALL', 'DAMAGED', 'EXPIRED', 'WRONG_PRODUCT'
    )),
  status VARCHAR(40) NOT NULL DEFAULT 'REQUESTED'
    CHECK (status IN (
      'REQUESTED', 'AUTHORIZED', 'RECEIVED', 'INSPECTING', 'APPROVED', 'REJECTED',
      'RESTOCKED', 'QUARANTINED', 'DISPOSED', 'REFUNDED', 'CLOSED', 'CANCELLED'
    )),
  sales_order_id UUID,
  customer_id UUID,
  supplier_id UUID,
  warehouse_id UUID,
  reason TEXT,
  notes TEXT,
  quality_decision VARCHAR(40)
    CHECK (quality_decision IS NULL OR quality_decision IN (
      'RESTOCK', 'QUARANTINE', 'REPAIR', 'REPACK', 'DISPOSE', 'RETURN_TO_SUPPLIER'
    )),
  quality_decided_by VARCHAR(100),
  quality_decided_at TIMESTAMPTZ,
  credit_note_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, return_number)
);

CREATE TABLE IF NOT EXISTS commercial_return_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id UUID NOT NULL REFERENCES commercial_returns(id) ON DELETE CASCADE,
  sales_order_line_id UUID,
  sku_id UUID NOT NULL,
  lot_id UUID,
  quantity NUMERIC(18, 4) NOT NULL,
  quantity_received NUMERIC(18, 4) NOT NULL DEFAULT 0,
  condition_notes TEXT,
  quality_decision VARCHAR(40),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS commercial_return_transitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id UUID NOT NULL REFERENCES commercial_returns(id) ON DELETE CASCADE,
  from_status VARCHAR(40),
  to_status VARCHAR(40) NOT NULL,
  actor_id VARCHAR(100),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ========== 34 CREDIT ==========
CREATE TABLE IF NOT EXISTS customer_credit_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_hint UUID,
  organization_id UUID NOT NULL,
  customer_id UUID NOT NULL,
  entry_type VARCHAR(40) NOT NULL
    CHECK (entry_type IN (
      'INVOICE', 'PAYMENT', 'CREDIT_NOTE', 'DEBIT_NOTE', 'ADJUSTMENT', 'HOLD', 'RELEASE'
    )),
  amount NUMERIC(18, 4) NOT NULL,
  balance_after NUMERIC(18, 4),
  reference_type VARCHAR(50),
  reference_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_credit_ledger_cust
  ON customer_credit_ledger (organization_id, customer_id, created_at DESC);

-- ========== 37 INVOICE DOCUMENT TYPES ==========
ALTER TABLE commercial_invoices
  ADD COLUMN IF NOT EXISTS document_type VARCHAR(40) NOT NULL DEFAULT 'INVOICE'
    CHECK (document_type IN (
      'INVOICE', 'CREDIT_NOTE', 'DEBIT_NOTE', 'PROFORMA', 'RECEIPT', 'TAX_INVOICE'
    )),
  ADD COLUMN IF NOT EXISTS related_invoice_id UUID REFERENCES commercial_invoices(id) ON DELETE SET NULL;

-- ========== 39 MOBILE POS / OFFLINE ==========
CREATE TABLE IF NOT EXISTS pos_offline_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  client_operation_id VARCHAR(100) NOT NULL,
  device_id VARCHAR(100) NOT NULL,
  channel_id UUID,
  operation_type VARCHAR(50) NOT NULL,
  payload JSONB NOT NULL,
  idempotency_key VARCHAR(100) NOT NULL,
  sync_status VARCHAR(30) NOT NULL DEFAULT 'PENDING'
    CHECK (sync_status IN ('PENDING', 'PROCESSING', 'APPLIED', 'CONFLICT', 'REJECTED')),
  server_result JSONB,
  client_timestamp TIMESTAMPTZ,
  sequence_no BIGINT,
  conflict_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  UNIQUE (organization_id, idempotency_key),
  UNIQUE (organization_id, client_operation_id, device_id)
);

CREATE INDEX IF NOT EXISTS idx_pos_offline_sync
  ON pos_offline_operations (organization_id, sync_status, created_at);

-- ========== 40 OMNICHANNEL ==========
ALTER TABLE sales_orders
  ADD COLUMN IF NOT EXISTS origin_channel_id UUID,
  ADD COLUMN IF NOT EXISTS fulfill_channel_id UUID,
  ADD COLUMN IF NOT EXISTS fulfill_warehouse_id UUID,
  ADD COLUMN IF NOT EXISTS omnichannel_mode VARCHAR(40)
    CHECK (omnichannel_mode IS NULL OR omnichannel_mode IN (
      'BUY_ONLINE_PICKUP_STORE', 'BUY_ONLINE_SHIP_FROM_WH',
      'BUY_POS_SHIP_FROM_WH', 'BUY_B2B_MULTI_WH', 'CALL_CENTER'
    ));

-- ========== 41-44 PURCHASING ==========
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'INACTIVE', 'BLOCKED')),
  payment_terms VARCHAR(50),
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  lead_time_days INT NOT NULL DEFAULT 7,
  moq NUMERIC(18, 4) NOT NULL DEFAULT 1,
  ranking_score NUMERIC(8, 2),
  quality_rating NUMERIC(8, 2),
  contact JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, code)
);

CREATE TABLE IF NOT EXISTS supplier_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  valid_from TIMESTAMPTZ,
  valid_to TIMESTAMPTZ,
  terms JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, code)
);

CREATE TABLE IF NOT EXISTS supplier_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  sku_id UUID NOT NULL REFERENCES product_skus(id) ON DELETE CASCADE,
  unit_price NUMERIC(18, 4) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  moq NUMERIC(18, 4),
  lead_time_days INT,
  valid_from TIMESTAMPTZ,
  valid_to TIMESTAMPTZ,
  UNIQUE (supplier_id, sku_id, valid_from)
);

CREATE TABLE IF NOT EXISTS purchase_requisitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  requisition_number VARCHAR(50) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CONVERTED', 'CANCELLED')),
  source_type VARCHAR(40) NOT NULL DEFAULT 'MANUAL'
    CHECK (source_type IN (
      'STOCKOUT', 'REORDER_POINT', 'FORECAST', 'BACKORDER', 'MANUAL', 'SALES_DEMAND'
    )),
  warehouse_id UUID,
  requested_by VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, requisition_number)
);

CREATE TABLE IF NOT EXISTS purchase_requisition_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requisition_id UUID NOT NULL REFERENCES purchase_requisitions(id) ON DELETE CASCADE,
  sku_id UUID NOT NULL,
  quantity NUMERIC(18, 4) NOT NULL,
  suggested_supplier_id UUID,
  expected_at TIMESTAMPTZ,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  po_number VARCHAR(50) NOT NULL,
  supplier_id UUID NOT NULL REFERENCES suppliers(id),
  warehouse_id UUID,
  status VARCHAR(40) NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN (
      'DRAFT', 'APPROVAL', 'SENT', 'ACKNOWLEDGED',
      'PARTIALLY_RECEIVED', 'RECEIVED', 'CLOSED', 'CANCELLED'
    )),
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  subtotal NUMERIC(18, 4) NOT NULL DEFAULT 0,
  freight_cost NUMERIC(18, 4) NOT NULL DEFAULT 0,
  insurance_cost NUMERIC(18, 4) NOT NULL DEFAULT 0,
  tax_cost NUMERIC(18, 4) NOT NULL DEFAULT 0,
  customs_cost NUMERIC(18, 4) NOT NULL DEFAULT 0,
  handling_cost NUMERIC(18, 4) NOT NULL DEFAULT 0,
  other_cost NUMERIC(18, 4) NOT NULL DEFAULT 0,
  landed_cost NUMERIC(18, 4) NOT NULL DEFAULT 0,
  requisition_id UUID REFERENCES purchase_requisitions(id) ON DELETE SET NULL,
  notes TEXT,
  ordered_at TIMESTAMPTZ,
  expected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, po_number)
);

CREATE TABLE IF NOT EXISTS purchase_order_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  sku_id UUID NOT NULL,
  quantity_ordered NUMERIC(18, 4) NOT NULL,
  quantity_received NUMERIC(18, 4) NOT NULL DEFAULT 0,
  unit_price NUMERIC(18, 4) NOT NULL,
  line_total NUMERIC(18, 4) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchase_order_transitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  from_status VARCHAR(40),
  to_status VARCHAR(40) NOT NULL,
  actor_id VARCHAR(100),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS goods_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  receipt_number VARCHAR(50) NOT NULL,
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id),
  warehouse_id UUID NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'POSTED', 'CANCELLED')),
  received_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, receipt_number)
);

CREATE TABLE IF NOT EXISTS goods_receipt_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id UUID NOT NULL REFERENCES goods_receipts(id) ON DELETE CASCADE,
  purchase_order_line_id UUID,
  sku_id UUID NOT NULL,
  lot_number VARCHAR(100),
  expires_at DATE,
  quantity NUMERIC(18, 4) NOT NULL,
  unit_landed_cost NUMERIC(18, 4)
);

-- ========== 45-46 DEMAND / REPLENISHMENT ==========
CREATE TABLE IF NOT EXISTS demand_forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  sku_id UUID NOT NULL,
  warehouse_id UUID,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  forecast_qty NUMERIC(18, 4) NOT NULL,
  method VARCHAR(40) NOT NULL DEFAULT 'MANUAL'
    CHECK (method IN ('MANUAL', 'HISTORICAL', 'SEASONAL', 'PROMOTION_ADJUSTED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS replenishment_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  sku_id UUID NOT NULL,
  warehouse_id UUID NOT NULL,
  suggested_qty NUMERIC(18, 4) NOT NULL,
  method VARCHAR(40) NOT NULL
    CHECK (method IN ('MIN_MAX', 'REORDER_POINT', 'EOQ', 'DEMAND_FORECAST', 'SAFETY_STOCK', 'DAYS_OF_SUPPLY')),
  supplier_id UUID,
  expected_arrival TIMESTAMPTZ,
  estimated_cost NUMERIC(18, 4),
  priority INT NOT NULL DEFAULT 100,
  status VARCHAR(30) NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN', 'ACCEPTED', 'REJECTED', 'CONVERTED')),
  requisition_id UUID,
  rationale JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory_reorder_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  sku_id UUID NOT NULL REFERENCES product_skus(id) ON DELETE CASCADE,
  warehouse_id UUID REFERENCES org_warehouses(id) ON DELETE CASCADE,
  min_qty NUMERIC(18, 4) NOT NULL DEFAULT 0,
  max_qty NUMERIC(18, 4) NOT NULL DEFAULT 0,
  reorder_point NUMERIC(18, 4) NOT NULL DEFAULT 0,
  eoq NUMERIC(18, 4),
  days_of_supply INT,
  preferred_supplier_id UUID,
  UNIQUE (organization_id, sku_id, warehouse_id)
);

-- Harden credit ledger entry types if table already existed from a prior 019 draft
ALTER TABLE customer_credit_ledger DROP CONSTRAINT IF EXISTS customer_credit_ledger_entry_type_check;
ALTER TABLE customer_credit_ledger
  ADD CONSTRAINT customer_credit_ledger_entry_type_check
  CHECK (entry_type IN (
    'INVOICE', 'PAYMENT', 'CREDIT_NOTE', 'DEBIT_NOTE', 'ADJUSTMENT', 'HOLD', 'RELEASE'
  ));

INSERT INTO tenant_number_sequences (document_type, prefix, pad_length, reset_policy)
VALUES
  ('RET', 'RET-', 6, 'YEAR'),
  ('PR', 'PR-', 6, 'YEAR'),
  ('GRN', 'GRN-', 6, 'YEAR'),
  ('CN', 'CN-', 6, 'YEAR'),
  ('DN', 'DN-', 6, 'YEAR')
ON CONFLICT DO NOTHING;

INSERT INTO schema_migrations (version) VALUES ('019_commercial_reqs_31_45') ON CONFLICT DO NOTHING;
