-- Migration 023: Inventory foundation — locations capabilities, policies, idempotency, cycle counts

-- ========== LOCATION CAPABILITIES ==========
ALTER TABLE org_warehouse_zones
  ADD COLUMN IF NOT EXISTS location_type VARCHAR(40) NOT NULL DEFAULT 'AVAILABLE',
  ADD COLUMN IF NOT EXISTS temperature_profile VARCHAR(40),
  ADD COLUMN IF NOT EXISTS min_temperature NUMERIC(8, 2),
  ADD COLUMN IF NOT EXISTS max_temperature NUMERIC(8, 2),
  ADD COLUMN IF NOT EXISTS allowed_product_types JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE org_warehouse_locations
  ADD COLUMN IF NOT EXISTS location_type VARCHAR(40) NOT NULL DEFAULT 'AVAILABLE',
  ADD COLUMN IF NOT EXISTS capacity NUMERIC(18, 4),
  ADD COLUMN IF NOT EXISTS min_temperature NUMERIC(8, 2),
  ADD COLUMN IF NOT EXISTS max_temperature NUMERIC(8, 2),
  ADD COLUMN IF NOT EXISTS security_level VARCHAR(40) NOT NULL DEFAULT 'STANDARD',
  ADD COLUMN IF NOT EXISTS barcode VARCHAR(100),
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_org_wh_locations_barcode
  ON org_warehouse_locations (barcode) WHERE barcode IS NOT NULL;

-- ========== INVENTORY POLICIES ==========
CREATE TABLE IF NOT EXISTS inventory_policies (
  organization_id UUID PRIMARY KEY,
  allow_negative_stock BOOLEAN NOT NULL DEFAULT false,
  enable_fefo BOOLEAN NOT NULL DEFAULT true,
  expiration_warning_days INT NOT NULL DEFAULT 90 CHECK (expiration_warning_days >= 0),
  require_lot_for_medication BOOLEAN NOT NULL DEFAULT true,
  require_approval_for_adjustment BOOLEAN NOT NULL DEFAULT false,
  adjustment_approval_threshold NUMERIC(18, 4),
  allow_partial_receiving BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ========== IDEMPOTENCY ==========
CREATE TABLE IF NOT EXISTS inventory_idempotency_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  operation VARCHAR(40) NOT NULL
    CHECK (operation IN ('RECEIVE', 'TRANSFER', 'ADJUST', 'RESERVE')),
  idempotency_key VARCHAR(128) NOT NULL,
  request_hash VARCHAR(64) NOT NULL,
  response_body JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, operation, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_inv_idempotency_created
  ON inventory_idempotency_keys (created_at);

-- ========== CYCLE COUNTS ==========
CREATE TABLE IF NOT EXISTS inventory_count_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  warehouse_id UUID NOT NULL REFERENCES org_warehouses(id) ON DELETE RESTRICT,
  scope_type VARCHAR(30) NOT NULL DEFAULT 'FULL'
    CHECK (scope_type IN ('FULL', 'LOCATION', 'PRODUCT', 'LOT')),
  scope_ref_id UUID,
  status VARCHAR(30) NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'OPEN', 'COUNTING', 'PENDING_APPROVAL', 'POSTED', 'CANCELLED')),
  freeze_applied BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_by VARCHAR(100),
  approved_by VARCHAR(100),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  posted_at TIMESTAMPTZ,
  version INT NOT NULL DEFAULT 1,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inv_count_sessions_wh
  ON inventory_count_sessions (warehouse_id, status);

CREATE TABLE IF NOT EXISTS inventory_count_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES inventory_count_sessions(id) ON DELETE CASCADE,
  sku_id UUID NOT NULL REFERENCES product_skus(id) ON DELETE RESTRICT,
  lot_id UUID REFERENCES stock_lots(id) ON DELETE SET NULL,
  location_id UUID REFERENCES org_warehouse_locations(id) ON DELETE SET NULL,
  system_qty NUMERIC(18, 4) NOT NULL DEFAULT 0,
  counted_qty NUMERIC(18, 4),
  variance_qty NUMERIC(18, 4),
  status VARCHAR(30) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'COUNTED', 'POSTED', 'SKIPPED')),
  notes TEXT,
  counted_by VARCHAR(100),
  counted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inv_count_lines_session
  ON inventory_count_lines (session_id);

CREATE TABLE IF NOT EXISTS inventory_freezes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  warehouse_id UUID NOT NULL REFERENCES org_warehouses(id) ON DELETE CASCADE,
  scope_type VARCHAR(30) NOT NULL
    CHECK (scope_type IN ('FULL', 'LOCATION', 'PRODUCT', 'LOT')),
  scope_ref_id UUID,
  reason TEXT,
  session_id UUID REFERENCES inventory_count_sessions(id) ON DELETE SET NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_by VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  released_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_inv_freezes_active
  ON inventory_freezes (warehouse_id, active) WHERE active = true;

INSERT INTO schema_migrations (version) VALUES ('023_inventory_foundation') ON CONFLICT DO NOTHING;
