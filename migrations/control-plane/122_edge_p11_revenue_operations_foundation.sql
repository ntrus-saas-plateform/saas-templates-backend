-- Migration 122: P11.0–P11.1 SaaS Business & Revenue Operations foundation
-- READ/ANALYTICS + commission/forecast/risk workflows only.
-- NEVER create invoices, payments, subscriptions, or tenants.
-- Soft UUID refs to P5/P6 IDs only — no hard FKs into subscription/billing tables.
-- Metric snapshots require definition_version, provenance, data_quality, currency, as_of.
-- Seed must never invent financial amounts as production truth.

INSERT INTO edge_permissions (code, description) VALUES
  ('platform:business:read', 'Read SaaS business units, periods, reports, decisions'),
  ('platform:business:manage', 'Manage business units, actions, alerts, decisions'),
  ('platform:business:planning', 'Manage revenue planning and business periods'),
  ('platform:business:targets:manage', 'Manage revenue targets'),
  ('platform:business:reports:manage', 'Manage business reports'),
  ('platform:business:metrics:manage', 'Register/publish revenue metric definitions and snapshots'),
  ('platform:business:governance:manage', 'Manage business governance and audit access'),
  ('platform:revenue:read', 'Read revenue streams, snapshots, forecasts, risks, reconciliations'),
  ('platform:revenue:forecast', 'Create and manage revenue forecasts/scenarios'),
  ('platform:revenue:approve', 'Approve forecasts, reconciliations, leakage remediations'),
  ('platform:revenue:reconcile', 'Run/record revenue reconciliations and leakage cases'),
  ('platform:revenue:export', 'Export revenue analytics and reports'),
  ('platform:commission:read', 'Read commission plans, accruals, calculations'),
  ('platform:commission:calculate', 'Calculate commission snapshots (immutable)'),
  ('platform:commission:approve', 'Approve commission calculations')
ON CONFLICT (code) DO NOTHING;

INSERT INTO edge_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM edge_roles r
INNER JOIN edge_permissions p ON p.code IN (
  'platform:business:read',
  'platform:business:manage',
  'platform:business:planning',
  'platform:business:targets:manage',
  'platform:business:reports:manage',
  'platform:business:metrics:manage',
  'platform:business:governance:manage',
  'platform:revenue:read',
  'platform:revenue:forecast',
  'platform:revenue:approve',
  'platform:revenue:reconcile',
  'platform:revenue:export',
  'platform:commission:read',
  'platform:commission:calculate',
  'platform:commission:approve'
)
WHERE r.code = 'EDGE_PLATFORM_SUPER_ADMIN'
ON CONFLICT DO NOTHING;

-- Subset read for EDGE_PLATFORM_OPERATOR when the role exists.
INSERT INTO edge_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM edge_roles r
INNER JOIN edge_permissions p ON p.code IN (
  'platform:business:read',
  'platform:revenue:read',
  'platform:commission:read'
)
WHERE r.code = 'EDGE_PLATFORM_OPERATOR'
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- Business units & revenue streams
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_p11_business_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  parent_unit_id UUID REFERENCES edge_p11_business_units(id) ON DELETE SET NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE','INACTIVE','ARCHIVED')),
  owner_ref VARCHAR(255),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by VARCHAR(255) NOT NULL,
  updated_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  CONSTRAINT uq_edge_p11_business_units_code UNIQUE (code)
);

CREATE TABLE IF NOT EXISTS edge_p11_revenue_streams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  business_unit_id UUID REFERENCES edge_p11_business_units(id) ON DELETE SET NULL,
  stream_type VARCHAR(64) NOT NULL DEFAULT 'SUBSCRIPTION'
    CHECK (stream_type IN ('SUBSCRIPTION','USAGE','SERVICES','PARTNER','OTHER')),
  -- Soft refs to P5/P6 products/plans — never invent commercial truth
  product_ref_id UUID,
  commercial_plan_ref_id UUID,
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE','INACTIVE','ARCHIVED')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by VARCHAR(255) NOT NULL,
  updated_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  CONSTRAINT uq_edge_p11_revenue_streams_code UNIQUE (code)
);
CREATE INDEX IF NOT EXISTS idx_edge_p11_revenue_streams_bu
  ON edge_p11_revenue_streams (business_unit_id, status);

-- ---------------------------------------------------------------------------
-- Metric definitions (versioned) + immutable published copies + snapshots
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_p11_metric_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  formula TEXT NOT NULL,
  sources JSONB NOT NULL DEFAULT '[]'::jsonb,
  currency_treatment VARCHAR(64) NOT NULL DEFAULT 'NATIVE'
    CHECK (currency_treatment IN ('NATIVE','CONVERT_TO_REPORTING','UNITLESS')),
  time_basis VARCHAR(64) NOT NULL DEFAULT 'PERIOD_END'
    CHECK (time_basis IN ('PERIOD_END','PERIOD_START','PERIOD_AVERAGE','POINT_IN_TIME','TRAILING')),
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT','PUBLISHED','DEPRECATED')),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  current_published_version_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by VARCHAR(255) NOT NULL,
  updated_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_edge_p11_metric_definitions_code UNIQUE (code)
);

CREATE TABLE IF NOT EXISTS edge_p11_metric_definition_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  definition_id UUID NOT NULL REFERENCES edge_p11_metric_definitions(id) ON DELETE RESTRICT,
  version_number INTEGER NOT NULL CHECK (version_number >= 1),
  code VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  formula TEXT NOT NULL,
  sources JSONB NOT NULL DEFAULT '[]'::jsonb,
  currency_treatment VARCHAR(64) NOT NULL,
  time_basis VARCHAR(64) NOT NULL,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_by VARCHAR(255) NOT NULL,
  immutable BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_edge_p11_metric_def_versions UNIQUE (definition_id, version_number)
);
CREATE INDEX IF NOT EXISTS idx_edge_p11_metric_def_versions_code
  ON edge_p11_metric_definition_versions (code, version_number);

ALTER TABLE edge_p11_metric_definitions
  DROP CONSTRAINT IF EXISTS edge_p11_metric_defs_pub_ver_fkey;
ALTER TABLE edge_p11_metric_definitions
  ADD CONSTRAINT edge_p11_metric_defs_pub_ver_fkey
  FOREIGN KEY (current_published_version_id)
  REFERENCES edge_p11_metric_definition_versions(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS edge_p11_metric_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_code VARCHAR(64) NOT NULL,
  definition_version INTEGER NOT NULL CHECK (definition_version >= 1),
  definition_version_id UUID REFERENCES edge_p11_metric_definition_versions(id) ON DELETE SET NULL,
  business_unit_id UUID REFERENCES edge_p11_business_units(id) ON DELETE SET NULL,
  revenue_stream_id UUID REFERENCES edge_p11_revenue_streams(id) ON DELETE SET NULL,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  as_of TIMESTAMPTZ NOT NULL,
  value NUMERIC(24, 8),
  currency VARCHAR(3) NOT NULL,
  data_quality VARCHAR(32) NOT NULL
    CHECK (data_quality IN ('MEASURED','ESTIMATED','UNAVAILABLE')),
  source_provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  CONSTRAINT chk_edge_p11_metric_snap_period CHECK (period_end >= period_start),
  CONSTRAINT chk_edge_p11_metric_snap_value_quality CHECK (
    (data_quality = 'UNAVAILABLE' AND value IS NULL)
    OR (data_quality IN ('MEASURED','ESTIMATED') AND value IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS idx_edge_p11_metric_snapshots_lookup
  ON edge_p11_metric_snapshots (metric_code, period_end DESC, as_of DESC);
CREATE INDEX IF NOT EXISTS idx_edge_p11_metric_snapshots_bu
  ON edge_p11_metric_snapshots (business_unit_id, metric_code, as_of DESC);

-- ---------------------------------------------------------------------------
-- Targets, forecasts, scenarios, forecast snapshots
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_p11_revenue_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  business_unit_id UUID REFERENCES edge_p11_business_units(id) ON DELETE SET NULL,
  revenue_stream_id UUID REFERENCES edge_p11_revenue_streams(id) ON DELETE SET NULL,
  metric_code VARCHAR(64) NOT NULL,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  target_value NUMERIC(24, 8) NOT NULL,
  currency VARCHAR(3) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT','ACTIVE','SUPERSEDED','ARCHIVED')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by VARCHAR(255) NOT NULL,
  updated_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  CONSTRAINT uq_edge_p11_revenue_targets_code UNIQUE (code)
);

CREATE TABLE IF NOT EXISTS edge_p11_revenue_forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  business_unit_id UUID REFERENCES edge_p11_business_units(id) ON DELETE SET NULL,
  horizon_start TIMESTAMPTZ NOT NULL,
  horizon_end TIMESTAMPTZ NOT NULL,
  currency VARCHAR(3) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT','IN_REVIEW','PUBLISHED','SUPERSEDED','ARCHIVED')),
  published_at TIMESTAMPTZ,
  published_by VARCHAR(255),
  immutable_after_publish BOOLEAN NOT NULL DEFAULT TRUE,
  assumptions JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by VARCHAR(255) NOT NULL,
  updated_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  CONSTRAINT uq_edge_p11_revenue_forecasts_code UNIQUE (code)
);

CREATE TABLE IF NOT EXISTS edge_p11_revenue_forecast_scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  forecast_id UUID NOT NULL REFERENCES edge_p11_revenue_forecasts(id) ON DELETE RESTRICT,
  code VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  scenario_type VARCHAR(32) NOT NULL DEFAULT 'BASE'
    CHECK (scenario_type IN ('BASE','UPSIDE','DOWNSIDE','STRESS','CUSTOM')),
  assumptions JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT','ACTIVE','ARCHIVED')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by VARCHAR(255) NOT NULL,
  updated_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  CONSTRAINT uq_edge_p11_forecast_scenarios UNIQUE (forecast_id, code)
);

CREATE TABLE IF NOT EXISTS edge_p11_revenue_forecast_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  forecast_id UUID NOT NULL REFERENCES edge_p11_revenue_forecasts(id) ON DELETE RESTRICT,
  scenario_id UUID REFERENCES edge_p11_revenue_forecast_scenarios(id) ON DELETE SET NULL,
  metric_code VARCHAR(64) NOT NULL,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  as_of TIMESTAMPTZ NOT NULL,
  value NUMERIC(24, 8),
  currency VARCHAR(3) NOT NULL,
  data_quality VARCHAR(32) NOT NULL
    CHECK (data_quality IN ('MEASURED','ESTIMATED','UNAVAILABLE')),
  definition_version INTEGER NOT NULL DEFAULT 1 CHECK (definition_version >= 1),
  source_provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1)
);
CREATE INDEX IF NOT EXISTS idx_edge_p11_forecast_snapshots
  ON edge_p11_revenue_forecast_snapshots (forecast_id, metric_code, period_end);

-- ---------------------------------------------------------------------------
-- Risks, leakage, reconciliations, anomalies
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_p11_revenue_risks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(64) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  business_unit_id UUID REFERENCES edge_p11_business_units(id) ON DELETE SET NULL,
  risk_category VARCHAR(64) NOT NULL DEFAULT 'LEAKAGE'
    CHECK (risk_category IN ('LEAKAGE','CHURN','CONCENTRATION','FORECAST','COLLECTION','OTHER')),
  probability VARCHAR(16) NOT NULL DEFAULT 'MEDIUM'
    CHECK (probability IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  impact VARCHAR(16) NOT NULL DEFAULT 'MEDIUM'
    CHECK (impact IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  estimated_exposure NUMERIC(24, 8),
  currency VARCHAR(3),
  data_quality VARCHAR(32) NOT NULL DEFAULT 'ESTIMATED'
    CHECK (data_quality IN ('MEASURED','ESTIMATED','UNAVAILABLE')),
  status VARCHAR(32) NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN','MITIGATING','ACCEPTED','CLOSED')),
  owner_ref VARCHAR(255),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by VARCHAR(255) NOT NULL,
  updated_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  CONSTRAINT uq_edge_p11_revenue_risks_code UNIQUE (code)
);

CREATE TABLE IF NOT EXISTS edge_p11_revenue_leakage_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_number VARCHAR(64) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  business_unit_id UUID REFERENCES edge_p11_business_units(id) ON DELETE SET NULL,
  revenue_stream_id UUID REFERENCES edge_p11_revenue_streams(id) ON DELETE SET NULL,
  -- Soft refs to P5 subscription / P6 invoice artifacts
  subscription_ref_id UUID,
  invoice_ref_id UUID,
  detected_amount NUMERIC(24, 8),
  currency VARCHAR(3),
  data_quality VARCHAR(32) NOT NULL DEFAULT 'ESTIMATED'
    CHECK (data_quality IN ('MEASURED','ESTIMATED','UNAVAILABLE')),
  status VARCHAR(32) NOT NULL DEFAULT 'DETECTED'
    CHECK (status IN (
      'DETECTED','TRIAGED','INVESTIGATING','CONFIRMED','REMEDIATING',
      'RESOLVED','WRITTEN_OFF','FALSE_POSITIVE','CLOSED'
    )),
  detection_source VARCHAR(128) NOT NULL,
  source_provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  assigned_to VARCHAR(255),
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by VARCHAR(255) NOT NULL,
  updated_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  CONSTRAINT uq_edge_p11_leakage_cases_number UNIQUE (case_number)
);
CREATE INDEX IF NOT EXISTS idx_edge_p11_leakage_status
  ON edge_p11_revenue_leakage_cases (status, created_at DESC);

CREATE TABLE IF NOT EXISTS edge_p11_revenue_reconciliations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(64) NOT NULL,
  title VARCHAR(255) NOT NULL,
  business_unit_id UUID REFERENCES edge_p11_business_units(id) ON DELETE SET NULL,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  as_of TIMESTAMPTZ NOT NULL,
  currency VARCHAR(3) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT','IN_PROGRESS','PENDING_APPROVAL','APPROVED','REJECTED','CLOSED')),
  left_source VARCHAR(128) NOT NULL,
  right_source VARCHAR(128) NOT NULL,
  variance_amount NUMERIC(24, 8),
  data_quality VARCHAR(32) NOT NULL DEFAULT 'ESTIMATED'
    CHECK (data_quality IN ('MEASURED','ESTIMATED','UNAVAILABLE')),
  definition_version INTEGER NOT NULL DEFAULT 1,
  source_provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  approved_by VARCHAR(255),
  approved_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by VARCHAR(255) NOT NULL,
  updated_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  CONSTRAINT uq_edge_p11_reconciliations_code UNIQUE (code)
);

CREATE TABLE IF NOT EXISTS edge_p11_revenue_anomalies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(64) NOT NULL,
  title VARCHAR(255) NOT NULL,
  metric_code VARCHAR(64),
  business_unit_id UUID REFERENCES edge_p11_business_units(id) ON DELETE SET NULL,
  severity VARCHAR(16) NOT NULL DEFAULT 'MEDIUM'
    CHECK (severity IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  status VARCHAR(32) NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN','ACKNOWLEDGED','INVESTIGATING','RESOLVED','DISMISSED')),
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  as_of TIMESTAMPTZ NOT NULL,
  observed_value NUMERIC(24, 8),
  expected_value NUMERIC(24, 8),
  currency VARCHAR(3),
  data_quality VARCHAR(32) NOT NULL DEFAULT 'ESTIMATED'
    CHECK (data_quality IN ('MEASURED','ESTIMATED','UNAVAILABLE')),
  source_provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by VARCHAR(255) NOT NULL,
  updated_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  CONSTRAINT uq_edge_p11_anomalies_code UNIQUE (code)
);

-- ---------------------------------------------------------------------------
-- Profitability & commercial performance snapshots
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_p11_customer_profitability_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Soft P5 account/subscription refs
  customer_account_ref_id UUID,
  subscription_ref_id UUID,
  business_unit_id UUID REFERENCES edge_p11_business_units(id) ON DELETE SET NULL,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  as_of TIMESTAMPTZ NOT NULL,
  revenue_amount NUMERIC(24, 8),
  cost_amount NUMERIC(24, 8),
  margin_amount NUMERIC(24, 8),
  currency VARCHAR(3) NOT NULL,
  data_quality VARCHAR(32) NOT NULL
    CHECK (data_quality IN ('MEASURED','ESTIMATED','UNAVAILABLE')),
  definition_version INTEGER NOT NULL DEFAULT 1,
  source_provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1)
);
CREATE INDEX IF NOT EXISTS idx_edge_p11_cust_profit
  ON edge_p11_customer_profitability_snapshots (customer_account_ref_id, as_of DESC);

CREATE TABLE IF NOT EXISTS edge_p11_product_profitability_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_ref_id UUID,
  commercial_plan_ref_id UUID,
  business_unit_id UUID REFERENCES edge_p11_business_units(id) ON DELETE SET NULL,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  as_of TIMESTAMPTZ NOT NULL,
  revenue_amount NUMERIC(24, 8),
  cost_amount NUMERIC(24, 8),
  margin_amount NUMERIC(24, 8),
  currency VARCHAR(3) NOT NULL,
  data_quality VARCHAR(32) NOT NULL
    CHECK (data_quality IN ('MEASURED','ESTIMATED','UNAVAILABLE')),
  definition_version INTEGER NOT NULL DEFAULT 1,
  source_provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1)
);

CREATE TABLE IF NOT EXISTS edge_p11_commercial_performance_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_unit_id UUID REFERENCES edge_p11_business_units(id) ON DELETE SET NULL,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  as_of TIMESTAMPTZ NOT NULL,
  metric_code VARCHAR(64) NOT NULL,
  value NUMERIC(24, 8),
  currency VARCHAR(3) NOT NULL,
  data_quality VARCHAR(32) NOT NULL
    CHECK (data_quality IN ('MEASURED','ESTIMATED','UNAVAILABLE')),
  definition_version INTEGER NOT NULL DEFAULT 1,
  source_provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1)
);

-- ---------------------------------------------------------------------------
-- Commission plans / rules / accruals / calculations / approvals
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_p11_commission_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT','ACTIVE','DEPRECATED','ARCHIVED')),
  effective_from TIMESTAMPTZ NOT NULL,
  effective_to TIMESTAMPTZ,
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by VARCHAR(255) NOT NULL,
  updated_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  CONSTRAINT uq_edge_p11_commission_plans_code UNIQUE (code)
);

CREATE TABLE IF NOT EXISTS edge_p11_commission_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES edge_p11_commission_plans(id) ON DELETE RESTRICT,
  code VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  rule_type VARCHAR(64) NOT NULL DEFAULT 'PERCENT_OF_MRR'
    CHECK (rule_type IN ('PERCENT_OF_MRR','PERCENT_OF_ARR','FLAT','TIERED','CUSTOM')),
  rate NUMERIC(12, 6),
  definition JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE','INACTIVE','ARCHIVED')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  CONSTRAINT uq_edge_p11_commission_rules UNIQUE (plan_id, code)
);

CREATE TABLE IF NOT EXISTS edge_p11_commission_accruals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES edge_p11_commission_plans(id) ON DELETE RESTRICT,
  partner_account_id UUID,
  -- Soft P5/P6 refs
  subscription_ref_id UUID,
  invoice_ref_id UUID,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  as_of TIMESTAMPTZ NOT NULL,
  accrued_amount NUMERIC(24, 8),
  currency VARCHAR(3) NOT NULL,
  data_quality VARCHAR(32) NOT NULL
    CHECK (data_quality IN ('MEASURED','ESTIMATED','UNAVAILABLE')),
  definition_version INTEGER NOT NULL DEFAULT 1,
  source_provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(32) NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN','LOCKED','REVERSED','CLOSED')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1)
);

CREATE TABLE IF NOT EXISTS edge_p11_commission_calculations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES edge_p11_commission_plans(id) ON DELETE RESTRICT,
  calculation_key VARCHAR(128) NOT NULL,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  as_of TIMESTAMPTZ NOT NULL,
  input_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  result_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  total_amount NUMERIC(24, 8),
  currency VARCHAR(3) NOT NULL,
  data_quality VARCHAR(32) NOT NULL
    CHECK (data_quality IN ('MEASURED','ESTIMATED','UNAVAILABLE')),
  definition_version INTEGER NOT NULL DEFAULT 1,
  source_provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(32) NOT NULL DEFAULT 'CALCULATED'
    CHECK (status IN ('CALCULATED','PENDING_APPROVAL','APPROVED','REJECTED','SUPERSEDED')),
  immutable BOOLEAN NOT NULL DEFAULT TRUE,
  calculated_by VARCHAR(255) NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  CONSTRAINT uq_edge_p11_commission_calc_key UNIQUE (calculation_key)
);

CREATE TABLE IF NOT EXISTS edge_p11_commission_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calculation_id UUID NOT NULL REFERENCES edge_p11_commission_calculations(id) ON DELETE RESTRICT,
  decision VARCHAR(32) NOT NULL
    CHECK (decision IN ('APPROVED','REJECTED')),
  decided_by VARCHAR(255) NOT NULL,
  decided_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1)
);

-- ---------------------------------------------------------------------------
-- Partners, cohorts, retention
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_p11_partner_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  partner_type VARCHAR(64) NOT NULL DEFAULT 'RESELLER'
    CHECK (partner_type IN ('RESELLER','REFERRAL','AFFILIATE','MSP','OTHER')),
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE','INACTIVE','ARCHIVED')),
  -- Soft commercial account ref
  commercial_account_ref_id UUID,
  commission_plan_id UUID REFERENCES edge_p11_commission_plans(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by VARCHAR(255) NOT NULL,
  updated_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  CONSTRAINT uq_edge_p11_partner_accounts_code UNIQUE (code)
);

CREATE TABLE IF NOT EXISTS edge_p11_partner_performance_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_account_id UUID NOT NULL REFERENCES edge_p11_partner_accounts(id) ON DELETE RESTRICT,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  as_of TIMESTAMPTZ NOT NULL,
  metric_code VARCHAR(64) NOT NULL,
  value NUMERIC(24, 8),
  currency VARCHAR(3) NOT NULL,
  data_quality VARCHAR(32) NOT NULL
    CHECK (data_quality IN ('MEASURED','ESTIMATED','UNAVAILABLE')),
  definition_version INTEGER NOT NULL DEFAULT 1,
  source_provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1)
);

CREATE TABLE IF NOT EXISTS edge_p11_revenue_cohorts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  cohort_month DATE NOT NULL,
  business_unit_id UUID REFERENCES edge_p11_business_units(id) ON DELETE SET NULL,
  definition JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE','ARCHIVED')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  CONSTRAINT uq_edge_p11_revenue_cohorts_code UNIQUE (code)
);

CREATE TABLE IF NOT EXISTS edge_p11_retention_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id UUID NOT NULL REFERENCES edge_p11_revenue_cohorts(id) ON DELETE RESTRICT,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  as_of TIMESTAMPTZ NOT NULL,
  metric_code VARCHAR(64) NOT NULL,
  value NUMERIC(24, 8),
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  data_quality VARCHAR(32) NOT NULL
    CHECK (data_quality IN ('MEASURED','ESTIMATED','UNAVAILABLE')),
  definition_version INTEGER NOT NULL DEFAULT 1,
  source_provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1)
);

-- ---------------------------------------------------------------------------
-- Business periods, reports, decisions, actions, alerts, audit, idempotency
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_p11_business_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  period_type VARCHAR(32) NOT NULL DEFAULT 'MONTH'
    CHECK (period_type IN ('DAY','WEEK','MONTH','QUARTER','YEAR','CUSTOM')),
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN','CLOSED','LOCKED')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by VARCHAR(255) NOT NULL,
  updated_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  CONSTRAINT uq_edge_p11_business_periods_code UNIQUE (code),
  CONSTRAINT chk_edge_p11_business_periods_range CHECK (period_end >= period_start)
);

CREATE TABLE IF NOT EXISTS edge_p11_business_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(64) NOT NULL,
  title VARCHAR(255) NOT NULL,
  report_type VARCHAR(64) NOT NULL DEFAULT 'REVENUE_OVERVIEW',
  business_unit_id UUID REFERENCES edge_p11_business_units(id) ON DELETE SET NULL,
  period_id UUID REFERENCES edge_p11_business_periods(id) ON DELETE SET NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT','GENERATED','PUBLISHED','ARCHIVED')),
  as_of TIMESTAMPTZ NOT NULL,
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  data_quality VARCHAR(32) NOT NULL DEFAULT 'ESTIMATED'
    CHECK (data_quality IN ('MEASURED','ESTIMATED','UNAVAILABLE')),
  definition_version INTEGER NOT NULL DEFAULT 1,
  source_provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by VARCHAR(255) NOT NULL,
  updated_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  CONSTRAINT uq_edge_p11_business_reports_code UNIQUE (code)
);

CREATE TABLE IF NOT EXISTS edge_p11_business_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(64) NOT NULL,
  title VARCHAR(255) NOT NULL,
  decision_type VARCHAR(64) NOT NULL DEFAULT 'OPERATIONAL',
  status VARCHAR(32) NOT NULL DEFAULT 'PROPOSED'
    CHECK (status IN ('PROPOSED','APPROVED','REJECTED','SUPERSEDED','ARCHIVED')),
  rationale TEXT,
  decided_by VARCHAR(255),
  decided_at TIMESTAMPTZ,
  related_report_id UUID REFERENCES edge_p11_business_reports(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by VARCHAR(255) NOT NULL,
  updated_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  CONSTRAINT uq_edge_p11_business_decisions_code UNIQUE (code)
);

CREATE TABLE IF NOT EXISTS edge_p11_business_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(64) NOT NULL,
  title VARCHAR(255) NOT NULL,
  action_type VARCHAR(64) NOT NULL DEFAULT 'FOLLOW_UP',
  status VARCHAR(32) NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN','IN_PROGRESS','BLOCKED','DONE','CANCELLED')),
  decision_id UUID REFERENCES edge_p11_business_decisions(id) ON DELETE SET NULL,
  leakage_case_id UUID REFERENCES edge_p11_revenue_leakage_cases(id) ON DELETE SET NULL,
  owner_ref VARCHAR(255),
  due_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by VARCHAR(255) NOT NULL,
  updated_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  CONSTRAINT uq_edge_p11_business_actions_code UNIQUE (code)
);

CREATE TABLE IF NOT EXISTS edge_p11_business_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(64) NOT NULL,
  title VARCHAR(255) NOT NULL,
  severity VARCHAR(16) NOT NULL DEFAULT 'MEDIUM'
    CHECK (severity IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  status VARCHAR(32) NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN','ACKNOWLEDGED','RESOLVED','DISMISSED')),
  metric_code VARCHAR(64),
  business_unit_id UUID REFERENCES edge_p11_business_units(id) ON DELETE SET NULL,
  anomaly_id UUID REFERENCES edge_p11_revenue_anomalies(id) ON DELETE SET NULL,
  as_of TIMESTAMPTZ NOT NULL,
  data_quality VARCHAR(32) NOT NULL DEFAULT 'ESTIMATED'
    CHECK (data_quality IN ('MEASURED','ESTIMATED','UNAVAILABLE')),
  source_provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by VARCHAR(255) NOT NULL,
  updated_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  CONSTRAINT uq_edge_p11_business_alerts_code UNIQUE (code)
);

CREATE TABLE IF NOT EXISTS edge_p11_business_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(128) NOT NULL,
  aggregate_type VARCHAR(64) NOT NULL,
  aggregate_id UUID NOT NULL,
  actor_id VARCHAR(255),
  correlation_id UUID,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1)
);
CREATE INDEX IF NOT EXISTS idx_edge_p11_business_audit_aggregate
  ON edge_p11_business_audit_events (aggregate_type, aggregate_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_edge_p11_business_audit_type
  ON edge_p11_business_audit_events (event_type, created_at DESC);

CREATE TABLE IF NOT EXISTS edge_p11_idempotency_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope VARCHAR(128) NOT NULL,
  idempotency_key VARCHAR(255) NOT NULL,
  request_hash VARCHAR(128),
  response_ref UUID,
  status VARCHAR(32) NOT NULL DEFAULT 'COMPLETED'
    CHECK (status IN ('IN_PROGRESS','COMPLETED','FAILED')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  CONSTRAINT uq_edge_p11_idempotency_scope_key UNIQUE (scope, idempotency_key)
);

INSERT INTO schema_migrations (version)
VALUES ('122_edge_p11_revenue_operations_foundation')
ON CONFLICT DO NOTHING;
