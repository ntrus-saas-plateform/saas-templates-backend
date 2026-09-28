-- Migration 061: Cash & Sales Session Engine (enterprise POS register session)
-- Sales orchestrates; cash ledger is SoT for drawer; Accounting receives close events.

-- ========== OPERATOR ASSIGNMENT ==========
CREATE TABLE IF NOT EXISTS pos_operator_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  cash_register_id UUID NOT NULL REFERENCES org_cash_registers(id),
  pos_terminal_id UUID NOT NULL REFERENCES org_pos_terminals(id),
  operator_subject_id VARCHAR(120) NOT NULL,
  role_code VARCHAR(60) NOT NULL DEFAULT 'CASHIER',
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'INACTIVE', 'REVOKED')),
  valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_to TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pos_op_assign_org_op
  ON pos_operator_assignments (organization_id, operator_subject_id, status);
CREATE INDEX IF NOT EXISTS idx_pos_op_assign_register
  ON pos_operator_assignments (organization_id, cash_register_id, status);

-- ========== CASH DRAWER ==========
CREATE TABLE IF NOT EXISTS pos_cash_drawers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  cash_register_id UUID NOT NULL REFERENCES org_cash_registers(id),
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'INACTIVE', 'ARCHIVED')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, cash_register_id, code)
);

-- ========== SALES SESSION ==========
CREATE TABLE IF NOT EXISTS pos_sales_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  cash_register_id UUID NOT NULL REFERENCES org_cash_registers(id),
  pos_terminal_id UUID NOT NULL REFERENCES org_pos_terminals(id),
  cash_drawer_id UUID REFERENCES pos_cash_drawers(id),
  warehouse_id UUID REFERENCES org_warehouses(id),
  operator_subject_id VARCHAR(120) NOT NULL,
  opened_by_subject_id VARCHAR(120) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'XOF',
  status VARCHAR(40) NOT NULL DEFAULT 'OPENING'
    CHECK (status IN (
      'OPENING',
      'OPEN',
      'SUSPENDED',
      'CLOSING',
      'PENDING_RECONCILIATION',
      'RECONCILED',
      'CLOSED',
      'CLOSED_WITH_VARIANCE',
      'LOCKED',
      'CANCELLED'
    )),
  opening_float NUMERIC(18, 4) NOT NULL DEFAULT 0,
  opening_denominations JSONB NOT NULL DEFAULT '[]'::jsonb,
  opening_validated_at TIMESTAMPTZ,
  opening_authorized_by VARCHAR(120),
  declared_cash NUMERIC(18, 4),
  expected_cash NUMERIC(18, 4),
  cash_variance NUMERIC(18, 4),
  variance_reason TEXT,
  closing_notes TEXT,
  closed_by_subject_id VARCHAR(120),
  closed_at TIMESTAMPTZ,
  locked_at TIMESTAMPTZ,
  locked_by_subject_id VARCHAR(120),
  accounting_event_id UUID,
  shift_label VARCHAR(120),
  offline_device_bound BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pos_sales_sessions_org_status
  ON pos_sales_sessions (organization_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pos_sales_sessions_register
  ON pos_sales_sessions (organization_id, cash_register_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pos_sales_sessions_operator
  ON pos_sales_sessions (organization_id, operator_subject_id, created_at DESC);

-- One active session per register (opening through pending recon)
CREATE UNIQUE INDEX IF NOT EXISTS uq_pos_sales_sessions_one_active_register
  ON pos_sales_sessions (organization_id, cash_register_id)
  WHERE status IN (
    'OPENING', 'OPEN', 'SUSPENDED', 'CLOSING', 'PENDING_RECONCILIATION', 'RECONCILED'
  );

-- One active session per terminal
CREATE UNIQUE INDEX IF NOT EXISTS uq_pos_sales_sessions_one_active_terminal
  ON pos_sales_sessions (organization_id, pos_terminal_id)
  WHERE status IN (
    'OPENING', 'OPEN', 'SUSPENDED', 'CLOSING', 'PENDING_RECONCILIATION', 'RECONCILED'
  );

-- ========== APPEND-ONLY CASH MOVEMENT LEDGER ==========
CREATE TABLE IF NOT EXISTS pos_cash_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  session_id UUID NOT NULL REFERENCES pos_sales_sessions(id),
  movement_type VARCHAR(40) NOT NULL
    CHECK (movement_type IN (
      'OPENING_FLOAT',
      'SALE_CASH',
      'REFUND_CASH',
      'CASH_IN',
      'CASH_OUT',
      'SAFE_DROP',
      'CASH_PICKUP',
      'TRANSFER_IN',
      'TRANSFER_OUT',
      'CORRECTION'
    )),
  -- signed amount: + into drawer, - out of drawer
  amount_signed NUMERIC(18, 4) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'XOF',
  reference_type VARCHAR(50),
  reference_id UUID,
  reason TEXT,
  requires_approval BOOLEAN NOT NULL DEFAULT false,
  approved_by_subject_id VARCHAR(120),
  actor_subject_id VARCHAR(120) NOT NULL,
  idempotency_key VARCHAR(200),
  balance_after NUMERIC(18, 4),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pos_cash_movements_session
  ON pos_cash_movements (organization_id, session_id, created_at ASC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_pos_cash_movements_idem
  ON pos_cash_movements (organization_id, session_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- No UPDATE/DELETE via trigger guard (application also rejects)
CREATE OR REPLACE FUNCTION pos_cash_movements_immutable()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'pos_cash_movements is append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_pos_cash_movements_no_update ON pos_cash_movements;
CREATE TRIGGER trg_pos_cash_movements_no_update
  BEFORE UPDATE OR DELETE ON pos_cash_movements
  FOR EACH ROW EXECUTE FUNCTION pos_cash_movements_immutable();

-- ========== SESSION SALE / PAYMENT LINKS ==========
CREATE TABLE IF NOT EXISTS pos_session_sale_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  session_id UUID NOT NULL REFERENCES pos_sales_sessions(id),
  sales_order_id UUID NOT NULL,
  invoice_id UUID,
  gross_amount NUMERIC(18, 4) NOT NULL DEFAULT 0,
  currency CHAR(3) NOT NULL DEFAULT 'XOF',
  channel VARCHAR(40) NOT NULL DEFAULT 'POS',
  offline_operation_id UUID,
  actor_subject_id VARCHAR(120) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, session_id, sales_order_id)
);
CREATE INDEX IF NOT EXISTS idx_pos_session_sales_session
  ON pos_session_sale_links (organization_id, session_id);

CREATE TABLE IF NOT EXISTS pos_session_payment_tx (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  session_id UUID NOT NULL REFERENCES pos_sales_sessions(id),
  payment_id UUID,
  sales_order_id UUID,
  invoice_id UUID,
  tender_method VARCHAR(40) NOT NULL
    CHECK (tender_method IN (
      'CASH', 'CARD', 'MOBILE_MONEY', 'WALLET', 'BANK_TRANSFER',
      'CUSTOMER_CREDIT', 'MIXED', 'OTHER', 'REFUND_CASH', 'REFUND_CARD',
      'REFUND_MOBILE_MONEY', 'REFUND_WALLET', 'REFUND_OTHER'
    )),
  amount NUMERIC(18, 4) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'XOF',
  direction VARCHAR(10) NOT NULL DEFAULT 'IN'
    CHECK (direction IN ('IN', 'OUT')),
  cash_movement_id UUID REFERENCES pos_cash_movements(id),
  idempotency_key VARCHAR(200),
  actor_subject_id VARCHAR(120) NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pos_session_pay_session
  ON pos_session_payment_tx (organization_id, session_id, created_at ASC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_pos_session_pay_idem
  ON pos_session_payment_tx (organization_id, session_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- ========== IMMUTABLE OPERATION JOURNAL ==========
CREATE TABLE IF NOT EXISTS pos_session_journal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  session_id UUID NOT NULL REFERENCES pos_sales_sessions(id),
  op_type VARCHAR(60) NOT NULL,
  op_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  actor_subject_id VARCHAR(120) NOT NULL,
  correlation_id VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pos_session_journal_session
  ON pos_session_journal (organization_id, session_id, created_at ASC);

CREATE OR REPLACE FUNCTION pos_session_journal_immutable()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'pos_session_journal is append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_pos_session_journal_no_update ON pos_session_journal;
CREATE TRIGGER trg_pos_session_journal_no_update
  BEFORE UPDATE OR DELETE ON pos_session_journal
  FOR EACH ROW EXECUTE FUNCTION pos_session_journal_immutable();

-- ========== SUMMARY / RECON / VARIANCE / APPROVAL ==========
CREATE TABLE IF NOT EXISTS pos_session_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  session_id UUID NOT NULL REFERENCES pos_sales_sessions(id),
  sales_count INT NOT NULL DEFAULT 0,
  sales_gross NUMERIC(18, 4) NOT NULL DEFAULT 0,
  refunds_count INT NOT NULL DEFAULT 0,
  refunds_gross NUMERIC(18, 4) NOT NULL DEFAULT 0,
  tender_totals JSONB NOT NULL DEFAULT '{}'::jsonb,
  cash_movements_net NUMERIC(18, 4) NOT NULL DEFAULT 0,
  opening_float NUMERIC(18, 4) NOT NULL DEFAULT 0,
  expected_cash NUMERIC(18, 4) NOT NULL DEFAULT 0,
  declared_cash NUMERIC(18, 4),
  cash_variance NUMERIC(18, 4),
  offline_ops_count INT NOT NULL DEFAULT 0,
  anomalies JSONB NOT NULL DEFAULT '[]'::jsonb,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, session_id)
);

CREATE TABLE IF NOT EXISTS pos_session_reconciliations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  session_id UUID NOT NULL REFERENCES pos_sales_sessions(id),
  status VARCHAR(30) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'MATCHED', 'VARIANCE', 'APPROVED', 'REJECTED')),
  expected_by_tender JSONB NOT NULL DEFAULT '{}'::jsonb,
  declared_by_tender JSONB NOT NULL DEFAULT '{}'::jsonb,
  variance_by_tender JSONB NOT NULL DEFAULT '{}'::jsonb,
  expected_cash NUMERIC(18, 4) NOT NULL DEFAULT 0,
  declared_cash NUMERIC(18, 4) NOT NULL DEFAULT 0,
  cash_variance NUMERIC(18, 4) NOT NULL DEFAULT 0,
  notes TEXT,
  reconciled_by_subject_id VARCHAR(120),
  reconciled_at TIMESTAMPTZ,
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, session_id)
);

CREATE TABLE IF NOT EXISTS pos_session_variances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  session_id UUID NOT NULL REFERENCES pos_sales_sessions(id),
  reconciliation_id UUID REFERENCES pos_session_reconciliations(id),
  variance_type VARCHAR(40) NOT NULL DEFAULT 'CASH'
    CHECK (variance_type IN ('CASH', 'TENDER', 'SALES', 'OFFLINE', 'OTHER')),
  expected_amount NUMERIC(18, 4) NOT NULL,
  declared_amount NUMERIC(18, 4) NOT NULL,
  variance_amount NUMERIC(18, 4) NOT NULL,
  justification TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN', 'JUSTIFIED', 'APPROVED', 'REJECTED')),
  created_by_subject_id VARCHAR(120) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pos_session_variances_session
  ON pos_session_variances (organization_id, session_id, status);

CREATE TABLE IF NOT EXISTS pos_session_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  session_id UUID NOT NULL REFERENCES pos_sales_sessions(id),
  variance_id UUID REFERENCES pos_session_variances(id),
  approval_type VARCHAR(40) NOT NULL
    CHECK (approval_type IN (
      'OPENING', 'VARIANCE', 'CORRECTION', 'CLOSE', 'CANCEL', 'REFUND_AFTER_CLOSE'
    )),
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  requested_by_subject_id VARCHAR(120) NOT NULL,
  decided_by_subject_id VARCHAR(120),
  decision_notes TEXT,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pos_session_approvals_session
  ON pos_session_approvals (organization_id, session_id, status);

-- ========== CAPABILITIES ==========
INSERT INTO capability_definitions (code, name, description, category, status, required_modules, supported_verticals)
VALUES
  ('CASH_SESSION', 'Cash & sales session', 'Register session open/close lifecycle', 'COMMERCE', 'AVAILABLE', '["pos"]'::jsonb, '["PHARMACY","SUPERMARKET","RETAIL_STORE","BOUTIQUE","RESTAURANT","CAFE","CLINIC"]'::jsonb),
  ('CASH_MOVEMENT', 'Cash movements', 'Cash-in/out, safe drop, pickup, transfers', 'COMMERCE', 'AVAILABLE', '["pos"]'::jsonb, '["PHARMACY","SUPERMARKET","RETAIL_STORE","BOUTIQUE","RESTAURANT","CAFE","CLINIC"]'::jsonb),
  ('CASH_RECONCILIATION', 'Cash reconciliation', 'End-of-shift tender and cash reconciliation', 'COMMERCE', 'AVAILABLE', '["pos"]'::jsonb, '["PHARMACY","SUPERMARKET","RETAIL_STORE","BOUTIQUE","RESTAURANT","CAFE","CLINIC"]'::jsonb),
  ('CASH_VARIANCE_APPROVAL', 'Cash variance approval', 'Manager approval for session variances', 'COMMERCE', 'AVAILABLE', '["pos"]'::jsonb, '["PHARMACY","SUPERMARKET","RETAIL_STORE","BOUTIQUE","RESTAURANT","CAFE","CLINIC"]'::jsonb)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  required_modules = EXCLUDED.required_modules,
  supported_verticals = EXCLUDED.supported_verticals,
  status = EXCLUDED.status,
  updated_at = NOW();

INSERT INTO capability_dependencies (capability_code, depends_on_code) VALUES
  ('CASH_SESSION', 'POS'),
  ('CASH_MOVEMENT', 'CASH_SESSION'),
  ('CASH_RECONCILIATION', 'CASH_SESSION'),
  ('CASH_VARIANCE_APPROVAL', 'CASH_RECONCILIATION')
ON CONFLICT DO NOTHING;

UPDATE business_profiles
SET default_capabilities = (
  SELECT COALESCE(jsonb_agg(DISTINCT v), '[]'::jsonb)
  FROM (
    SELECT jsonb_array_elements_text(default_capabilities) AS v
    UNION ALL SELECT 'CASH_SESSION'
    UNION ALL SELECT 'CASH_MOVEMENT'
    UNION ALL SELECT 'CASH_RECONCILIATION'
    UNION ALL SELECT 'CASH_VARIANCE_APPROVAL'
  ) s
)
WHERE default_capabilities @> '["POS"]'::jsonb;

INSERT INTO schema_migrations (version) VALUES ('061_cash_session_engine_v1')
ON CONFLICT DO NOTHING;
