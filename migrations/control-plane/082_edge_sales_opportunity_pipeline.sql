-- Migration 082: P4 Opportunity Management + configurable Pipeline
-- Closed Won requires explicit close gates (not arbitrary stage drag).

-- ---------------------------------------------------------------------------
-- Pipeline definitions & stages
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_sales_pipelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  scope_type VARCHAR(32) NOT NULL DEFAULT 'GLOBAL'
    CHECK (scope_type IN ('GLOBAL','PRODUCT','VERTICAL','TEAM','MARKET')),
  product_id UUID REFERENCES edge_products(id) ON DELETE SET NULL,
  vertical_id UUID REFERENCES edge_verticals(id) ON DELETE SET NULL,
  team_id UUID REFERENCES edge_sales_teams(id) ON DELETE SET NULL,
  market_id UUID REFERENCES edge_commercial_markets(id) ON DELETE SET NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('DRAFT','ACTIVE','DEPRECATED','ARCHIVED')),
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  version INT NOT NULL DEFAULT 1,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  CONSTRAINT edge_sales_pipelines_code_key UNIQUE (code)
);

CREATE TABLE IF NOT EXISTS edge_sales_pipeline_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id UUID NOT NULL REFERENCES edge_sales_pipelines(id) ON DELETE CASCADE,
  code VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  position INT NOT NULL,
  stage_kind VARCHAR(32) NOT NULL DEFAULT 'OPEN'
    CHECK (stage_kind IN ('OPEN','WON','LOST')),
  entry_conditions JSONB NOT NULL DEFAULT '[]'::jsonb,
  exit_conditions JSONB NOT NULL DEFAULT '[]'::jsonb,
  required_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  required_documents JSONB NOT NULL DEFAULT '[]'::jsonb,
  expected_activities JSONB NOT NULL DEFAULT '[]'::jsonb,
  target_duration_days INT,
  reference_probability NUMERIC(5,4) NOT NULL DEFAULT 0,
  permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
  auto_actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (pipeline_id, code),
  UNIQUE (pipeline_id, position)
);

CREATE TABLE IF NOT EXISTS edge_sales_pipeline_transitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id UUID NOT NULL REFERENCES edge_sales_pipelines(id) ON DELETE CASCADE,
  from_stage_id UUID NOT NULL REFERENCES edge_sales_pipeline_stages(id) ON DELETE CASCADE,
  to_stage_id UUID NOT NULL REFERENCES edge_sales_pipeline_stages(id) ON DELETE CASCADE,
  requires_reason BOOLEAN NOT NULL DEFAULT FALSE,
  requires_approval BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (pipeline_id, from_stage_id, to_stage_id),
  CHECK (from_stage_id <> to_stage_id)
);

-- ---------------------------------------------------------------------------
-- Opportunities
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_sales_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_number VARCHAR(32) NOT NULL,
  name VARCHAR(255) NOT NULL,
  account_id UUID NOT NULL REFERENCES edge_sales_commercial_accounts(id) ON DELETE RESTRICT,
  sales_lead_id UUID REFERENCES edge_sales_leads(id) ON DELETE SET NULL,
  pipeline_id UUID NOT NULL REFERENCES edge_sales_pipelines(id) ON DELETE RESTRICT,
  stage_id UUID NOT NULL REFERENCES edge_sales_pipeline_stages(id) ON DELETE RESTRICT,
  status VARCHAR(32) NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN','WON','LOST','ON_HOLD','REOPENED')),
  owner_administrator_id UUID REFERENCES edge_administrators(id) ON DELETE SET NULL,
  team_id UUID REFERENCES edge_sales_teams(id) ON DELETE SET NULL,
  product_id UUID REFERENCES edge_products(id) ON DELETE SET NULL,
  vertical_id UUID REFERENCES edge_verticals(id) ON DELETE SET NULL,
  market_id UUID REFERENCES edge_commercial_markets(id) ON DELETE SET NULL,
  segment_id UUID,
  solution_package_id UUID,
  plan_id UUID,
  need_summary TEXT,
  scope_summary TEXT,
  estimated_value NUMERIC(19,4),
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  probability NUMERIC(5,4),
  expected_close_date DATE,
  source VARCHAR(64),
  loss_reason_code VARCHAR(64),
  loss_reason_text TEXT,
  won_at TIMESTAMPTZ,
  lost_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  reopen_count INT NOT NULL DEFAULT 0,
  forecast_category VARCHAR(32) NOT NULL DEFAULT 'PIPELINE'
    CHECK (forecast_category IN ('PIPELINE','BEST_CASE','COMMIT','MOST_LIKELY','OMITTED')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  CONSTRAINT edge_sales_opportunities_number_key UNIQUE (opportunity_number)
);

CREATE INDEX IF NOT EXISTS idx_edge_sales_opps_account
  ON edge_sales_opportunities (account_id, status);

CREATE INDEX IF NOT EXISTS idx_edge_sales_opps_stage
  ON edge_sales_opportunities (pipeline_id, stage_id, status);

CREATE INDEX IF NOT EXISTS idx_edge_sales_opps_owner
  ON edge_sales_opportunities (owner_administrator_id, status);

CREATE SEQUENCE IF NOT EXISTS edge_sales_opportunity_number_seq START 1000;

CREATE TABLE IF NOT EXISTS edge_sales_opportunity_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES edge_sales_opportunities(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES edge_sales_contacts(id) ON DELETE CASCADE,
  role_on_opportunity VARCHAR(64) NOT NULL DEFAULT 'INFLUENCER',
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (opportunity_id, contact_id)
);

CREATE TABLE IF NOT EXISTS edge_sales_opportunity_stage_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES edge_sales_opportunities(id) ON DELETE CASCADE,
  from_stage_id UUID REFERENCES edge_sales_pipeline_stages(id) ON DELETE SET NULL,
  to_stage_id UUID NOT NULL REFERENCES edge_sales_pipeline_stages(id) ON DELETE RESTRICT,
  from_status VARCHAR(32),
  to_status VARCHAR(32),
  reason_code VARCHAR(64),
  reason_text TEXT,
  actor_id UUID,
  correlation_id UUID,
  dwell_hours NUMERIC(12,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edge_sales_opp_stage_hist
  ON edge_sales_opportunity_stage_history (opportunity_id, created_at DESC);

CREATE TABLE IF NOT EXISTS edge_sales_opportunity_risks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES edge_sales_opportunities(id) ON DELETE CASCADE,
  code VARCHAR(64) NOT NULL,
  title VARCHAR(255) NOT NULL,
  severity VARCHAR(16) NOT NULL DEFAULT 'MEDIUM'
    CHECK (severity IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  status VARCHAR(32) NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN','MITIGATING','RESOLVED','ACCEPTED')),
  description TEXT,
  mitigation TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS edge_sales_opportunity_competitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES edge_sales_opportunities(id) ON DELETE CASCADE,
  competitor_name VARCHAR(255) NOT NULL,
  strength TEXT,
  weakness TEXT,
  threat_level VARCHAR(16) NOT NULL DEFAULT 'MEDIUM'
    CHECK (threat_level IN ('LOW','MEDIUM','HIGH')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default global pipeline
INSERT INTO edge_sales_pipelines (id, code, name, scope_type, status, is_default, created_by)
VALUES (
  'a0000000-0000-4000-8000-000000000001',
  'DEFAULT_GLOBAL',
  'Default Global Sales Pipeline',
  'GLOBAL',
  'ACTIVE',
  TRUE,
  NULL
)
ON CONFLICT (code) DO NOTHING;

INSERT INTO edge_sales_pipeline_stages
  (id, pipeline_id, code, name, position, stage_kind, reference_probability, required_fields)
VALUES
  ('a0000000-0000-4000-8000-000000000101', 'a0000000-0000-4000-8000-000000000001', 'NEW_OPPORTUNITY', 'New Opportunity', 1, 'OPEN', 0.05, '["name","accountId"]'::jsonb),
  ('a0000000-0000-4000-8000-000000000102', 'a0000000-0000-4000-8000-000000000001', 'DISCOVERY', 'Discovery', 2, 'OPEN', 0.10, '["needSummary"]'::jsonb),
  ('a0000000-0000-4000-8000-000000000103', 'a0000000-0000-4000-8000-000000000001', 'NEEDS_ASSESSMENT', 'Needs Assessment', 3, 'OPEN', 0.20, '["needSummary","scopeSummary"]'::jsonb),
  ('a0000000-0000-4000-8000-000000000104', 'a0000000-0000-4000-8000-000000000001', 'SOLUTION_DESIGN', 'Solution Design', 4, 'OPEN', 0.35, '["productId"]'::jsonb),
  ('a0000000-0000-4000-8000-000000000105', 'a0000000-0000-4000-8000-000000000001', 'PROPOSAL_PREPARATION', 'Proposal Preparation', 5, 'OPEN', 0.45, '["estimatedValue"]'::jsonb),
  ('a0000000-0000-4000-8000-000000000106', 'a0000000-0000-4000-8000-000000000001', 'PROPOSAL_SENT', 'Proposal Sent', 6, 'OPEN', 0.55, '["estimatedValue"]'::jsonb),
  ('a0000000-0000-4000-8000-000000000107', 'a0000000-0000-4000-8000-000000000001', 'NEGOTIATION', 'Negotiation', 7, 'OPEN', 0.65, '["estimatedValue"]'::jsonb),
  ('a0000000-0000-4000-8000-000000000108', 'a0000000-0000-4000-8000-000000000001', 'VERBAL_AGREEMENT', 'Verbal Agreement', 8, 'OPEN', 0.80, '["estimatedValue","expectedCloseDate"]'::jsonb),
  ('a0000000-0000-4000-8000-000000000109', 'a0000000-0000-4000-8000-000000000001', 'CONTRACT_REVIEW', 'Contract Review', 9, 'OPEN', 0.90, '["estimatedValue","expectedCloseDate"]'::jsonb),
  ('a0000000-0000-4000-8000-000000000110', 'a0000000-0000-4000-8000-000000000001', 'CLOSED_WON', 'Closed Won', 10, 'WON', 1.00, '["estimatedValue"]'::jsonb),
  ('a0000000-0000-4000-8000-000000000111', 'a0000000-0000-4000-8000-000000000001', 'CLOSED_LOST', 'Closed Lost', 11, 'LOST', 0.00, '["lossReasonCode"]'::jsonb)
ON CONFLICT DO NOTHING;

-- Linear forward transitions + allow move to CLOSED_LOST from any open stage
INSERT INTO edge_sales_pipeline_transitions (pipeline_id, from_stage_id, to_stage_id, requires_reason)
SELECT
  'a0000000-0000-4000-8000-000000000001',
  s1.id,
  s2.id,
  FALSE
FROM edge_sales_pipeline_stages s1
JOIN edge_sales_pipeline_stages s2
  ON s2.pipeline_id = s1.pipeline_id
 AND s2.position = s1.position + 1
 AND s2.stage_kind = 'OPEN'
WHERE s1.pipeline_id = 'a0000000-0000-4000-8000-000000000001'
  AND s1.stage_kind = 'OPEN'
ON CONFLICT DO NOTHING;

INSERT INTO edge_sales_pipeline_transitions (pipeline_id, from_stage_id, to_stage_id, requires_reason)
SELECT
  'a0000000-0000-4000-8000-000000000001',
  s.id,
  'a0000000-0000-4000-8000-000000000110',
  FALSE
FROM edge_sales_pipeline_stages s
WHERE s.pipeline_id = 'a0000000-0000-4000-8000-000000000001'
  AND s.code = 'CONTRACT_REVIEW'
ON CONFLICT DO NOTHING;

INSERT INTO edge_sales_pipeline_transitions (pipeline_id, from_stage_id, to_stage_id, requires_reason)
SELECT
  'a0000000-0000-4000-8000-000000000001',
  s.id,
  'a0000000-0000-4000-8000-000000000111',
  TRUE
FROM edge_sales_pipeline_stages s
WHERE s.pipeline_id = 'a0000000-0000-4000-8000-000000000001'
  AND s.stage_kind = 'OPEN'
ON CONFLICT DO NOTHING;

-- Operator opportunity permissions (codes already seeded in 081)
INSERT INTO edge_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM edge_roles r
INNER JOIN edge_permissions p ON p.code IN (
  'platform:sales:opportunities:read',
  'platform:sales:opportunities:create',
  'platform:sales:opportunities:update',
  'platform:sales:opportunities:close',
  'platform:sales:pipeline:manage'
)
WHERE r.code = 'EDGE_PLATFORM_OPERATOR'
ON CONFLICT DO NOTHING;

INSERT INTO edge_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM edge_roles r
INNER JOIN edge_permissions p ON p.code IN (
  'platform:sales:opportunities:read'
)
WHERE r.code IN ('VERTICAL_OWNER', 'VERTICAL_ADMIN')
ON CONFLICT DO NOTHING;

INSERT INTO schema_migrations (version) VALUES ('082_edge_sales_opportunity_pipeline')
ON CONFLICT DO NOTHING;
