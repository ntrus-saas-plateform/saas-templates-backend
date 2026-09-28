-- Migration 031: Orchestration reqs 40–79 — accounting pending, recon pairs, timeouts, ACL, timeline

CREATE TABLE IF NOT EXISTS accounting_posting_pending (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  reference_type VARCHAR(60) NOT NULL,
  reference_id UUID NOT NULL,
  journal_type VARCHAR(60),
  status VARCHAR(30) NOT NULL DEFAULT 'ACCOUNTING_PENDING'
    CHECK (status IN (
      'ACCOUNTING_PENDING', 'RETRYING', 'POSTED', 'FAILED', 'MANUAL_REVIEW', 'RESOLVED'
    )),
  retry_count INT NOT NULL DEFAULT 0,
  max_retries INT NOT NULL DEFAULT 10,
  last_error TEXT,
  correlation_id VARCHAR(64),
  causation_id VARCHAR(64),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_acct_posting_pending_status
  ON accounting_posting_pending (organization_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_acct_posting_pending_ref
  ON accounting_posting_pending (reference_type, reference_id);

-- Central ERP reconciliation results (req 41–42)
CREATE TABLE IF NOT EXISTS orchestration_reconciliation_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  run_id UUID,
  pair_type VARCHAR(60) NOT NULL,
  left_ref_type VARCHAR(60) NOT NULL,
  left_ref_id VARCHAR(80) NOT NULL,
  right_ref_type VARCHAR(60) NOT NULL,
  right_ref_id VARCHAR(80),
  status VARCHAR(30) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN (
      'MATCHED', 'PARTIALLY_MATCHED', 'MISMATCH', 'PENDING',
      'ERROR', 'MANUAL_REVIEW', 'RESOLVED'
    )),
  expected_value NUMERIC(18, 4),
  actual_value NUMERIC(18, 4),
  detail TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by VARCHAR(120)
);

CREATE INDEX IF NOT EXISTS idx_orch_recon_pair
  ON orchestration_reconciliation_results (organization_id, pair_type, status);
CREATE INDEX IF NOT EXISTS idx_orch_recon_run
  ON orchestration_reconciliation_results (run_id);

CREATE TABLE IF NOT EXISTS orchestration_reconciliation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'RUNNING',
  pair_counts JSONB NOT NULL DEFAULT '{}'::jsonb,
  mismatch_count INT NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Configurable process timeouts (minutes) — req 45
CREATE TABLE IF NOT EXISTS orchestration_timeout_config (
  organization_id UUID NOT NULL,
  timeout_key VARCHAR(80) NOT NULL,
  timeout_minutes INT NOT NULL CHECK (timeout_minutes > 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (organization_id, timeout_key)
);

-- Anti-corruption: Commercial Customer ↔ Accounting Customer Account (req 49)
CREATE TABLE IF NOT EXISTS commercial_customer_accounting_map (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  commercial_customer_id UUID NOT NULL,
  accounting_account_id VARCHAR(120) NOT NULL,
  accounting_system VARCHAR(40) NOT NULL DEFAULT 'INTERNAL',
  external_ref VARCHAR(120),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, commercial_customer_id, accounting_system)
);

CREATE INDEX IF NOT EXISTS idx_cust_acct_map_cust
  ON commercial_customer_accounting_map (organization_id, commercial_customer_id);

-- Global ERP timeline projection (req 67) — append-only by correlation
CREATE TABLE IF NOT EXISTS erp_timeline_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  correlation_id VARCHAR(64) NOT NULL,
  causation_id VARCHAR(64),
  event_type VARCHAR(120) NOT NULL,
  aggregate_type VARCHAR(60),
  aggregate_id UUID,
  facility_id UUID,
  warehouse_id UUID,
  actor_id VARCHAR(120),
  device_id VARCHAR(120),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_erp_timeline_corr
  ON erp_timeline_events (organization_id, correlation_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_erp_timeline_agg
  ON erp_timeline_events (aggregate_type, aggregate_id, occurred_at);
