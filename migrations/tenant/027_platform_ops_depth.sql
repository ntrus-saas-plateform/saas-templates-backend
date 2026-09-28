-- Migration 027: Platform depth — alerts, scanner support, import harden, audit hash,
-- reporting KPIs, pricing cost fields, workflow/approval extensions (reqs 41–55)

-- ========== ALERTS (42) ==========
CREATE TABLE IF NOT EXISTS inventory_alert_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  alert_type VARCHAR(40) NOT NULL
    CHECK (alert_type IN (
      'LOW_STOCK', 'OUT_OF_STOCK', 'OVERSTOCK', 'EXPIRATION', 'EXPIRED', 'RECALL',
      'QUARANTINE', 'TEMPERATURE', 'VARIANCE', 'DORMANT_STOCK', 'NEGATIVE_STOCK',
      'PRICE_CHANGE', 'MARGIN_LOW', 'TRANSFER_DELAY', 'RECEIPT_DELAY'
    )),
  name VARCHAR(255) NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  threshold JSONB NOT NULL DEFAULT '{}'::jsonb,
  channels JSONB NOT NULL DEFAULT '["IN_APP"]'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, alert_type, name)
);

CREATE TABLE IF NOT EXISTS inventory_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  definition_id UUID REFERENCES inventory_alert_definitions(id) ON DELETE SET NULL,
  alert_type VARCHAR(40) NOT NULL,
  severity VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
  entity_type VARCHAR(40),
  entity_id UUID,
  warehouse_id UUID,
  sku_id UUID,
  message TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'DISMISSED')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acknowledged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_inventory_alerts_org_status
  ON inventory_alerts (organization_id, status, created_at DESC);

-- ========== AUDIT TAMPER-EVIDENT (49) ==========
-- Chain columns live on control-plane audit_logs (see 050_inventory_ops_depth_permissions.sql).
-- Tenant DBs may also have a local audit_logs mirror; alter if present.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'audit_logs'
  ) THEN
    ALTER TABLE audit_logs
      ADD COLUMN IF NOT EXISTS prev_hash VARCHAR(64),
      ADD COLUMN IF NOT EXISTS row_hash VARCHAR(64),
      ADD COLUMN IF NOT EXISTS device VARCHAR(120),
      ADD COLUMN IF NOT EXISTS reason TEXT;
    -- request_id often already exists; ADD IF NOT EXISTS is safe
    ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS request_id VARCHAR(64);
  END IF;
END $$;

-- ========== PRICING COST / INSTITUTIONAL (41) ==========
DO $$
BEGIN
  -- widen price list type if constrained
  ALTER TABLE price_lists DROP CONSTRAINT IF EXISTS price_lists_list_type_check;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

ALTER TABLE price_lists
  ADD COLUMN IF NOT EXISTS list_type VARCHAR(40);

-- Backfill list_type when newly added as nullable (018 may already have NOT NULL DEFAULT)
UPDATE price_lists SET list_type = COALESCE(list_type, 'RETAIL') WHERE list_type IS NULL;

ALTER TABLE price_list_items
  ADD COLUMN IF NOT EXISTS cost_price NUMERIC(18, 6),
  ADD COLUMN IF NOT EXISTS margin_pct NUMERIC(8, 4),
  ADD COLUMN IF NOT EXISTS institutional_price NUMERIC(18, 6);

-- ========== IMPORT HARDENING (46) ==========
ALTER TABLE commercial_import_batches
  ADD COLUMN IF NOT EXISTS source_format VARCHAR(20) NOT NULL DEFAULT 'JSON',
  ADD COLUMN IF NOT EXISTS mapping JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS validation_errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS duplicate_keys JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS commit_report JSONB NOT NULL DEFAULT '{}'::jsonb;
-- approved_by already exists from 020

DO $$
BEGIN
  ALTER TABLE commercial_import_batches DROP CONSTRAINT IF EXISTS commercial_import_batches_status_check;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

ALTER TABLE commercial_import_batches
  ADD CONSTRAINT commercial_import_batches_status_check
  CHECK (status IN (
    'UPLOADED', 'VALIDATING', 'VALIDATED', 'PREVIEW', 'TRANSFORMED',
    'PENDING_APPROVAL', 'APPROVED', 'IMPORTING', 'IMPORTED', 'FAILED', 'CANCELLED'
  ));

DO $$
BEGIN
  ALTER TABLE commercial_import_batches DROP CONSTRAINT IF EXISTS commercial_import_batches_source_format_check;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

ALTER TABLE commercial_import_batches
  ADD CONSTRAINT commercial_import_batches_source_format_check
  CHECK (source_format IN ('CSV', 'XLSX', 'JSON', 'API'));

-- ========== REPLENISHMENT / FORECAST LINK (38–39 already have tables; ensure method) ==========
-- demand_forecasts already exists in 019

-- ========== STOCK REPORTING MATERIALIZED HELPERS (47–48) ==========
CREATE TABLE IF NOT EXISTS inventory_kpi_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  warehouse_id UUID,
  kpi_date DATE NOT NULL,
  inventory_turnover NUMERIC(18, 6),
  stock_accuracy NUMERIC(8, 4),
  days_of_supply NUMERIC(18, 4),
  fill_rate NUMERIC(8, 4),
  stockout_rate NUMERIC(8, 4),
  expiration_rate NUMERIC(8, 4),
  shrinkage_rate NUMERIC(8, 4),
  dead_stock_rate NUMERIC(8, 4),
  inventory_carrying_value NUMERIC(18, 4),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, warehouse_id, kpi_date)
);

INSERT INTO schema_migrations (version) VALUES ('027_platform_ops_depth') ON CONFLICT DO NOTHING;
