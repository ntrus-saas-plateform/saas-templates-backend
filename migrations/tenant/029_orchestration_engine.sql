-- Migration 029: ERP Orchestration — sagas, process monitor, three-way match, POS shift close

CREATE TABLE IF NOT EXISTS orchestration_sagas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID, -- informational; DB is already tenant-scoped
  organization_id UUID NOT NULL,
  saga_type VARCHAR(60) NOT NULL
    CHECK (saga_type IN (
      'SALES_ORDER', 'PURCHASE_ORDER', 'FULFILLMENT', 'RETURN',
      'PAYMENT', 'REPLENISHMENT', 'POS_SHIFT_CLOSE', 'END_OF_DAY'
    )),
  correlation_id VARCHAR(64) NOT NULL,
  aggregate_type VARCHAR(40),
  aggregate_id UUID,
  status VARCHAR(30) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN (
      'PENDING', 'RUNNING', 'WAITING', 'COMPENSATING', 'COMPLETED',
      'FAILED', 'CANCELLED', 'MANUAL_REVIEW'
    )),
  current_step VARCHAR(80),
  completed_steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  failed_step VARCHAR(80),
  retry_count INT NOT NULL DEFAULT 0,
  max_retries INT NOT NULL DEFAULT 5,
  compensation_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  timeout_at TIMESTAMPTZ,
  last_error TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orch_sagas_corr ON orchestration_sagas (correlation_id);
CREATE INDEX IF NOT EXISTS idx_orch_sagas_status ON orchestration_sagas (organization_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_orch_sagas_agg ON orchestration_sagas (aggregate_type, aggregate_id);

CREATE TABLE IF NOT EXISTS orchestration_saga_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  saga_id UUID NOT NULL REFERENCES orchestration_sagas(id) ON DELETE CASCADE,
  step_name VARCHAR(80) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'SKIPPED', 'COMPENSATED')),
  attempt INT NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error TEXT,
  input JSONB NOT NULL DEFAULT '{}'::jsonb,
  output JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (saga_id, step_name)
);

CREATE TABLE IF NOT EXISTS business_processes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  process_type VARCHAR(60) NOT NULL,
  aggregate_id UUID,
  correlation_id VARCHAR(64) NOT NULL,
  current_state VARCHAR(80) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'RUNNING'
    CHECK (status IN ('RUNNING', 'COMPLETED', 'FAILED', 'STUCK', 'CANCELLED')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  timeout_at TIMESTAMPTZ,
  failure TEXT,
  timeline JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_biz_proc_corr ON business_processes (correlation_id);
CREATE INDEX IF NOT EXISTS idx_biz_proc_stuck ON business_processes (status, last_activity_at)
  WHERE status IN ('RUNNING', 'STUCK');

-- Three-way matching (PO + GR + Supplier Invoice)
CREATE TABLE IF NOT EXISTS purchasing_three_way_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  purchase_order_id UUID NOT NULL,
  goods_receipt_id UUID,
  supplier_invoice_id UUID,
  status VARCHAR(30) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN (
      'PENDING', 'MATCHED', 'PARTIALLY_MATCHED', 'MISMATCH', 'ERROR', 'MANUAL_REVIEW', 'RESOLVED'
    )),
  variance_codes JSONB NOT NULL DEFAULT '[]'::jsonb,
  po_qty NUMERIC(18, 4),
  gr_qty NUMERIC(18, 4),
  invoice_qty NUMERIC(18, 4),
  po_amount NUMERIC(18, 4),
  gr_amount NUMERIC(18, 4),
  invoice_amount NUMERIC(18, 4),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by VARCHAR(100)
);

CREATE INDEX IF NOT EXISTS idx_three_way_po ON purchasing_three_way_matches (purchase_order_id);

-- POS shift close
CREATE TABLE IF NOT EXISTS pos_shift_closes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  warehouse_id UUID,
  pos_terminal_id UUID,
  cash_register_id UUID,
  status VARCHAR(30) NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN', 'CLOSING', 'CLOSED', 'VARIANCE_REVIEW')),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  opening_balance NUMERIC(18, 4) NOT NULL DEFAULT 0,
  cash_sales NUMERIC(18, 4) NOT NULL DEFAULT 0,
  card_sales NUMERIC(18, 4) NOT NULL DEFAULT 0,
  mobile_money_sales NUMERIC(18, 4) NOT NULL DEFAULT 0,
  refunds NUMERIC(18, 4) NOT NULL DEFAULT 0,
  expected_cash NUMERIC(18, 4) NOT NULL DEFAULT 0,
  actual_cash NUMERIC(18, 4),
  variance NUMERIC(18, 4),
  closing_balance NUMERIC(18, 4),
  closed_by VARCHAR(100),
  variance_reason TEXT,
  correlation_id VARCHAR(64),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Manual interventions (ops center)
CREATE TABLE IF NOT EXISTS orchestration_manual_interventions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  correlation_id VARCHAR(64),
  saga_id UUID,
  actor_id VARCHAR(100) NOT NULL,
  action VARCHAR(60) NOT NULL,
  justification TEXT NOT NULL,
  before_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  after_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  ticket_ref VARCHAR(120),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Shared idempotency for orchestration commands (optional complement to domain stores)
CREATE TABLE IF NOT EXISTS orchestration_idempotency_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  operation VARCHAR(80) NOT NULL,
  idempotency_key VARCHAR(128) NOT NULL,
  request_hash VARCHAR(64) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'COMPLETED',
  response_body JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  UNIQUE (organization_id, operation, idempotency_key)
);

INSERT INTO schema_migrations (version) VALUES ('029_orchestration_engine') ON CONFLICT DO NOTHING;
