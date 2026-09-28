-- Migration 026: Inventory ops depth — counts, freeze, quarantine/QM, recall, genealogy,
-- expiration, storage, cold chain, dormant/overstock/stockout, valuation (reqs 26–40)

-- ========== COUNTS DEPTH (26) ==========
ALTER TABLE inventory_count_sessions
  ADD COLUMN IF NOT EXISTS count_type VARCHAR(30) NOT NULL DEFAULT 'CYCLE'
    CHECK (count_type IN ('FULL', 'CYCLE', 'SPOT', 'BLIND', 'RECOUNT')),
  ADD COLUMN IF NOT EXISTS freeze_policy VARCHAR(30) NOT NULL DEFAULT 'FULL_FREEZE'
    CHECK (freeze_policy IN ('FULL_FREEZE', 'LOCATION_FREEZE', 'PRODUCT_FREEZE', 'LOT_FREEZE', 'NONE')),
  ADD COLUMN IF NOT EXISTS counters JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS location_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS product_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS sku_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS require_double_count BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS variance_approval_required BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS parent_session_id UUID REFERENCES inventory_count_sessions(id) ON DELETE SET NULL;

ALTER TABLE inventory_count_lines
  ADD COLUMN IF NOT EXISTS counted_qty_2 NUMERIC(18, 4),
  ADD COLUMN IF NOT EXISTS counted_by_2 VARCHAR(100),
  ADD COLUMN IF NOT EXISTS counted_at_2 TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS variance_approved BOOLEAN,
  ADD COLUMN IF NOT EXISTS variance_approved_by VARCHAR(100),
  ADD COLUMN IF NOT EXISTS variance_approved_at TIMESTAMPTZ;

-- ========== FREEZE OPS MATRIX (27) — document in metadata; enforce in code ==========
ALTER TABLE inventory_freezes
  ADD COLUMN IF NOT EXISTS freeze_mode VARCHAR(30) NOT NULL DEFAULT 'FULL_FREEZE'
    CHECK (freeze_mode IN ('FULL_FREEZE', 'LOCATION_FREEZE', 'PRODUCT_FREEZE', 'LOT_FREEZE')),
  ADD COLUMN IF NOT EXISTS allowed_ops JSONB NOT NULL DEFAULT '["COUNT","RELEASE_FREEZE"]'::jsonb,
  ADD COLUMN IF NOT EXISTS forbidden_ops JSONB NOT NULL DEFAULT
    '["RECEIVE","TRANSFER","ADJUST","RESERVE","ALLOCATE","ISSUE","DISPATCH"]'::jsonb;

-- ========== QUARANTINE / QUALITY (28–29) ==========
CREATE TABLE IF NOT EXISTS quality_inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  lot_id UUID REFERENCES stock_lots(id) ON DELETE SET NULL,
  sku_id UUID,
  serial_id UUID,
  warehouse_id UUID,
  status VARCHAR(30) NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN', 'IN_PROGRESS', 'PASSED', 'FAILED', 'CANCELLED')),
  reason_code VARCHAR(40) NOT NULL
    CHECK (reason_code IN (
      'QUALITY', 'RETURN', 'RECALL', 'TEMPERATURE_EXCURSION', 'DAMAGE',
      'SUSPICION', 'MISSING_DOCUMENTATION', 'OTHER'
    )),
  decision VARCHAR(30)
    CHECK (decision IS NULL OR decision IN ('RELEASE', 'REJECT', 'REWORK', 'HOLD')),
  inspector_id VARCHAR(100),
  notes TEXT,
  document_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS non_conformances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  inspection_id UUID REFERENCES quality_inspections(id) ON DELETE SET NULL,
  lot_id UUID,
  code VARCHAR(40) NOT NULL,
  title VARCHAR(255) NOT NULL,
  severity VARCHAR(20) NOT NULL DEFAULT 'MEDIUM'
    CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  status VARCHAR(30) NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN', 'INVESTIGATING', 'CAPA', 'CLOSED', 'CANCELLED')),
  description TEXT,
  document_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS capa_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  non_conformance_id UUID NOT NULL REFERENCES non_conformances(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  title VARCHAR(255) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN', 'IN_PROGRESS', 'DONE', 'CANCELLED')),
  owner_id VARCHAR(100),
  due_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ========== RECALL ENGINE (30) ==========
ALTER TABLE product_recalls
  ADD COLUMN IF NOT EXISTS target_type VARCHAR(30) NOT NULL DEFAULT 'LOT',
  ADD COLUMN IF NOT EXISTS manufacturer VARCHAR(255),
  ADD COLUMN IF NOT EXISTS supplier_id UUID,
  ADD COLUMN IF NOT EXISTS date_from TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS date_to TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS serial_numbers JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS affected_lot_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS affected_customer_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS action_plan JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS closure_notes TEXT,
  ADD COLUMN IF NOT EXISTS closed_by VARCHAR(100);

-- Widen status lifecycle (column already existed with OPEN/IN_PROGRESS/…)
ALTER TABLE product_recalls DROP CONSTRAINT IF EXISTS product_recalls_status_check;
ALTER TABLE product_recalls ADD CONSTRAINT product_recalls_status_check
  CHECK (status IN (
    'DRAFT', 'OPEN', 'IDENTIFIED', 'BLOCKED', 'ACTIONS', 'RETURNS',
    'IN_PROGRESS', 'CLOSED', 'CANCELLED'
  ));
DO $$ BEGIN
  ALTER TABLE product_recalls ADD CONSTRAINT product_recalls_target_type_check
    CHECK (target_type IN ('PRODUCT', 'LOT', 'SERIAL', 'MANUFACTURER', 'DATE_RANGE', 'SUPPLIER'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ========== GENEALOGY (31) ==========
CREATE TABLE IF NOT EXISTS stock_lot_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  parent_lot_id UUID NOT NULL REFERENCES stock_lots(id) ON DELETE CASCADE,
  child_lot_id UUID NOT NULL REFERENCES stock_lots(id) ON DELETE CASCADE,
  link_type VARCHAR(30) NOT NULL
    CHECK (link_type IN ('RECEIPT', 'SPLIT', 'MERGE', 'TRANSFORM', 'KIT', 'REPACK')),
  quantity NUMERIC(18, 4),
  reference_type VARCHAR(40),
  reference_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (parent_lot_id, child_lot_id, link_type)
);

CREATE INDEX IF NOT EXISTS idx_lot_links_parent ON stock_lot_links (parent_lot_id);
CREATE INDEX IF NOT EXISTS idx_lot_links_child ON stock_lot_links (child_lot_id);

-- ========== EXPIRATION POLICIES (32) ==========
CREATE TABLE IF NOT EXISTS expiration_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  category VARCHAR(40) NOT NULL
    CHECK (category IN (
      'EXPIRED', 'EXPIRING_7_DAYS', 'EXPIRING_30_DAYS', 'EXPIRING_60_DAYS',
      'EXPIRING_90_DAYS', 'EXPIRING_180_DAYS'
    )),
  actions JSONB NOT NULL DEFAULT '["ALERT"]'::jsonb,
  product_type VARCHAR(40),
  active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, category, product_type)
);

-- ========== STORAGE CAPABILITIES (33) ==========
ALTER TABLE org_warehouse_locations
  ADD COLUMN IF NOT EXISTS min_humidity NUMERIC(8, 2),
  ADD COLUMN IF NOT EXISTS max_humidity NUMERIC(8, 2),
  ADD COLUMN IF NOT EXISTS light_sensitive BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cold_chain BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS secure BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS storage_requirements JSONB NOT NULL DEFAULT '{}'::jsonb;
-- shape: { minTemperature, maxTemperature, minHumidity, maxHumidity, lightSensitive, coldChain, secure }

-- ========== COLD CHAIN (34) ==========
CREATE TABLE IF NOT EXISTS cold_chain_sensors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  warehouse_id UUID,
  location_id UUID,
  code VARCHAR(80) NOT NULL,
  name VARCHAR(255),
  sensor_type VARCHAR(40) NOT NULL DEFAULT 'TEMPERATURE',
  active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, code)
);

CREATE TABLE IF NOT EXISTS cold_chain_readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sensor_id UUID NOT NULL REFERENCES cold_chain_sensors(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  temperature NUMERIC(8, 2),
  humidity NUMERIC(8, 2),
  raw JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_cold_readings_sensor_time
  ON cold_chain_readings (sensor_id, recorded_at DESC);

CREATE TABLE IF NOT EXISTS cold_chain_excursions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  sensor_id UUID REFERENCES cold_chain_sensors(id) ON DELETE SET NULL,
  location_id UUID,
  warehouse_id UUID,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  min_temperature NUMERIC(8, 2),
  max_temperature NUMERIC(8, 2),
  status VARCHAR(30) NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN', 'REVIEW', 'CLOSED')),
  impacted_lot_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  alert_sent BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ========== DORMANT / OVERSTOCK / STOCKOUT PREDICTION (35–37) ==========
CREATE TABLE IF NOT EXISTS inventory_analytics_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  warehouse_id UUID NOT NULL,
  sku_id UUID NOT NULL,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  on_hand NUMERIC(18, 4) NOT NULL DEFAULT 0,
  dormant_bucket VARCHAR(30)
    CHECK (dormant_bucket IS NULL OR dormant_bucket IN (
      'NO_MOVEMENT_30', 'NO_MOVEMENT_60', 'NO_MOVEMENT_90', 'NO_MOVEMENT_180', 'NO_MOVEMENT_365', 'ACTIVE'
    )),
  days_since_movement INT,
  days_since_sale INT,
  immobilized_value NUMERIC(18, 4),
  last_movement_at TIMESTAMPTZ,
  last_sale_at TIMESTAMPTZ,
  coverage_days NUMERIC(18, 4),
  recommendation TEXT,
  is_overstock BOOLEAN NOT NULL DEFAULT false,
  optimal_stock NUMERIC(18, 4),
  days_until_stockout NUMERIC(18, 4),
  stockout_probability NUMERIC(8, 4),
  expected_stockout_date DATE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, warehouse_id, sku_id, snapshot_date)
);

-- ========== VALUATION (40) ==========
CREATE TABLE IF NOT EXISTS stock_cost_layers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  warehouse_id UUID NOT NULL,
  sku_id UUID NOT NULL,
  lot_id UUID REFERENCES stock_lots(id) ON DELETE SET NULL,
  method VARCHAR(20) NOT NULL
    CHECK (method IN ('WEIGHTED_AVERAGE', 'FIFO', 'STANDARD')),
  unit_cost NUMERIC(18, 6) NOT NULL,
  quantity_remaining NUMERIC(18, 4) NOT NULL DEFAULT 0,
  currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
  source_type VARCHAR(40),
  source_id UUID,
  effective_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stock_cost_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  sku_id UUID NOT NULL,
  warehouse_id UUID,
  lot_id UUID,
  method VARCHAR(20) NOT NULL,
  unit_cost NUMERIC(18, 6) NOT NULL,
  average_cost NUMERIC(18, 6),
  last_purchase_cost NUMERIC(18, 6),
  standard_cost NUMERIC(18, 6),
  currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_cost_layers_sku ON stock_cost_layers (organization_id, sku_id, warehouse_id);

ALTER TABLE inventory_reorder_policies
  ADD COLUMN IF NOT EXISTS safety_stock_qty NUMERIC(18, 4);

INSERT INTO schema_migrations (version) VALUES ('026_inventory_ops_depth') ON CONFLICT DO NOTHING;
