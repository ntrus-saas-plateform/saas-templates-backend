-- Migration 025: Inventory WMS depth — lots, serials, locations, ledger, transfers, reservations, adjust, receiving (reqs 9–25)

-- ========== FACILITY (between org and warehouse) ==========
CREATE TABLE IF NOT EXISTS org_facilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  code VARCHAR(40) NOT NULL,
  name VARCHAR(255) NOT NULL,
  facility_type VARCHAR(40) NOT NULL DEFAULT 'PHARMACY',
  address JSONB NOT NULL DEFAULT '{}'::jsonb,
  active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, code)
);

ALTER TABLE org_warehouses
  ADD COLUMN IF NOT EXISTS facility_id UUID REFERENCES org_facilities(id) ON DELETE SET NULL;

-- ========== LOCATION HIERARCHY DEPTH ==========
-- Encode aisle/rack/shelf under zone via parent chain on locations
ALTER TABLE org_warehouse_locations
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES org_warehouse_locations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS hierarchy_level VARCHAR(20) NOT NULL DEFAULT 'BIN'
    CHECK (hierarchy_level IN ('AISLE', 'RACK', 'SHELF', 'BIN', 'OTHER'));

-- Soft enum for location types (free string kept; seed reference table)
CREATE TABLE IF NOT EXISTS location_type_codes (
  code VARCHAR(40) PRIMARY KEY,
  label VARCHAR(120) NOT NULL,
  is_system BOOLEAN NOT NULL DEFAULT true,
  active BOOLEAN NOT NULL DEFAULT true
);

INSERT INTO location_type_codes (code, label) VALUES
  ('RECEIVING', 'Receiving'),
  ('AVAILABLE', 'Available'),
  ('PICKING', 'Picking'),
  ('BULK', 'Bulk'),
  ('QUARANTINE', 'Quarantine'),
  ('DAMAGED', 'Damaged'),
  ('RETURNS', 'Returns'),
  ('EXPIRY', 'Expiry'),
  ('DISPOSAL', 'Disposal'),
  ('SHIPPING', 'Shipping'),
  ('TRANSIT', 'Transit'),
  ('COLD_STORAGE', 'Cold storage'),
  ('SECURE_STORAGE', 'Secure storage')
ON CONFLICT (code) DO NOTHING;

-- ========== LOTS — master + lifecycle ==========
ALTER TABLE stock_lots
  ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS manufacturer VARCHAR(255),
  ADD COLUMN IF NOT EXISTS supplier_id UUID,
  ADD COLUMN IF NOT EXISTS supplier_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS manufactured_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS received_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS initial_quantity NUMERIC(18, 4),
  ADD COLUMN IF NOT EXISTS lifecycle_status VARCHAR(30) NOT NULL DEFAULT 'AVAILABLE';

-- Expand quality_status via drop/recreate check when possible
ALTER TABLE stock_lots DROP CONSTRAINT IF EXISTS stock_lots_quality_status_check;
ALTER TABLE stock_lots
  ADD CONSTRAINT stock_lots_quality_status_check
  CHECK (quality_status IN (
    'RECEIVED', 'AVAILABLE', 'QUARANTINE', 'QUARANTINED', 'BLOCKED',
    'RECALLED', 'EXPIRED', 'DAMAGED', 'DESTROYED', 'DISPOSED'
  ));

ALTER TABLE stock_lots DROP CONSTRAINT IF EXISTS stock_lots_lifecycle_status_check;
ALTER TABLE stock_lots
  ADD CONSTRAINT stock_lots_lifecycle_status_check
  CHECK (lifecycle_status IN (
    'RECEIVED', 'AVAILABLE', 'RESERVED', 'ALLOCATED', 'QUARANTINED', 'BLOCKED',
    'RECALLED', 'EXPIRED', 'DAMAGED', 'DESTROYED', 'DISPOSED'
  ));

UPDATE stock_lots SET initial_quantity = COALESCE(initial_quantity, quantity_on_hand)
WHERE initial_quantity IS NULL;
UPDATE stock_lots SET received_at = COALESCE(received_at, created_at)
WHERE received_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_stock_lots_product ON stock_lots (product_id) WHERE product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_stock_lots_lifecycle ON stock_lots (lifecycle_status);

-- ========== SERIALS — full status machine ==========
ALTER TABLE stock_serials DROP CONSTRAINT IF EXISTS stock_serials_status_check;
ALTER TABLE stock_serials
  ADD COLUMN IF NOT EXISTS lot_id UUID REFERENCES stock_lots(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS location_id UUID,
  ADD COLUMN IF NOT EXISTS warehouse_id UUID,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE stock_serials
  ADD CONSTRAINT stock_serials_status_check
  CHECK (status IN (
    'SERIAL_CREATED', 'RECEIVED', 'AVAILABLE', 'RESERVED', 'ALLOCATED',
    'SOLD', 'ISSUED', 'TRANSFERRED', 'RETURNED', 'BLOCKED', 'RECALLED',
    'QUARANTINE', 'DISPOSED'
  ));

-- ========== LEDGER — richer transaction types + fields ==========
ALTER TABLE inventory_ledger
  ADD COLUMN IF NOT EXISTS facility_id UUID,
  ADD COLUMN IF NOT EXISTS product_id UUID,
  ADD COLUMN IF NOT EXISTS serial_id UUID,
  ADD COLUMN IF NOT EXISTS location_id UUID,
  ADD COLUMN IF NOT EXISTS unit VARCHAR(20),
  ADD COLUMN IF NOT EXISTS direction VARCHAR(10)
    CHECK (direction IS NULL OR direction IN ('IN', 'OUT', 'NONE')),
  ADD COLUMN IF NOT EXISTS approved_by VARCHAR(100),
  ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(128),
  ADD COLUMN IF NOT EXISTS reason TEXT;

-- Expand entry_type check
ALTER TABLE inventory_ledger DROP CONSTRAINT IF EXISTS inventory_ledger_entry_type_check;
ALTER TABLE inventory_ledger
  ADD CONSTRAINT inventory_ledger_entry_type_check
  CHECK (entry_type IN (
    'RECEIPT', 'SALE', 'TRANSFER_OUT', 'TRANSFER_IN', 'CUSTOMER_RETURN', 'SUPPLIER_RETURN',
    'RETURN', 'ADJUSTMENT', 'COUNT_ADJUSTMENT', 'DAMAGE', 'LOSS', 'THEFT',
    'EXPIRATION', 'DISPOSAL', 'QUARANTINE', 'RELEASE', 'RECALL',
    'INTERNAL_CONSUMPTION', 'SAMPLE', 'CORRECTION',
    'RESERVATION', 'ALLOCATION', 'RESERVATION_RELEASE', 'ISSUE'
  ));

CREATE INDEX IF NOT EXISTS idx_inventory_ledger_idempotency
  ON inventory_ledger (organization_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- ========== STOCK BALANCE PROJECTION (materialized-ish table) ==========
CREATE TABLE IF NOT EXISTS stock_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  facility_id UUID,
  warehouse_id UUID NOT NULL,
  location_id UUID,
  product_id UUID,
  sku_id UUID NOT NULL,
  lot_id UUID,
  serial_id UUID,
  stock_status VARCHAR(30) NOT NULL DEFAULT 'AVAILABLE',
  unit VARCHAR(20) NOT NULL DEFAULT 'EA',
  on_hand NUMERIC(18, 4) NOT NULL DEFAULT 0,
  available NUMERIC(18, 4) NOT NULL DEFAULT 0,
  reserved NUMERIC(18, 4) NOT NULL DEFAULT 0,
  allocated NUMERIC(18, 4) NOT NULL DEFAULT 0,
  blocked NUMERIC(18, 4) NOT NULL DEFAULT 0,
  quarantined NUMERIC(18, 4) NOT NULL DEFAULT 0,
  damaged NUMERIC(18, 4) NOT NULL DEFAULT 0,
  expired NUMERIC(18, 4) NOT NULL DEFAULT 0,
  in_transit NUMERIC(18, 4) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE NULLS NOT DISTINCT (organization_id, warehouse_id, location_id, sku_id, lot_id, serial_id, stock_status, unit)
);

CREATE INDEX IF NOT EXISTS idx_stock_balances_sku_wh
  ON stock_balances (organization_id, warehouse_id, sku_id);

-- ========== TRANSFERS — full state machine ==========
ALTER TABLE inventory_transfers DROP CONSTRAINT IF EXISTS inventory_transfers_status_check;
ALTER TABLE inventory_transfers
  ADD COLUMN IF NOT EXISTS requested_by VARCHAR(100),
  ADD COLUMN IF NOT EXISTS approved_by VARCHAR(100),
  ADD COLUMN IF NOT EXISTS transport_ref VARCHAR(120),
  ADD COLUMN IF NOT EXISTS dispatched_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS received_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS anomaly_notes TEXT;

ALTER TABLE inventory_transfers
  ADD CONSTRAINT inventory_transfers_status_check
  CHECK (status IN (
    'DRAFT', 'REQUESTED', 'APPROVED', 'PICKING', 'READY', 'DISPATCHED',
    'IN_TRANSIT', 'RECEIVED', 'PARTIALLY_RECEIVED', 'COMPLETED', 'CANCELLED', 'REJECTED'
  ));

-- ========== RESERVATIONS — extended statuses + context ==========
ALTER TABLE inventory_reservations DROP CONSTRAINT IF EXISTS inventory_reservations_status_check;
ALTER TABLE inventory_reservations
  ADD COLUMN IF NOT EXISTS context_type VARCHAR(40),
  ADD COLUMN IF NOT EXISTS context_id UUID,
  ADD COLUMN IF NOT EXISTS patient_id UUID,
  ADD COLUMN IF NOT EXISTS customer_id UUID;

ALTER TABLE inventory_reservations
  ADD CONSTRAINT inventory_reservations_status_check
  CHECK (status IN (
    'PENDING', 'ACTIVE', 'PARTIALLY_FULFILLED', 'FULFILLED', 'ALLOCATED',
    'EXPIRED', 'CANCELLED', 'RELEASED', 'CONSUMED'
  ));

-- ========== ADJUSTMENTS — controlled reasons + approval ==========
ALTER TABLE inventory_adjustments
  ADD COLUMN IF NOT EXISTS reason_code VARCHAR(40),
  ADD COLUMN IF NOT EXISTS approval_status VARCHAR(30) NOT NULL DEFAULT 'NONE'
    CHECK (approval_status IN ('NONE', 'PENDING', 'APPROVED', 'REJECTED')),
  ADD COLUMN IF NOT EXISTS approved_by VARCHAR(100),
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS workflow_instance_id UUID;

ALTER TABLE inventory_adjustments DROP CONSTRAINT IF EXISTS inventory_adjustments_reason_code_check;
ALTER TABLE inventory_adjustments
  ADD CONSTRAINT inventory_adjustments_reason_code_check
  CHECK (reason_code IS NULL OR reason_code IN (
    'DAMAGE', 'LOSS', 'THEFT', 'COUNT_CORRECTION', 'DATA_CORRECTION',
    'EXPIRATION', 'SYSTEM_ERROR', 'FOUND', 'OTHER'
  ));

-- ========== EXPECTED RECEIPTS / QC ==========
CREATE TABLE IF NOT EXISTS inventory_expected_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  warehouse_id UUID NOT NULL REFERENCES org_warehouses(id) ON DELETE RESTRICT,
  purchase_order_id UUID,
  goods_receipt_id UUID,
  status VARCHAR(30) NOT NULL DEFAULT 'EXPECTED'
    CHECK (status IN (
      'EXPECTED', 'RECEIVING', 'QTY_VERIFIED', 'LOT_VERIFIED', 'EXPIRY_VERIFIED',
      'QC_PENDING', 'QC_PASSED', 'QC_FAILED', 'ACCEPTED', 'POSTED', 'REJECTED', 'CANCELLED'
    )),
  expected_at TIMESTAMPTZ,
  notes TEXT,
  created_by VARCHAR(100),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory_expected_receipt_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expected_receipt_id UUID NOT NULL REFERENCES inventory_expected_receipts(id) ON DELETE CASCADE,
  sku_id UUID NOT NULL REFERENCES product_skus(id) ON DELETE RESTRICT,
  purchase_order_line_id UUID,
  expected_qty NUMERIC(18, 4) NOT NULL DEFAULT 0,
  received_qty NUMERIC(18, 4) NOT NULL DEFAULT 0,
  accepted_qty NUMERIC(18, 4) NOT NULL DEFAULT 0,
  rejected_qty NUMERIC(18, 4) NOT NULL DEFAULT 0,
  surplus_qty NUMERIC(18, 4) NOT NULL DEFAULT 0,
  shortage_qty NUMERIC(18, 4) NOT NULL DEFAULT 0,
  lot_number VARCHAR(100),
  expires_at DATE,
  quality_result VARCHAR(30)
    CHECK (quality_result IS NULL OR quality_result IN (
      'PENDING', 'PASS', 'FAIL', 'QUARANTINE', 'DAMAGE', 'WRONG_PRODUCT', 'WRONG_LOT', 'EXPIRY_TOO_CLOSE'
    )),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expected_receipts_po
  ON inventory_expected_receipts (purchase_order_id) WHERE purchase_order_id IS NOT NULL;

-- ========== PACKING ORDERS ==========
CREATE TABLE IF NOT EXISTS packing_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  warehouse_id UUID NOT NULL,
  sales_order_id UUID,
  shipment_id UUID,
  pick_ticket_id UUID,
  status VARCHAR(30) NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN', 'IN_PROGRESS', 'PACKED', 'LABELLED', 'SHIPPED', 'CANCELLED')),
  notes TEXT,
  created_by VARCHAR(100),
  packed_at TIMESTAMPTZ,
  labelled_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE packing_packages
  ADD COLUMN IF NOT EXISTS packing_order_id UUID REFERENCES packing_orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS temperature_min NUMERIC(8, 2),
  ADD COLUMN IF NOT EXISTS temperature_max NUMERIC(8, 2);

-- ========== SHIPMENTS — READY_TO_SHIP + cold chain ==========
ALTER TABLE shipments
  ADD COLUMN IF NOT EXISTS temperature_min NUMERIC(8, 2),
  ADD COLUMN IF NOT EXISTS temperature_max NUMERIC(8, 2),
  ADD COLUMN IF NOT EXISTS temp_logger_id VARCHAR(80),
  ADD COLUMN IF NOT EXISTS temperature_excursion BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE shipments DROP CONSTRAINT IF EXISTS shipments_status_check;
ALTER TABLE shipments
  ADD CONSTRAINT shipments_status_check
  CHECK (status IN (
    'CREATED', 'READY_TO_SHIP', 'SHIPPED', 'IN_TRANSIT', 'DELIVERED', 'FAILED', 'RETURNED', 'CANCELLED'
  ));

-- ========== PICK TASKS ==========
CREATE TABLE IF NOT EXISTS pick_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pick_ticket_id UUID NOT NULL REFERENCES pick_tickets(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  assigned_to VARCHAR(100),
  device_id VARCHAR(80),
  status VARCHAR(30) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pick_tasks_ticket ON pick_tasks (pick_ticket_id);

ALTER TABLE pick_tickets
  ADD COLUMN IF NOT EXISTS mobile_session BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS scanner_required BOOLEAN NOT NULL DEFAULT false;

INSERT INTO schema_migrations (version) VALUES ('025_inventory_wms_depth') ON CONFLICT DO NOTHING;
