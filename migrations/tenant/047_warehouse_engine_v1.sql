-- Migration 047: Warehouse & Logistics Engine Wave 1
-- Execution BC — does NOT own stock ledger (Inventory remains SoT)

-- ========== DOCKS ==========
CREATE TABLE IF NOT EXISTS warehouse_docks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  warehouse_id UUID NOT NULL,
  code VARCHAR(40) NOT NULL,
  name VARCHAR(255) NOT NULL,
  dock_type VARCHAR(40) NOT NULL DEFAULT 'BOTH'
    CHECK (dock_type IN ('INBOUND', 'OUTBOUND', 'BOTH')),
  status VARCHAR(30) NOT NULL DEFAULT 'AVAILABLE'
    CHECK (status IN ('AVAILABLE', 'OCCUPIED', 'MAINTENANCE', 'CLOSED')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, warehouse_id, code)
);
CREATE INDEX IF NOT EXISTS idx_warehouse_docks_wh
  ON warehouse_docks (organization_id, warehouse_id, status);

CREATE TABLE IF NOT EXISTS warehouse_dock_appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  warehouse_id UUID NOT NULL,
  dock_id UUID NOT NULL REFERENCES warehouse_docks(id) ON DELETE CASCADE,
  appointment_number VARCHAR(50) NOT NULL,
  asn_id UUID,
  carrier_name VARCHAR(255),
  expected_arrival_at TIMESTAMPTZ,
  status VARCHAR(30) NOT NULL DEFAULT 'SCHEDULED'
    CHECK (status IN ('SCHEDULED', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW')),
  version INT NOT NULL DEFAULT 1,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, appointment_number)
);

-- ========== ASN ==========
CREATE TABLE IF NOT EXISTS warehouse_asns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  warehouse_id UUID NOT NULL,
  asn_number VARCHAR(50) NOT NULL,
  purchase_order_id UUID,
  supplier_id UUID,
  supplier_name VARCHAR(255),
  carrier_name VARCHAR(255),
  expected_arrival_at TIMESTAMPTZ,
  status VARCHAR(30) NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN (
      'DRAFT', 'ANNOUNCED', 'IN_TRANSIT', 'ARRIVED', 'RECEIVING', 'RECEIVED', 'CANCELLED', 'CLOSED'
    )),
  version INT NOT NULL DEFAULT 1,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, asn_number)
);
CREATE INDEX IF NOT EXISTS idx_warehouse_asns_wh_status
  ON warehouse_asns (organization_id, warehouse_id, status);

CREATE TABLE IF NOT EXISTS warehouse_asn_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asn_id UUID NOT NULL REFERENCES warehouse_asns(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  line_number INT NOT NULL DEFAULT 1,
  sku_id UUID NOT NULL,
  expected_qty NUMERIC(18, 4) NOT NULL CHECK (expected_qty > 0),
  received_qty NUMERIC(18, 4) NOT NULL DEFAULT 0,
  lot_number VARCHAR(100),
  expires_at DATE,
  serials JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (asn_id, line_number)
);

-- ========== RECEIVING ==========
CREATE TABLE IF NOT EXISTS warehouse_receivings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  warehouse_id UUID NOT NULL,
  receiving_number VARCHAR(50) NOT NULL,
  asn_id UUID REFERENCES warehouse_asns(id) ON DELETE SET NULL,
  purchase_order_id UUID,
  dock_appointment_id UUID REFERENCES warehouse_dock_appointments(id) ON DELETE SET NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'EXPECTED'
    CHECK (status IN (
      'EXPECTED', 'ARRIVED', 'CHECKING', 'RECEIVING',
      'PARTIALLY_RECEIVED', 'RECEIVED', 'REJECTED', 'CANCELLED'
    )),
  version INT NOT NULL DEFAULT 1,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, receiving_number)
);
CREATE INDEX IF NOT EXISTS idx_warehouse_receivings_wh
  ON warehouse_receivings (organization_id, warehouse_id, status);

CREATE TABLE IF NOT EXISTS warehouse_receiving_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receiving_id UUID NOT NULL REFERENCES warehouse_receivings(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  asn_line_id UUID,
  sku_id UUID NOT NULL,
  expected_qty NUMERIC(18, 4) NOT NULL DEFAULT 0,
  received_qty NUMERIC(18, 4) NOT NULL DEFAULT 0,
  accepted_qty NUMERIC(18, 4) NOT NULL DEFAULT 0,
  rejected_qty NUMERIC(18, 4) NOT NULL DEFAULT 0,
  damaged_qty NUMERIC(18, 4) NOT NULL DEFAULT 0,
  lot_number VARCHAR(100),
  expires_at DATE,
  inventory_lot_id UUID,
  quality_result VARCHAR(30)
    CHECK (quality_result IS NULL OR quality_result IN (
      'PENDING', 'PASS', 'FAIL', 'QUARANTINE', 'DAMAGE'
    )),
  variance_type VARCHAR(40),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ========== PUTAWAY ==========
CREATE TABLE IF NOT EXISTS warehouse_putaway_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  warehouse_id UUID NOT NULL,
  task_number VARCHAR(50) NOT NULL,
  receiving_id UUID REFERENCES warehouse_receivings(id) ON DELETE SET NULL,
  receiving_line_id UUID,
  sku_id UUID NOT NULL,
  lot_id UUID,
  quantity NUMERIC(18, 4) NOT NULL CHECK (quantity > 0),
  source_location_id UUID,
  suggested_location_id UUID,
  destination_location_id UUID,
  status VARCHAR(30) NOT NULL DEFAULT 'CREATED'
    CHECK (status IN (
      'CREATED', 'ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'PAUSED',
      'COMPLETED', 'FAILED', 'CANCELLED'
    )),
  strategy_code VARCHAR(40) NOT NULL DEFAULT 'DEFAULT',
  assigned_to VARCHAR(128),
  priority INT NOT NULL DEFAULT 100,
  version INT NOT NULL DEFAULT 1,
  completed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, task_number)
);
CREATE INDEX IF NOT EXISTS idx_warehouse_putaway_wh_status
  ON warehouse_putaway_tasks (organization_id, warehouse_id, status);

-- ========== GENERIC WAREHOUSE TASKS ==========
CREATE TABLE IF NOT EXISTS warehouse_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  warehouse_id UUID NOT NULL,
  task_number VARCHAR(50) NOT NULL,
  task_type VARCHAR(40) NOT NULL
    CHECK (task_type IN (
      'PUTAWAY', 'PICK', 'PACK', 'MOVE', 'COUNT', 'REPACK', 'CROSS_DOCK', 'OTHER'
    )),
  reference_type VARCHAR(40),
  reference_id UUID,
  status VARCHAR(30) NOT NULL DEFAULT 'CREATED'
    CHECK (status IN (
      'CREATED', 'ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'PAUSED',
      'COMPLETED', 'FAILED', 'CANCELLED'
    )),
  assigned_to VARCHAR(128),
  priority INT NOT NULL DEFAULT 100,
  version INT NOT NULL DEFAULT 1,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, task_number)
);
CREATE INDEX IF NOT EXISTS idx_warehouse_tasks_wh_status
  ON warehouse_tasks (organization_id, warehouse_id, status);

-- ========== HANDLING UNITS (minimal) ==========
CREATE TABLE IF NOT EXISTS warehouse_handling_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  warehouse_id UUID NOT NULL,
  hu_number VARCHAR(50) NOT NULL,
  hu_type VARCHAR(40) NOT NULL DEFAULT 'CARTON'
    CHECK (hu_type IN ('CARTON', 'ENVELOPE', 'PALLET', 'CRATE', 'CONTAINER', 'COLD_BOX', 'SPECIAL_PACKAGE')),
  sscc VARCHAR(80),
  parent_hu_id UUID REFERENCES warehouse_handling_units(id) ON DELETE SET NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN', 'PACKED', 'SEALED', 'SHIPPED', 'CANCELLED')),
  weight NUMERIC(18, 4),
  weight_uom VARCHAR(10) NOT NULL DEFAULT 'KG',
  length NUMERIC(18, 4),
  width NUMERIC(18, 4),
  height NUMERIC(18, 4),
  dimension_uom VARCHAR(10) NOT NULL DEFAULT 'CM',
  shipment_id UUID,
  packing_session_id UUID,
  version INT NOT NULL DEFAULT 1,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, hu_number)
);

CREATE TABLE IF NOT EXISTS warehouse_handling_unit_contents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  handling_unit_id UUID NOT NULL REFERENCES warehouse_handling_units(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  sku_id UUID NOT NULL,
  lot_id UUID,
  quantity NUMERIC(18, 4) NOT NULL CHECK (quantity > 0),
  serial_number VARCHAR(120)
);

-- ========== PACKING SESSIONS ==========
CREATE TABLE IF NOT EXISTS warehouse_packing_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  warehouse_id UUID NOT NULL,
  session_number VARCHAR(50) NOT NULL,
  sales_order_id UUID,
  pick_ticket_id UUID,
  shipment_id UUID,
  status VARCHAR(30) NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN', 'IN_PROGRESS', 'PACKED', 'LABELLED', 'CANCELLED')),
  version INT NOT NULL DEFAULT 1,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, session_number)
);

-- ========== LOCATION TYPE EXTENSIONS ==========
INSERT INTO location_type_codes (code, label) VALUES
  ('STAGING_INBOUND', 'Staging inbound'),
  ('PUTAWAY', 'Putaway'),
  ('PICK_FACE', 'Pick face'),
  ('STAGING_OUTBOUND', 'Staging outbound'),
  ('CROSS_DOCK', 'Cross dock'),
  ('PACKING', 'Packing')
ON CONFLICT (code) DO NOTHING;

ALTER TABLE org_warehouse_locations
  ADD COLUMN IF NOT EXISTS putaway_allowed BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS picking_allowed BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS receiving_allowed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS quarantine_allowed BOOLEAN NOT NULL DEFAULT false;

-- ========== SEQUENCES ==========
INSERT INTO tenant_number_sequences (document_type, prefix, pad_length, reset_policy)
VALUES
  ('ASN', 'ASN-', 6, 'YEAR'),
  ('RCV', 'RCV-', 6, 'YEAR'),
  ('PUT', 'PUT-', 6, 'YEAR'),
  ('WHT', 'WHT-', 6, 'YEAR'),
  ('HU', 'HU-', 6, 'YEAR'),
  ('PKS', 'PKS-', 6, 'YEAR'),
  ('DOCKAPT', 'DA-', 6, 'YEAR')
ON CONFLICT DO NOTHING;

-- ========== CAPABILITIES ==========
INSERT INTO capability_definitions (code, name, description, category, status, required_modules, supported_verticals)
VALUES
  ('WAREHOUSE', 'Warehouse execution', 'WMS execution engine (not stock SoT)', 'WAREHOUSE', 'AVAILABLE', '["inventory"]'::jsonb, '["*"]'::jsonb),
  ('MULTI_WAREHOUSE', 'Multi-warehouse', 'Multi-warehouse fulfillment execution', 'WAREHOUSE', 'AVAILABLE', '["inventory"]'::jsonb, '["*"]'::jsonb),
  ('INBOUND', 'Inbound logistics', 'Inbound warehouse operations', 'WAREHOUSE', 'AVAILABLE', '["inventory"]'::jsonb, '["*"]'::jsonb),
  ('ASN', 'Advanced shipping notice', 'ASN documents', 'WAREHOUSE', 'AVAILABLE', '["inventory"]'::jsonb, '["*"]'::jsonb),
  ('RECEIVING', 'Receiving', 'Warehouse receiving execution', 'WAREHOUSE', 'AVAILABLE', '["inventory"]'::jsonb, '["*"]'::jsonb),
  ('DOCK_APPOINTMENTS', 'Dock appointments', 'Dock scheduling', 'WAREHOUSE', 'AVAILABLE', '["inventory"]'::jsonb, '["*"]'::jsonb),
  ('PUTAWAY', 'Putaway', 'Directed putaway tasks', 'WAREHOUSE', 'AVAILABLE', '["inventory"]'::jsonb, '["*"]'::jsonb),
  ('CROSS_DOCKING', 'Cross docking', 'Cross-dock flow', 'WAREHOUSE', 'EXPERIMENTAL', '["inventory"]'::jsonb, '["WHOLESALE","SUPERMARKET","*"]'::jsonb),
  ('OUTBOUND', 'Outbound logistics', 'Outbound warehouse operations', 'WAREHOUSE', 'AVAILABLE', '["inventory","fulfillment"]'::jsonb, '["*"]'::jsonb),
  ('PICKING', 'Picking', 'Picking execution', 'WAREHOUSE', 'AVAILABLE', '["inventory","fulfillment"]'::jsonb, '["*"]'::jsonb),
  ('WAVE_PICKING', 'Wave picking', 'Wave-based picking', 'WAREHOUSE', 'AVAILABLE', '["inventory","fulfillment"]'::jsonb, '["*"]'::jsonb),
  ('BATCH_PICKING', 'Batch picking', 'Batch picking strategy', 'WAREHOUSE', 'AVAILABLE', '["inventory","fulfillment"]'::jsonb, '["*"]'::jsonb),
  ('ZONE_PICKING', 'Zone picking', 'Zone picking strategy', 'WAREHOUSE', 'AVAILABLE', '["inventory","fulfillment"]'::jsonb, '["*"]'::jsonb),
  ('CLUSTER_PICKING', 'Cluster picking', 'Cluster picking strategy', 'WAREHOUSE', 'AVAILABLE', '["inventory","fulfillment"]'::jsonb, '["*"]'::jsonb),
  ('PACKING', 'Packing', 'Packing sessions', 'WAREHOUSE', 'AVAILABLE', '["inventory","fulfillment"]'::jsonb, '["*"]'::jsonb),
  ('HANDLING_UNITS', 'Handling units', 'HU / SSCC hierarchy', 'WAREHOUSE', 'AVAILABLE', '["inventory"]'::jsonb, '["*"]'::jsonb),
  ('SHIPPING', 'Shipping', 'Shipment dispatch execution', 'WAREHOUSE', 'AVAILABLE', '["inventory","fulfillment"]'::jsonb, '["*"]'::jsonb),
  ('SPLIT_SHIPMENT', 'Split shipment', 'Multi-warehouse split shipments', 'WAREHOUSE', 'AVAILABLE', '["inventory","fulfillment"]'::jsonb, '["*"]'::jsonb),
  ('PARTIAL_FULFILLMENT', 'Partial fulfillment', 'Partial ship policy execution', 'WAREHOUSE', 'AVAILABLE', '["inventory","fulfillment"]'::jsonb, '["*"]'::jsonb),
  ('WAREHOUSE_TASKS', 'Warehouse tasks', 'Generic warehouse task engine', 'WAREHOUSE', 'AVAILABLE', '["inventory"]'::jsonb, '["*"]'::jsonb),
  ('LOGISTICS_ANALYTICS', 'Logistics analytics', 'Warehouse KPIs', 'WAREHOUSE', 'EXPERIMENTAL', '["inventory"]'::jsonb, '["*"]'::jsonb)
ON CONFLICT (code) DO NOTHING;

INSERT INTO capability_dependencies (capability_code, depends_on_code) VALUES
  ('MULTI_WAREHOUSE', 'WAREHOUSE'),
  ('INBOUND', 'WAREHOUSE'),
  ('ASN', 'INBOUND'),
  ('RECEIVING', 'INBOUND'),
  ('DOCK_APPOINTMENTS', 'INBOUND'),
  ('PUTAWAY', 'RECEIVING'),
  ('CROSS_DOCKING', 'INBOUND'),
  ('OUTBOUND', 'WAREHOUSE'),
  ('PICKING', 'OUTBOUND'),
  ('WAVE_PICKING', 'PICKING'),
  ('BATCH_PICKING', 'PICKING'),
  ('ZONE_PICKING', 'PICKING'),
  ('CLUSTER_PICKING', 'PICKING'),
  ('PACKING', 'OUTBOUND'),
  ('HANDLING_UNITS', 'PACKING'),
  ('SHIPPING', 'OUTBOUND'),
  ('SPLIT_SHIPMENT', 'SHIPPING'),
  ('PARTIAL_FULFILLMENT', 'OUTBOUND'),
  ('WAREHOUSE_TASKS', 'WAREHOUSE'),
  ('LOGISTICS_ANALYTICS', 'WAREHOUSE')
ON CONFLICT DO NOTHING;

-- Compose into profiles that already have INVENTORY
UPDATE business_profiles bp
SET default_capabilities = (
  SELECT COALESCE(jsonb_agg(DISTINCT x), '[]'::jsonb)
  FROM (
    SELECT jsonb_array_elements_text(bp.default_capabilities) AS x
    UNION ALL SELECT 'WAREHOUSE'
    UNION ALL SELECT 'INBOUND'
    UNION ALL SELECT 'ASN'
    UNION ALL SELECT 'RECEIVING'
    UNION ALL SELECT 'PUTAWAY'
    UNION ALL SELECT 'OUTBOUND'
    UNION ALL SELECT 'PICKING'
    UNION ALL SELECT 'WAVE_PICKING'
    UNION ALL SELECT 'PACKING'
    UNION ALL SELECT 'SHIPPING'
    UNION ALL SELECT 'WAREHOUSE_TASKS'
    UNION ALL SELECT 'HANDLING_UNITS'
    UNION ALL SELECT 'MULTI_WAREHOUSE'
  ) s(x)
)
WHERE default_capabilities @> '["INVENTORY"]'::jsonb;

INSERT INTO schema_migrations (version) VALUES ('047_warehouse_engine_v1')
ON CONFLICT DO NOTHING;
