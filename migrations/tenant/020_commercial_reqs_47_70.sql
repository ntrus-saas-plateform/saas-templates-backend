-- Migration 020: Commercial requirements 47-70
-- Commissions, contracts, loyalty, vouchers, workflow/approval, policies,
-- search helpers, bulk/import jobs, reporting projections, inventory ops.

-- ========== 47 COMMISSIONS ==========
CREATE TABLE IF NOT EXISTS sales_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(200) NOT NULL,
  user_id VARCHAR(100),
  status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'INACTIVE')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, code)
);

CREATE TABLE IF NOT EXISTS commission_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(200) NOT NULL,
  commission_base VARCHAR(40) NOT NULL
    CHECK (commission_base IN ('NET_SALES', 'COLLECTED_REVENUE', 'GROSS_SALES', 'MARGIN')),
  rate NUMERIC(9, 6) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'INACTIVE')),
  effective_from DATE,
  effective_to DATE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, code)
);

CREATE TABLE IF NOT EXISTS commission_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  code VARCHAR(50) NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN', 'CALCULATING', 'CALCULATED', 'APPROVED', 'PAID', 'CANCELLED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, code)
);

CREATE TABLE IF NOT EXISTS commission_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  period_id UUID NOT NULL REFERENCES commission_periods(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES sales_agents(id),
  rule_id UUID NOT NULL REFERENCES commission_rules(id),
  source_type VARCHAR(40) NOT NULL,
  source_id UUID,
  base_amount NUMERIC(18, 4) NOT NULL,
  rate NUMERIC(9, 6) NOT NULL,
  commission_amount NUMERIC(18, 4) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'ACCRUED'
    CHECK (status IN ('ACCRUED', 'APPROVED', 'PAID', 'REVERSED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_commission_entries_period
  ON commission_entries (organization_id, period_id, agent_id);

-- ========== 48 CONTRACTS ==========
CREATE TABLE IF NOT EXISTS commercial_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  contract_number VARCHAR(50) NOT NULL,
  contract_type VARCHAR(40) NOT NULL
    CHECK (contract_type IN (
      'CUSTOMER', 'SUPPLIER', 'PRICE_AGREEMENT', 'VOLUME_AGREEMENT',
      'SERVICE_AGREEMENT', 'DISTRIBUTION_AGREEMENT'
    )),
  status VARCHAR(30) NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'ACTIVE', 'EXPIRED', 'CANCELLED', 'REJECTED')),
  party_type VARCHAR(30) NOT NULL CHECK (party_type IN ('CUSTOMER', 'SUPPLIER', 'PARTNER')),
  party_id UUID NOT NULL,
  title VARCHAR(300) NOT NULL,
  effective_from DATE,
  effective_to DATE,
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  pricing JSONB NOT NULL DEFAULT '{}'::jsonb,
  volume JSONB NOT NULL DEFAULT '{}'::jsonb,
  sla JSONB NOT NULL DEFAULT '{}'::jsonb,
  clauses JSONB NOT NULL DEFAULT '[]'::jsonb,
  conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
  approved_by VARCHAR(100),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, contract_number)
);

CREATE INDEX IF NOT EXISTS idx_commercial_contracts_party
  ON commercial_contracts (organization_id, party_type, party_id);

-- ========== 49 LOYALTY (decoupled from Sales) ==========
CREATE TABLE IF NOT EXISTS loyalty_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(200) NOT NULL,
  min_points INT NOT NULL DEFAULT 0,
  multiplier NUMERIC(9, 4) NOT NULL DEFAULT 1,
  benefits JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (organization_id, code)
);

CREATE TABLE IF NOT EXISTS loyalty_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  customer_id UUID NOT NULL,
  tier_id UUID REFERENCES loyalty_tiers(id) ON DELETE SET NULL,
  points_balance INT NOT NULL DEFAULT 0,
  points_lifetime INT NOT NULL DEFAULT 0,
  status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'SUSPENDED', 'CLOSED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, customer_id)
);

CREATE TABLE IF NOT EXISTS loyalty_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(200) NOT NULL,
  points_cost INT NOT NULL,
  reward_type VARCHAR(40) NOT NULL DEFAULT 'DISCOUNT'
    CHECK (reward_type IN ('DISCOUNT', 'PRODUCT', 'VOUCHER', 'CUSTOM')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'INACTIVE')),
  UNIQUE (organization_id, code)
);

CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  account_id UUID NOT NULL REFERENCES loyalty_accounts(id) ON DELETE CASCADE,
  entry_type VARCHAR(30) NOT NULL
    CHECK (entry_type IN ('EARN', 'REDEEM', 'EXPIRE', 'ADJUST', 'REVERSE')),
  points INT NOT NULL,
  balance_after INT NOT NULL,
  reference_type VARCHAR(50),
  reference_id UUID,
  expires_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_tx_account
  ON loyalty_transactions (account_id, created_at DESC);

-- ========== 50 GIFT VOUCHERS ==========
CREATE TABLE IF NOT EXISTS gift_vouchers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  voucher_number VARCHAR(50) NOT NULL,
  code_hash VARCHAR(128) NOT NULL,
  code_hint VARCHAR(12) NOT NULL,
  initial_balance NUMERIC(18, 4) NOT NULL,
  balance NUMERIC(18, 4) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  status VARCHAR(30) NOT NULL DEFAULT 'ISSUED'
    CHECK (status IN ('ISSUED', 'ACTIVE', 'PARTIALLY_USED', 'USED', 'EXPIRED', 'CANCELLED')),
  issued_to_customer_id UUID,
  expires_at TIMESTAMPTZ,
  activated_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancel_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, voucher_number),
  UNIQUE (organization_id, code_hash)
);

CREATE TABLE IF NOT EXISTS gift_voucher_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_id UUID NOT NULL REFERENCES gift_vouchers(id) ON DELETE CASCADE,
  entry_type VARCHAR(30) NOT NULL
    CHECK (entry_type IN ('ISSUE', 'ACTIVATE', 'REDEEM', 'EXPIRE', 'CANCEL', 'ADJUST')),
  amount NUMERIC(18, 4) NOT NULL DEFAULT 0,
  balance_after NUMERIC(18, 4) NOT NULL,
  reference_type VARCHAR(50),
  reference_id UUID,
  actor_id VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ========== 51-52 WORKFLOW + APPROVAL ==========
CREATE TABLE IF NOT EXISTS commercial_workflow_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(200) NOT NULL,
  document_type VARCHAR(50) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'INACTIVE')),
  definition JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, code)
);

CREATE TABLE IF NOT EXISTS commercial_workflow_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  definition_id UUID NOT NULL REFERENCES commercial_workflow_definitions(id),
  document_type VARCHAR(50) NOT NULL,
  document_id UUID NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'IN_PROGRESS', 'APPROVED', 'REJECTED', 'CANCELLED')),
  current_step INT NOT NULL DEFAULT 0,
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS commercial_approval_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  instance_id UUID NOT NULL REFERENCES commercial_workflow_instances(id) ON DELETE CASCADE,
  step_index INT NOT NULL,
  approval_mode VARCHAR(30) NOT NULL
    CHECK (approval_mode IN ('SEQUENTIAL', 'PARALLEL', 'THRESHOLD', 'ROLE', 'AMOUNT', 'CUSTOMER', 'PRODUCT')),
  required_role VARCHAR(100),
  threshold_amount NUMERIC(18, 4),
  status VARCHAR(30) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'SKIPPED')),
  decided_by VARCHAR(100),
  decided_at TIMESTAMPTZ,
  decision_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_approval_tasks_instance
  ON commercial_approval_tasks (instance_id, step_index);

-- ========== 53 BUSINESS RULE / POLICIES ==========
CREATE TABLE IF NOT EXISTS commercial_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  policy_type VARCHAR(40) NOT NULL
    CHECK (policy_type IN (
      'PRICING', 'ALLOCATION', 'CREDIT', 'DISCOUNT', 'FULFILLMENT',
      'RETURN', 'TAX', 'APPROVAL', 'BACKORDER'
    )),
  code VARCHAR(50) NOT NULL,
  name VARCHAR(200) NOT NULL,
  version INT NOT NULL DEFAULT 1,
  status VARCHAR(30) NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'PUBLISHED', 'RETIRED')),
  rules JSONB NOT NULL DEFAULT '[]'::jsonb,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, policy_type, code, version)
);

-- ========== 55 INVENTORY TRANSFERS / ADJUSTMENTS ==========
CREATE TABLE IF NOT EXISTS inventory_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  transfer_number VARCHAR(50) NOT NULL,
  from_warehouse_id UUID NOT NULL,
  to_warehouse_id UUID NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'IN_TRANSIT', 'COMPLETED', 'CANCELLED')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  UNIQUE (organization_id, transfer_number)
);

CREATE TABLE IF NOT EXISTS inventory_transfer_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id UUID NOT NULL REFERENCES inventory_transfers(id) ON DELETE CASCADE,
  sku_id UUID NOT NULL,
  lot_id UUID,
  quantity NUMERIC(18, 4) NOT NULL
);

CREATE TABLE IF NOT EXISTS inventory_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  warehouse_id UUID NOT NULL,
  sku_id UUID NOT NULL,
  lot_id UUID,
  quantity_delta NUMERIC(18, 4) NOT NULL,
  reason TEXT NOT NULL,
  actor_id VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ========== 66-67 BULK / IMPORT ==========
CREATE TABLE IF NOT EXISTS commercial_bulk_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  job_type VARCHAR(50) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'VALIDATING', 'RUNNING', 'COMPLETED', 'FAILED', 'PARTIAL')),
  dry_run BOOLEAN NOT NULL DEFAULT false,
  total_count INT NOT NULL DEFAULT 0,
  success_count INT NOT NULL DEFAULT 0,
  failure_count INT NOT NULL DEFAULT 0,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  result JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS commercial_import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'UPLOADED'
    CHECK (status IN (
      'UPLOADED', 'VALIDATING', 'PREVIEW', 'TRANSFORMED',
      'PENDING_APPROVAL', 'IMPORTING', 'IMPORTED', 'FAILED', 'CANCELLED'
    )),
  file_name VARCHAR(300),
  staging JSONB NOT NULL DEFAULT '[]'::jsonb,
  validation_report JSONB NOT NULL DEFAULT '{}'::jsonb,
  import_report JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by VARCHAR(100),
  approved_by VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ========== 68-70 REPORTING / DASHBOARDS / ANALYTICS ==========
CREATE TABLE IF NOT EXISTS commercial_dashboard_projections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  dashboard_key VARCHAR(50) NOT NULL
    CHECK (dashboard_key IN (
      'SALES', 'INVENTORY', 'PURCHASING', 'CUSTOMER', 'PROFITABILITY'
    )),
  as_of TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (organization_id, dashboard_key)
);

CREATE TABLE IF NOT EXISTS commercial_kpi_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  kpi_key VARCHAR(80) NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  value NUMERIC(18, 6) NOT NULL,
  dimensions JSONB NOT NULL DEFAULT '{}'::jsonb,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kpi_snapshots_org
  ON commercial_kpi_snapshots (organization_id, kpi_key, period_end DESC);

-- Search helper view (read-only convenience; app still scopes by org)
CREATE OR REPLACE VIEW v_commercial_search_documents AS
SELECT
  'ORDER'::text AS entity_type,
  so.id,
  so.organization_id,
  so.order_number AS document_number,
  so.status,
  so.customer_id,
  so.created_at
FROM sales_orders so
UNION ALL
SELECT 'INVOICE', ci.id, ci.organization_id, ci.invoice_number, ci.status, ci.customer_id, ci.created_at
FROM commercial_invoices ci
UNION ALL
SELECT 'QUOTATION', q.id, q.organization_id, q.quotation_number, q.status, q.customer_id, q.created_at
FROM sales_quotations q
UNION ALL
SELECT 'RETURN', r.id, r.organization_id, r.return_number, r.status, r.customer_id, r.created_at
FROM commercial_returns r
UNION ALL
SELECT 'PO', po.id, po.organization_id, po.po_number, po.status, NULL, po.created_at
FROM purchase_orders po
UNION ALL
SELECT 'SHIPMENT', s.id, s.organization_id, s.shipment_number, s.status, NULL, s.created_at
FROM shipments s
UNION ALL
SELECT 'PAYMENT', p.id, p.organization_id, p.payment_number, p.status, p.customer_id, p.created_at
FROM commercial_payments p
UNION ALL
SELECT 'CONTRACT', c.id, c.organization_id, c.contract_number, c.status,
  CASE WHEN c.party_type = 'CUSTOMER' THEN c.party_id ELSE NULL END,
  c.created_at
FROM commercial_contracts c;

INSERT INTO tenant_number_sequences (document_type, prefix, pad_length, reset_policy)
VALUES
  ('COM', 'COM-', 6, 'YEAR'),
  ('CTR', 'CTR-', 6, 'YEAR'),
  ('GV', 'GV-', 6, 'YEAR'),
  ('TRF', 'TRF-', 6, 'YEAR'),
  ('WF', 'WF-', 6, 'YEAR')
ON CONFLICT DO NOTHING;

INSERT INTO schema_migrations (version) VALUES ('020_commercial_reqs_47_70') ON CONFLICT DO NOTHING;
