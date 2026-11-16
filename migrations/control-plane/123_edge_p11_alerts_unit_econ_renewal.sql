-- Migration 123: P11 alerts policies + unit economics snapshots
-- Complements 122 (which already has edge_p11_business_alerts / decisions / reports / targets).
-- Tables below use edge_revenue_* names per mandate; edge_p11_* remain the canonical 122 set.
-- Soft UUID refs only — never invent financial amounts.

-- ---------------------------------------------------------------------------
-- Alert policies (threshold definitions) — missing from 122
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_revenue_business_alert_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  metric_code VARCHAR(64) NOT NULL,
  business_unit_id UUID REFERENCES edge_p11_business_units(id) ON DELETE SET NULL,
  comparator VARCHAR(16) NOT NULL DEFAULT 'GT'
    CHECK (comparator IN ('GT','GTE','LT','LTE','EQ')),
  threshold_value NUMERIC(24, 8) NOT NULL,
  severity VARCHAR(16) NOT NULL DEFAULT 'MEDIUM'
    CHECK (severity IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE','INACTIVE','ARCHIVED')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by VARCHAR(255) NOT NULL,
  updated_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  CONSTRAINT uq_edge_revenue_alert_policies_code UNIQUE (code)
);
CREATE INDEX IF NOT EXISTS idx_edge_revenue_alert_policies_metric
  ON edge_revenue_business_alert_policies (metric_code, status);

-- Mandate alias table for alerts fired from policies.
-- Prefer this when writing new alert rows; 122 edge_p11_business_alerts remains valid.
CREATE TABLE IF NOT EXISTS edge_revenue_business_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(64) NOT NULL,
  title VARCHAR(255) NOT NULL,
  policy_id UUID REFERENCES edge_revenue_business_alert_policies(id) ON DELETE SET NULL,
  severity VARCHAR(16) NOT NULL DEFAULT 'MEDIUM'
    CHECK (severity IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  status VARCHAR(32) NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN','ACKNOWLEDGED','RESOLVED','DISMISSED')),
  metric_code VARCHAR(64),
  observed_value NUMERIC(24, 8),
  threshold_value NUMERIC(24, 8),
  business_unit_id UUID REFERENCES edge_p11_business_units(id) ON DELETE SET NULL,
  as_of TIMESTAMPTZ NOT NULL,
  data_quality VARCHAR(32) NOT NULL DEFAULT 'ESTIMATED'
    CHECK (data_quality IN ('MEASURED','ESTIMATED','UNAVAILABLE')),
  source_provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  acknowledged_by VARCHAR(255),
  acknowledged_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by VARCHAR(255) NOT NULL,
  updated_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  CONSTRAINT uq_edge_revenue_business_alerts_code UNIQUE (code)
);
CREATE INDEX IF NOT EXISTS idx_edge_revenue_business_alerts_status
  ON edge_revenue_business_alerts (status, created_at DESC);

-- ---------------------------------------------------------------------------
-- Unit economics snapshots (dedicated; CAC/LTV also storable in metric snaps)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_revenue_unit_economics_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_unit_id UUID REFERENCES edge_p11_business_units(id) ON DELETE SET NULL,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  as_of TIMESTAMPTZ NOT NULL,
  currency VARCHAR(3) NOT NULL,
  cac_value NUMERIC(24, 8),
  cac_data_quality VARCHAR(32) NOT NULL
    CHECK (cac_data_quality IN ('MEASURED','ESTIMATED','UNAVAILABLE')),
  ltv_value NUMERIC(24, 8),
  ltv_data_quality VARCHAR(32) NOT NULL
    CHECK (ltv_data_quality IN ('MEASURED','ESTIMATED','UNAVAILABLE')),
  ltv_cac_value NUMERIC(24, 8),
  ltv_cac_data_quality VARCHAR(32) NOT NULL
    CHECK (ltv_cac_data_quality IN ('MEASURED','ESTIMATED','UNAVAILABLE')),
  payback_months_value NUMERIC(24, 8),
  payback_months_data_quality VARCHAR(32) NOT NULL
    CHECK (payback_months_data_quality IN ('MEASURED','ESTIMATED','UNAVAILABLE')),
  input_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  definition_version INTEGER NOT NULL DEFAULT 1 CHECK (definition_version >= 1),
  source_provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  CONSTRAINT chk_edge_revenue_ue_period CHECK (period_end >= period_start)
);
CREATE INDEX IF NOT EXISTS idx_edge_revenue_ue_snap_as_of
  ON edge_revenue_unit_economics_snapshots (business_unit_id, as_of DESC);

-- ---------------------------------------------------------------------------
-- Mandate-named companions for decisions / reports (122 already has edge_p11_*)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_revenue_business_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(64) NOT NULL,
  title VARCHAR(255) NOT NULL,
  decision_type VARCHAR(64) NOT NULL DEFAULT 'OPERATIONAL',
  status VARCHAR(32) NOT NULL DEFAULT 'PROPOSED'
    CHECK (status IN ('PROPOSED','APPROVED','REJECTED','SUPERSEDED','ARCHIVED')),
  rationale TEXT,
  decided_by VARCHAR(255),
  decided_at TIMESTAMPTZ,
  related_report_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by VARCHAR(255) NOT NULL,
  updated_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  CONSTRAINT uq_edge_revenue_business_decisions_code UNIQUE (code)
);

CREATE TABLE IF NOT EXISTS edge_revenue_business_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(64) NOT NULL,
  title VARCHAR(255) NOT NULL,
  report_type VARCHAR(64) NOT NULL DEFAULT 'REVENUE_OVERVIEW',
  business_unit_id UUID REFERENCES edge_p11_business_units(id) ON DELETE SET NULL,
  period_id UUID REFERENCES edge_p11_business_periods(id) ON DELETE SET NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'GENERATED'
    CHECK (status IN ('DRAFT','GENERATED','PUBLISHED','ARCHIVED')),
  as_of TIMESTAMPTZ NOT NULL,
  -- Immutable snapshot metadata only — no fabricated financial body
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  data_quality VARCHAR(32) NOT NULL DEFAULT 'ESTIMATED'
    CHECK (data_quality IN ('MEASURED','ESTIMATED','UNAVAILABLE')),
  definition_version INTEGER NOT NULL DEFAULT 1,
  source_provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  immutable BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by VARCHAR(255) NOT NULL,
  updated_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  CONSTRAINT uq_edge_revenue_business_reports_code UNIQUE (code)
);

INSERT INTO schema_migrations (version)
VALUES ('123_edge_p11_alerts_unit_econ_renewal')
ON CONFLICT DO NOTHING;
