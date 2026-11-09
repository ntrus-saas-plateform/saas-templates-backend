-- Migration 084: P4.5–P4.7 — Offer snapshots, Quotes, Proposals, Deal Desk, Approvals
-- Prices/snapshots from P2 — never mutate P2 price books.
-- Issued quotes are immutable; edits create a new version.
-- Approvals cannot be bypassed via API (enforced in domain + UC).

-- ---------------------------------------------------------------------------
-- Opportunity offer configurations (P2 version snapshot)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_sales_offer_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES edge_sales_opportunities(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES edge_sales_commercial_accounts(id) ON DELETE RESTRICT,
  version INT NOT NULL DEFAULT 1,
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT','VALIDATED','SUPERSEDED','ARCHIVED')),
  product_id UUID NOT NULL REFERENCES edge_products(id) ON DELETE RESTRICT,
  vertical_id UUID REFERENCES edge_verticals(id) ON DELETE SET NULL,
  market_id UUID REFERENCES edge_commercial_markets(id) ON DELETE SET NULL,
  segment_id UUID,
  solution_package_id UUID,
  plan_id UUID,
  addon_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  pricing_model VARCHAR(64),
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  list_amount NUMERIC(19,4),
  net_amount NUMERIC(19,4),
  eligibility_decision VARCHAR(32),
  p2_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  configurator_result JSONB NOT NULL DEFAULT '{}'::jsonb,
  commercial_terms JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (opportunity_id, version)
);

CREATE INDEX IF NOT EXISTS idx_edge_sales_offer_cfg_opp
  ON edge_sales_offer_configurations (opportunity_id, status);

-- ---------------------------------------------------------------------------
-- Quotes (versioned)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_sales_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_number VARCHAR(32) NOT NULL,
  account_id UUID NOT NULL REFERENCES edge_sales_commercial_accounts(id) ON DELETE RESTRICT,
  opportunity_id UUID NOT NULL REFERENCES edge_sales_opportunities(id) ON DELETE RESTRICT,
  contact_id UUID REFERENCES edge_sales_contacts(id) ON DELETE SET NULL,
  offer_configuration_id UUID REFERENCES edge_sales_offer_configurations(id) ON DELETE SET NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN (
      'DRAFT','IN_REVIEW','APPROVED','ISSUED','VIEWED',
      'ACCEPTED','REJECTED','EXPIRED','WITHDRAWN'
    )),
  current_version INT NOT NULL DEFAULT 1,
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  subtotal_amount NUMERIC(19,4) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(19,4) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(19,4) NOT NULL DEFAULT 0,
  total_amount NUMERIC(19,4) NOT NULL DEFAULT 0,
  valid_until DATE,
  commercial_terms JSONB NOT NULL DEFAULT '{}'::jsonb,
  p2_price_book_version INT,
  owner_administrator_id UUID REFERENCES edge_administrators(id) ON DELETE SET NULL,
  issued_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_sales_quotes_number_key UNIQUE (quote_number)
);

CREATE SEQUENCE IF NOT EXISTS edge_sales_quote_number_seq START 1000;

CREATE INDEX IF NOT EXISTS idx_edge_sales_quotes_opp
  ON edge_sales_quotes (opportunity_id, status);

CREATE TABLE IF NOT EXISTS edge_sales_quote_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES edge_sales_quotes(id) ON DELETE CASCADE,
  version INT NOT NULL,
  status_snapshot VARCHAR(32) NOT NULL,
  currency CHAR(3) NOT NULL,
  subtotal_amount NUMERIC(19,4) NOT NULL,
  discount_amount NUMERIC(19,4) NOT NULL,
  tax_amount NUMERIC(19,4) NOT NULL,
  total_amount NUMERIC(19,4) NOT NULL,
  lines JSONB NOT NULL DEFAULT '[]'::jsonb,
  commercial_terms JSONB NOT NULL DEFAULT '{}'::jsonb,
  p2_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  change_reason TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (quote_id, version)
);

CREATE TABLE IF NOT EXISTS edge_sales_quote_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES edge_sales_quotes(id) ON DELETE CASCADE,
  version INT NOT NULL DEFAULT 1,
  line_number INT NOT NULL,
  line_type VARCHAR(32) NOT NULL DEFAULT 'PLAN'
    CHECK (line_type IN ('PLAN','PACKAGE','ADDON','SERVICE','ADJUSTMENT')),
  product_id UUID,
  plan_id UUID,
  package_id UUID,
  addon_id UUID,
  description VARCHAR(512) NOT NULL,
  quantity NUMERIC(19,4) NOT NULL DEFAULT 1,
  unit_price NUMERIC(19,4) NOT NULL DEFAULT 0,
  discount_percent NUMERIC(8,4) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(19,4) NOT NULL DEFAULT 0,
  line_total NUMERIC(19,4) NOT NULL DEFAULT 0,
  pricing_model VARCHAR(64),
  p2_refs JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (quote_id, version, line_number)
);

-- ---------------------------------------------------------------------------
-- Proposals
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_sales_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_number VARCHAR(32) NOT NULL,
  account_id UUID NOT NULL REFERENCES edge_sales_commercial_accounts(id) ON DELETE RESTRICT,
  opportunity_id UUID NOT NULL REFERENCES edge_sales_opportunities(id) ON DELETE RESTRICT,
  quote_id UUID REFERENCES edge_sales_quotes(id) ON DELETE SET NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN (
      'DRAFT','IN_REVIEW','APPROVED','ISSUED','VIEWED','WITHDRAWN','SUPERSEDED'
    )),
  current_version INT NOT NULL DEFAULT 1,
  language VARCHAR(16) NOT NULL DEFAULT 'fr',
  template_code VARCHAR(64),
  title VARCHAR(255) NOT NULL,
  sections JSONB NOT NULL DEFAULT '[]'::jsonb,
  pdf_document_ref VARCHAR(512),
  issued_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_sales_proposals_number_key UNIQUE (proposal_number)
);

CREATE SEQUENCE IF NOT EXISTS edge_sales_proposal_number_seq START 1000;

CREATE TABLE IF NOT EXISTS edge_sales_proposal_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES edge_sales_proposals(id) ON DELETE CASCADE,
  version INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  sections JSONB NOT NULL DEFAULT '[]'::jsonb,
  change_reason TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (proposal_id, version)
);

-- ---------------------------------------------------------------------------
-- Deal desk — discount requests + commercial approvals
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_sales_discount_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  product_id UUID REFERENCES edge_products(id) ON DELETE SET NULL,
  market_id UUID REFERENCES edge_commercial_markets(id) ON DELETE SET NULL,
  discount_type VARCHAR(32) NOT NULL
    CHECK (discount_type IN (
      'ONE_TIME','PERCENTAGE','FIXED','VOLUME','ANNUAL',
      'CONTRACTUAL','STRATEGIC','EXCEPTIONAL'
    )),
  max_percent_standard NUMERIC(8,4),
  max_percent_manager NUMERIC(8,4),
  max_percent_executive NUMERIC(8,4),
  max_amount_standard NUMERIC(19,4),
  approval_matrix JSONB NOT NULL DEFAULT '[]'::jsonb,
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('DRAFT','ACTIVE','DEPRECATED')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_sales_discount_policies_code_key UNIQUE (code)
);

CREATE TABLE IF NOT EXISTS edge_sales_discount_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES edge_sales_opportunities(id) ON DELETE CASCADE,
  quote_id UUID REFERENCES edge_sales_quotes(id) ON DELETE SET NULL,
  account_id UUID NOT NULL REFERENCES edge_sales_commercial_accounts(id) ON DELETE RESTRICT,
  policy_id UUID REFERENCES edge_sales_discount_policies(id) ON DELETE SET NULL,
  discount_type VARCHAR(32) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'REQUESTED'
    CHECK (status IN (
      'REQUESTED','PENDING_MANAGER','PENDING_EXECUTIVE','APPROVED','REJECTED','WITHDRAWN'
    )),
  list_amount NUMERIC(19,4) NOT NULL,
  requested_amount NUMERIC(19,4) NOT NULL,
  discount_percent NUMERIC(8,4),
  discount_amount NUMERIC(19,4),
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  justification TEXT NOT NULL,
  duration_notes TEXT,
  conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
  required_approval_level VARCHAR(32) NOT NULL DEFAULT 'STANDARD'
    CHECK (required_approval_level IN ('STANDARD','MANAGER','EXECUTIVE','STRATEGIC')),
  decided_by UUID,
  decided_at TIMESTAMPTZ,
  decision_notes TEXT,
  requested_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edge_sales_discount_req_status
  ON edge_sales_discount_requests (status, created_at DESC);

CREATE TABLE IF NOT EXISTS edge_sales_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_type VARCHAR(64) NOT NULL
    CHECK (subject_type IN (
      'OPPORTUNITY','OFFER_CONFIGURATION','DISCOUNT_REQUEST','QUOTE',
      'PROPOSAL','CONTRACT_TERMS','PAYMENT_TERMS','CONTRACT','SALES_ORDER','CLOSE'
    )),
  subject_id UUID NOT NULL,
  approval_type VARCHAR(64) NOT NULL DEFAULT 'COMMERCIAL',
  status VARCHAR(32) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING','APPROVED','REJECTED','CHANGES_REQUESTED','CANCELLED')),
  required_level VARCHAR(32) NOT NULL DEFAULT 'MANAGER',
  sequence_no INT NOT NULL DEFAULT 1,
  parallel_group INT,
  requester_id UUID NOT NULL,
  assignee_id UUID,
  decision_by UUID,
  decision_at TIMESTAMPTZ,
  decision_notes TEXT,
  cannot_self_approve BOOLEAN NOT NULL DEFAULT TRUE,
  correlation_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edge_sales_approvals_subject
  ON edge_sales_approvals (subject_type, subject_id, status);

CREATE INDEX IF NOT EXISTS idx_edge_sales_approvals_assignee
  ON edge_sales_approvals (assignee_id, status)
  WHERE status = 'PENDING';

-- Seed a default discount policy (thresholds configurable, not hardcoded in domain)
INSERT INTO edge_sales_discount_policies (
  code, name, discount_type,
  max_percent_standard, max_percent_manager, max_percent_executive,
  approval_matrix, status
) VALUES (
  'DEFAULT_PERCENT',
  'Default percentage discount policy',
  'PERCENTAGE',
  5.0000,
  15.0000,
  30.0000,
  '[
    {"maxPercent":5,"level":"STANDARD"},
    {"maxPercent":15,"level":"MANAGER"},
    {"maxPercent":30,"level":"EXECUTIVE"},
    {"maxPercent":100,"level":"STRATEGIC"}
  ]'::jsonb,
  'ACTIVE'
)
ON CONFLICT (code) DO NOTHING;

-- Operator quote/discount permissions
INSERT INTO edge_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM edge_roles r
INNER JOIN edge_permissions p ON p.code IN (
  'platform:sales:quotes:read',
  'platform:sales:quotes:create',
  'platform:sales:proposals:manage',
  'platform:sales:discounts:request'
)
WHERE r.code = 'EDGE_PLATFORM_OPERATOR'
ON CONFLICT DO NOTHING;
