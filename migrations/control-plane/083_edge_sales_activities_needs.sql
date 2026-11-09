-- Migration 083: P4.4 — Sales Activities & Needs Assessment
-- Activities always tied to commercial context when present.
-- Needs assessment documents gaps vs P1/P2 capabilities; never invents product promises.

-- ---------------------------------------------------------------------------
-- Activities
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_sales_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_type VARCHAR(64) NOT NULL
    CHECK (activity_type IN (
      'CALL','EMAIL','MEETING','VIDEO_CONFERENCE','DEMO','VISIT','WORKSHOP',
      'PRESENTATION','FOLLOW_UP','NEGOTIATION','DOCUMENT_EXCHANGE',
      'TECHNICAL_EVALUATION','FINANCIAL_EVALUATION','DECISION_MEETING','OTHER'
    )),
  subject VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(32) NOT NULL DEFAULT 'PLANNED'
    CHECK (status IN ('PLANNED','IN_PROGRESS','COMPLETED','CANCELLED','NO_SHOW')),
  account_id UUID REFERENCES edge_sales_commercial_accounts(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES edge_sales_contacts(id) ON DELETE SET NULL,
  sales_lead_id UUID REFERENCES edge_sales_leads(id) ON DELETE SET NULL,
  opportunity_id UUID REFERENCES edge_sales_opportunities(id) ON DELETE SET NULL,
  owner_administrator_id UUID REFERENCES edge_administrators(id) ON DELETE SET NULL,
  scheduled_start_at TIMESTAMPTZ,
  scheduled_end_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  location VARCHAR(255),
  outcome_summary TEXT,
  participants JSONB NOT NULL DEFAULT '[]'::jsonb,
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    account_id IS NOT NULL
    OR contact_id IS NOT NULL
    OR sales_lead_id IS NOT NULL
    OR opportunity_id IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_edge_sales_activities_account
  ON edge_sales_activities (account_id, scheduled_start_at DESC)
  WHERE account_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_edge_sales_activities_opportunity
  ON edge_sales_activities (opportunity_id, scheduled_start_at DESC)
  WHERE opportunity_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_edge_sales_activities_owner_due
  ON edge_sales_activities (owner_administrator_id, status, scheduled_start_at);

-- Link tasks to opportunities (additive; keep existing nullable FKs)
ALTER TABLE edge_sales_tasks
  ADD COLUMN IF NOT EXISTS opportunity_id UUID REFERENCES edge_sales_opportunities(id) ON DELETE SET NULL;

ALTER TABLE edge_sales_notes
  ADD COLUMN IF NOT EXISTS opportunity_id UUID REFERENCES edge_sales_opportunities(id) ON DELETE SET NULL;

ALTER TABLE edge_sales_timeline_events
  ADD COLUMN IF NOT EXISTS opportunity_id UUID REFERENCES edge_sales_opportunities(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- Needs assessment & solution consulting
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_sales_needs_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES edge_sales_opportunities(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES edge_sales_commercial_accounts(id) ON DELETE RESTRICT,
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN (
      'DRAFT','IN_PROGRESS','COMPLETED','TECHNICALLY_VALIDATED','ARCHIVED'
    )),
  template_code VARCHAR(64),
  vertical_id UUID REFERENCES edge_verticals(id) ON DELETE SET NULL,
  current_situation TEXT,
  existing_processes TEXT,
  problems TEXT,
  objectives TEXT,
  estimated_sites INT,
  estimated_users INT,
  estimated_devices INT,
  estimated_activity_volume TEXT,
  integration_needs TEXT,
  migration_needs TEXT,
  security_requirements TEXT,
  compliance_requirements TEXT,
  network_constraints TEXT,
  hosting_constraints TEXT,
  geographic_constraints TEXT,
  availability_requirements TEXT,
  timeline_notes TEXT,
  success_criteria TEXT,
  functional_requirements JSONB NOT NULL DEFAULT '[]'::jsonb,
  technical_requirements JSONB NOT NULL DEFAULT '[]'::jsonb,
  gap_analysis JSONB NOT NULL DEFAULT '[]'::jsonb,
  fit_decision VARCHAR(32)
    CHECK (fit_decision IS NULL OR fit_decision IN (
      'FIT','PARTIAL_FIT','NO_FIT','NEEDS_REVIEW'
    )),
  uncovered_needs JSONB NOT NULL DEFAULT '[]'::jsonb,
  recommendations TEXT,
  technical_validation_notes TEXT,
  technically_validated_at TIMESTAMPTZ,
  technically_validated_by UUID,
  completed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edge_sales_needs_opportunity
  ON edge_sales_needs_assessments (opportunity_id, status);

CREATE TABLE IF NOT EXISTS edge_sales_discovery_questionnaires (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  vertical_id UUID REFERENCES edge_verticals(id) ON DELETE SET NULL,
  product_id UUID REFERENCES edge_products(id) ON DELETE SET NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('DRAFT','ACTIVE','ARCHIVED')),
  questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_sales_discovery_questionnaires_code_key UNIQUE (code)
);

-- Operator: assessments
INSERT INTO edge_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM edge_roles r
INNER JOIN edge_permissions p ON p.code IN (
  'platform:sales:assessments:manage',
  'platform:sales:activities:manage'
)
WHERE r.code = 'EDGE_PLATFORM_OPERATOR'
ON CONFLICT DO NOTHING;
