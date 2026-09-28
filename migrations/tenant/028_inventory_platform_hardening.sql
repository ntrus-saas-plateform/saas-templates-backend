-- Migration 028: Platform hardening — filtering indexes, bulk jobs, soft delete,
-- feature flags, 3D layout, retention, versioned inventory config (reqs 58–97)

-- ========== INVENTORY CONFIG + FEATURE FLAGS (89–91) ==========
ALTER TABLE inventory_policies
  ADD COLUMN IF NOT EXISTS require_expiration_for_medication BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS require_approval_for_disposal BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS quarantine_returns BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_partial_transfer BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS feature_flags JSONB NOT NULL DEFAULT '{
    "serialTracking": true,
    "coldChain": true,
    "advancedAllocation": true,
    "forecasting": true,
    "3dWarehouse": false,
    "aiRecommendations": false
  }'::jsonb,
  ADD COLUMN IF NOT EXISTS retention JSONB NOT NULL DEFAULT '{
    "ledgerDays": 2555,
    "auditDays": 2555,
    "eventsDays": 730,
    "readingsDays": 365,
    "documentsDays": 2555
  }'::jsonb,
  ADD COLUMN IF NOT EXISTS job_schedules JSONB NOT NULL DEFAULT '{
    "expirationScan": "every:900s",
    "alerts": "every:300s",
    "replenishment": "0 2 * * *",
    "analytics": "0 3 * * *",
    "forecast": "0 4 * * 1",
    "dormant": "0 5 * * *",
    "temperature": "every:300s",
    "reports": "0 6 * * 0"
  }'::jsonb;

-- ========== SOFT DELETE (92) ==========
ALTER TABLE products ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE product_skus ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE org_warehouses ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE org_warehouse_zones ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE org_warehouse_locations ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE org_facilities ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_products_deleted ON products (organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_stock_lots_filters
  ON stock_lots (organization_id, warehouse_id, sku_id, quality_status, expires_at);

-- ========== 3D LAYOUT (80) ==========
ALTER TABLE org_warehouse_locations
  ADD COLUMN IF NOT EXISTS pos_x NUMERIC(12, 4),
  ADD COLUMN IF NOT EXISTS pos_y NUMERIC(12, 4),
  ADD COLUMN IF NOT EXISTS pos_z NUMERIC(12, 4),
  ADD COLUMN IF NOT EXISTS size_x NUMERIC(12, 4),
  ADD COLUMN IF NOT EXISTS size_y NUMERIC(12, 4),
  ADD COLUMN IF NOT EXISTS size_z NUMERIC(12, 4);

ALTER TABLE org_warehouse_zones
  ADD COLUMN IF NOT EXISTS pos_x NUMERIC(12, 4),
  ADD COLUMN IF NOT EXISTS pos_y NUMERIC(12, 4),
  ADD COLUMN IF NOT EXISTS pos_z NUMERIC(12, 4);

-- ========== BULK JOBS (59) ==========
CREATE TABLE IF NOT EXISTS inventory_bulk_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  job_type VARCHAR(40) NOT NULL
    CHECK (job_type IN (
      'BULK_BLOCK', 'BULK_QUARANTINE', 'BULK_TRANSFER', 'BULK_COUNT',
      'BULK_ADJUSTMENT', 'BULK_IMPORT', 'BULK_PRICE_UPDATE', 'BULK_EXPIRATION'
    )),
  status VARCHAR(30) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'VALIDATING', 'RUNNING', 'COMPLETED', 'PARTIAL_FAILURE', 'FAILED', 'CANCELLED')),
  total_items INT NOT NULL DEFAULT 0,
  processed_items INT NOT NULL DEFAULT 0,
  success_items INT NOT NULL DEFAULT 0,
  failed_items INT NOT NULL DEFAULT 0,
  max_items INT NOT NULL DEFAULT 1000,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  progress JSONB NOT NULL DEFAULT '{}'::jsonb,
  errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by VARCHAR(100),
  correlation_id VARCHAR(64),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inv_bulk_jobs_org ON inventory_bulk_jobs (organization_id, status, created_at DESC);

-- ========== ACCOUNTING EVENT OUTBOX HINTS (95) — use commercial outbox; table for inventory accounting intents ==========
CREATE TABLE IF NOT EXISTS inventory_accounting_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  event_type VARCHAR(80) NOT NULL,
  reference_type VARCHAR(40),
  reference_id UUID,
  sku_id UUID,
  lot_id UUID,
  quantity NUMERIC(18, 4),
  unit_cost NUMERIC(18, 6),
  currency VARCHAR(3) DEFAULT 'EUR',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'PUBLISHED', 'ACKED', 'FAILED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ
);

INSERT INTO schema_migrations (version) VALUES ('028_inventory_platform_hardening') ON CONFLICT DO NOTHING;
