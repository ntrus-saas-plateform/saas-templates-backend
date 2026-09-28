-- Migration 043: CRM Engine Wave 1 — leads, opportunities, activities, tasks, notes,
-- segments, scoring, campaigns, credit profile projection helpers, timeline enrichment

-- ========== LEADS ==========
CREATE TABLE IF NOT EXISTS crm_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  lead_number VARCHAR(50) NOT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'NEW'
    CHECK (status IN (
      'NEW', 'ASSIGNED', 'CONTACTED', 'QUALIFIED', 'DISQUALIFIED', 'CONVERTED'
    )),
  source VARCHAR(80),
  campaign_id UUID,
  tenant_customer_id UUID,
  contact_name VARCHAR(255),
  contact_email VARCHAR(255),
  contact_phone VARCHAR(80),
  owner_id VARCHAR(128),
  team_id VARCHAR(128),
  score NUMERIC(10, 2) NOT NULL DEFAULT 0,
  expected_value NUMERIC(18, 4),
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  qualification_reason TEXT,
  notes TEXT,
  next_action TEXT,
  next_action_at TIMESTAMPTZ,
  converted_customer_id UUID,
  converted_at TIMESTAMPTZ,
  version INT NOT NULL DEFAULT 1,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, lead_number)
);
CREATE INDEX IF NOT EXISTS idx_crm_leads_org_status
  ON crm_leads (organization_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_leads_owner
  ON crm_leads (organization_id, owner_id);

-- ========== OPPORTUNITIES ==========
CREATE TABLE IF NOT EXISTS crm_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  opportunity_number VARCHAR(50) NOT NULL,
  tenant_customer_id UUID NOT NULL,
  lead_id UUID REFERENCES crm_leads(id) ON DELETE SET NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN', 'WON', 'LOST', 'CANCELLED')),
  stage VARCHAR(80) NOT NULL DEFAULT 'QUALIFICATION',
  owner_id VARCHAR(128),
  team_id VARCHAR(128),
  source VARCHAR(80),
  value NUMERIC(18, 4) NOT NULL DEFAULT 0,
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  probability NUMERIC(5, 2) NOT NULL DEFAULT 0,
  expected_close_at DATE,
  win_reason TEXT,
  loss_reason TEXT,
  product_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  version INT NOT NULL DEFAULT 1,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, opportunity_number)
);
CREATE INDEX IF NOT EXISTS idx_crm_opportunities_customer
  ON crm_opportunities (organization_id, tenant_customer_id, status);
CREATE INDEX IF NOT EXISTS idx_crm_opportunities_stage
  ON crm_opportunities (organization_id, stage, expected_close_at);

CREATE TABLE IF NOT EXISTS crm_opportunity_stage_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES crm_opportunities(id) ON DELETE CASCADE,
  from_stage VARCHAR(80),
  to_stage VARCHAR(80) NOT NULL,
  actor_id VARCHAR(128),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ========== ACTIVITIES / TASKS / NOTES ==========
CREATE TABLE IF NOT EXISTS crm_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  activity_type VARCHAR(40) NOT NULL
    CHECK (activity_type IN ('CALL', 'EMAIL', 'MEETING', 'VISIT', 'MESSAGE', 'FOLLOW_UP', 'OTHER')),
  status VARCHAR(30) NOT NULL DEFAULT 'PLANNED'
    CHECK (status IN ('PLANNED', 'COMPLETED', 'CANCELLED')),
  tenant_customer_id UUID,
  lead_id UUID REFERENCES crm_leads(id) ON DELETE SET NULL,
  opportunity_id UUID REFERENCES crm_opportunities(id) ON DELETE SET NULL,
  owner_id VARCHAR(128),
  team_id VARCHAR(128),
  subject VARCHAR(255),
  notes TEXT,
  outcome TEXT,
  scheduled_at TIMESTAMPTZ,
  duration_minutes INT,
  completed_at TIMESTAMPTZ,
  version INT NOT NULL DEFAULT 1,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_crm_activities_customer
  ON crm_activities (organization_id, tenant_customer_id, scheduled_at DESC);

CREATE TABLE IF NOT EXISTS crm_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  title VARCHAR(255) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'TODO'
    CHECK (status IN ('TODO', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'CANCELLED')),
  priority VARCHAR(20) NOT NULL DEFAULT 'NORMAL'
    CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')),
  owner_id VARCHAR(128),
  team_id VARCHAR(128),
  due_at TIMESTAMPTZ,
  tenant_customer_id UUID,
  lead_id UUID REFERENCES crm_leads(id) ON DELETE SET NULL,
  opportunity_id UUID REFERENCES crm_opportunities(id) ON DELETE SET NULL,
  campaign_id UUID,
  reminder_at TIMESTAMPTZ,
  version INT NOT NULL DEFAULT 1,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_owner
  ON crm_tasks (organization_id, owner_id, status, due_at);

CREATE TABLE IF NOT EXISTS crm_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  entity_type VARCHAR(40) NOT NULL
    CHECK (entity_type IN ('CUSTOMER', 'LEAD', 'OPPORTUNITY', 'ACTIVITY', 'CAMPAIGN')),
  entity_id UUID NOT NULL,
  author_id VARCHAR(128) NOT NULL,
  visibility VARCHAR(30) NOT NULL DEFAULT 'INTERNAL'
    CHECK (visibility IN ('INTERNAL', 'RESTRICTED', 'PUBLIC')),
  body TEXT NOT NULL,
  source VARCHAR(40) NOT NULL DEFAULT 'USER',
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_crm_notes_entity
  ON crm_notes (organization_id, entity_type, entity_id, created_at DESC);

-- ========== SEGMENTS / GROUPS / SCORING ==========
CREATE TABLE IF NOT EXISTS crm_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  segment_type VARCHAR(20) NOT NULL DEFAULT 'STATIC'
    CHECK (segment_type IN ('STATIC', 'DYNAMIC')),
  rules JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
  effective_from TIMESTAMPTZ,
  effective_to TIMESTAMPTZ,
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, code)
);

CREATE TABLE IF NOT EXISTS crm_segment_memberships (
  segment_id UUID NOT NULL REFERENCES crm_segments(id) ON DELETE CASCADE,
  tenant_customer_id UUID NOT NULL,
  organization_id UUID NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (segment_id, tenant_customer_id)
);
CREATE INDEX IF NOT EXISTS idx_crm_segment_members_customer
  ON crm_segment_memberships (organization_id, tenant_customer_id);

CREATE TABLE IF NOT EXISTS crm_customer_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  group_type VARCHAR(40) NOT NULL DEFAULT 'MANUAL'
    CHECK (group_type IN ('MANUAL', 'DYNAMIC', 'B2B', 'ACCOUNT', 'LOYALTY')),
  status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
  version INT NOT NULL DEFAULT 1,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, code)
);

CREATE TABLE IF NOT EXISTS crm_customer_group_members (
  group_id UUID NOT NULL REFERENCES crm_customer_groups(id) ON DELETE CASCADE,
  tenant_customer_id UUID NOT NULL,
  organization_id UUID NOT NULL,
  PRIMARY KEY (group_id, tenant_customer_id)
);

CREATE TABLE IF NOT EXISTS crm_customer_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  tenant_customer_id UUID NOT NULL,
  score_version INT NOT NULL DEFAULT 1,
  total_score NUMERIC(12, 4) NOT NULL DEFAULT 0,
  dimensions JSONB NOT NULL DEFAULT '{}'::jsonb,
  formula_code VARCHAR(80) NOT NULL DEFAULT 'DEFAULT_RFM',
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, tenant_customer_id, score_version)
);
CREATE INDEX IF NOT EXISTS idx_crm_customer_scores_latest
  ON crm_customer_scores (organization_id, tenant_customer_id, score_version DESC);

-- ========== CAMPAIGNS ==========
CREATE TABLE IF NOT EXISTS crm_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  campaign_number VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'SCHEDULED', 'RUNNING', 'PAUSED', 'COMPLETED', 'CANCELLED')),
  channel VARCHAR(40) NOT NULL DEFAULT 'EMAIL',
  audience JSONB NOT NULL DEFAULT '{}'::jsonb,
  rules JSONB NOT NULL DEFAULT '{}'::jsonb,
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, campaign_number)
);

CREATE TABLE IF NOT EXISTS crm_campaign_audience_members (
  campaign_id UUID NOT NULL REFERENCES crm_campaigns(id) ON DELETE CASCADE,
  tenant_customer_id UUID NOT NULL,
  organization_id UUID NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'QUEUED', 'SENT', 'SKIPPED', 'FAILED', 'OPTED_OUT')),
  skip_reason TEXT,
  PRIMARY KEY (campaign_id, tenant_customer_id)
);

-- ========== CREDIT PROFILE (CRM view — not AR ledger) ==========
CREATE TABLE IF NOT EXISTS crm_customer_credit_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  tenant_customer_id UUID NOT NULL,
  credit_limit NUMERIC(18, 4),
  risk_category VARCHAR(40) NOT NULL DEFAULT 'STANDARD',
  payment_terms_code VARCHAR(40),
  credit_status VARCHAR(30) NOT NULL DEFAULT 'OK'
    CHECK (credit_status IN ('OK', 'REVIEW', 'HOLD', 'BLOCKED')),
  review_at DATE,
  approval_state VARCHAR(40),
  version INT NOT NULL DEFAULT 1,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, tenant_customer_id)
);

-- ========== TIMELINE enrichment ==========
ALTER TABLE customer_timeline_events
  ADD COLUMN IF NOT EXISTS organization_id UUID,
  ADD COLUMN IF NOT EXISTS source_domain VARCHAR(40),
  ADD COLUMN IF NOT EXISTS aggregate_type VARCHAR(80),
  ADD COLUMN IF NOT EXISTS aggregate_id UUID;

CREATE INDEX IF NOT EXISTS idx_customer_timeline_org
  ON customer_timeline_events (tenant_id, organization_id, tenant_customer_id, occurred_at DESC);

-- ========== CAPABILITIES ==========
INSERT INTO capability_definitions (code, name, description, category, status, required_modules, supported_verticals)
VALUES
  ('CUSTOMER_MANAGEMENT', 'Customer management', 'Customer master lifecycle', 'CRM', 'AVAILABLE', '["customer"]'::jsonb, '["*"]'::jsonb),
  ('CONTACT_MANAGEMENT', 'Contact management', 'Customer contacts', 'CRM', 'AVAILABLE', '["customer"]'::jsonb, '["*"]'::jsonb),
  ('LEAD_MANAGEMENT', 'Lead management', 'Leads and qualification', 'CRM', 'AVAILABLE', '["customer"]'::jsonb, '["*"]'::jsonb),
  ('PROSPECT_MANAGEMENT', 'Prospect management', 'Prospect tracking', 'CRM', 'AVAILABLE', '["customer"]'::jsonb, '["*"]'::jsonb),
  ('OPPORTUNITY_MANAGEMENT', 'Opportunity management', 'Sales opportunities / pipeline', 'CRM', 'AVAILABLE', '["customer"]'::jsonb, '["WHOLESALE","DISTRIBUTION","B2B","RETAIL_STORE","*"]'::jsonb),
  ('ACTIVITY_MANAGEMENT', 'Activity management', 'CRM activities', 'CRM', 'AVAILABLE', '["customer"]'::jsonb, '["*"]'::jsonb),
  ('TASK_MANAGEMENT', 'Task management', 'CRM tasks', 'CRM', 'AVAILABLE', '["customer"]'::jsonb, '["*"]'::jsonb),
  ('NOTE_MANAGEMENT', 'Note management', 'Contextual CRM notes', 'CRM', 'AVAILABLE', '["customer"]'::jsonb, '["*"]'::jsonb),
  ('CUSTOMER_TIMELINE', 'Customer timeline', 'Customer 360 timeline projection', 'CRM', 'AVAILABLE', '["customer"]'::jsonb, '["*"]'::jsonb),
  ('CUSTOMER_SEGMENTATION', 'Customer segmentation', 'Static/dynamic segments', 'CRM', 'AVAILABLE', '["customer"]'::jsonb, '["*"]'::jsonb),
  ('CUSTOMER_GROUPS', 'Customer groups', 'CRM customer groups', 'CRM', 'AVAILABLE', '["customer"]'::jsonb, '["*"]'::jsonb),
  ('CUSTOMER_SCORING', 'Customer scoring', 'RFM / engagement scoring', 'CRM', 'AVAILABLE', '["customer"]'::jsonb, '["*"]'::jsonb),
  ('CUSTOMER_360', 'Customer 360', 'Consolidated customer view', 'CRM', 'AVAILABLE', '["customer"]'::jsonb, '["*"]'::jsonb),
  ('CAMPAIGNS', 'Campaigns', 'Marketing campaigns', 'CRM', 'AVAILABLE', '["customer"]'::jsonb, '["*"]'::jsonb),
  ('CAMPAIGN_AUDIENCES', 'Campaign audiences', 'Campaign audience selection', 'CRM', 'AVAILABLE', '["customer"]'::jsonb, '["*"]'::jsonb),
  ('CUSTOMER_CREDIT', 'Customer credit profile', 'CRM credit profile (not AR ledger)', 'CRM', 'AVAILABLE', '["customer","sales"]'::jsonb, '["WHOLESALE","DISTRIBUTION","B2B","*"]'::jsonb),
  ('CRM_ANALYTICS', 'CRM analytics', 'CRM dashboard metrics', 'CRM', 'AVAILABLE', '["customer"]'::jsonb, '["*"]'::jsonb)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  required_modules = EXCLUDED.required_modules,
  supported_verticals = EXCLUDED.supported_verticals,
  updated_at = NOW();

INSERT INTO capability_dependencies (capability_code, depends_on_code) VALUES
  ('CUSTOMER_MANAGEMENT', 'CRM'),
  ('CONTACT_MANAGEMENT', 'CRM'),
  ('LEAD_MANAGEMENT', 'CRM'),
  ('PROSPECT_MANAGEMENT', 'LEAD_MANAGEMENT'),
  ('OPPORTUNITY_MANAGEMENT', 'CRM'),
  ('ACTIVITY_MANAGEMENT', 'CRM'),
  ('TASK_MANAGEMENT', 'CRM'),
  ('NOTE_MANAGEMENT', 'CRM'),
  ('CUSTOMER_TIMELINE', 'CRM'),
  ('CUSTOMER_SEGMENTATION', 'CRM'),
  ('CUSTOMER_GROUPS', 'CRM'),
  ('CUSTOMER_SCORING', 'CRM'),
  ('CUSTOMER_360', 'CRM'),
  ('CAMPAIGNS', 'CRM'),
  ('CAMPAIGN_AUDIENCES', 'CAMPAIGNS'),
  ('CUSTOMER_CREDIT', 'CRM'),
  ('CRM_ANALYTICS', 'CRM')
ON CONFLICT DO NOTHING;

-- Compose into profiles that already include CRM
UPDATE business_profiles
SET default_capabilities = (
  SELECT COALESCE(jsonb_agg(DISTINCT c), '[]'::jsonb)
  FROM (
    SELECT jsonb_array_elements_text(default_capabilities) AS c
    UNION ALL SELECT 'CUSTOMER_MANAGEMENT'
    UNION ALL SELECT 'CONTACT_MANAGEMENT'
    UNION ALL SELECT 'LEAD_MANAGEMENT'
    UNION ALL SELECT 'ACTIVITY_MANAGEMENT'
    UNION ALL SELECT 'TASK_MANAGEMENT'
    UNION ALL SELECT 'NOTE_MANAGEMENT'
    UNION ALL SELECT 'CUSTOMER_TIMELINE'
    UNION ALL SELECT 'CUSTOMER_360'
    UNION ALL SELECT 'CUSTOMER_SEGMENTATION'
    UNION ALL SELECT 'CUSTOMER_SCORING'
    UNION ALL SELECT 'CRM_ANALYTICS'
  ) x
),
updated_at = NOW()
WHERE default_capabilities @> '["CRM"]'::jsonb
   OR default_modules @> '["customer"]'::jsonb;

-- Wholesale-ish profiles get opportunity + credit + campaigns
UPDATE business_profiles
SET default_capabilities = (
  SELECT COALESCE(jsonb_agg(DISTINCT c), '[]'::jsonb)
  FROM (
    SELECT jsonb_array_elements_text(default_capabilities) AS c
    UNION ALL SELECT 'OPPORTUNITY_MANAGEMENT'
    UNION ALL SELECT 'CUSTOMER_CREDIT'
    UNION ALL SELECT 'CUSTOMER_GROUPS'
    UNION ALL SELECT 'CAMPAIGNS'
    UNION ALL SELECT 'CAMPAIGN_AUDIENCES'
  ) x
),
updated_at = NOW()
WHERE code IN ('WHOLESALE', 'DISTRIBUTION', 'B2B');

UPDATE business_profiles
SET default_capabilities = (
  SELECT COALESCE(jsonb_agg(DISTINCT c), '[]'::jsonb)
  FROM (
    SELECT jsonb_array_elements_text(default_capabilities) AS c
    UNION ALL SELECT 'CAMPAIGNS'
    UNION ALL SELECT 'CAMPAIGN_AUDIENCES'
    UNION ALL SELECT 'LOYALTY'
  ) x
),
updated_at = NOW()
WHERE code IN ('SUPERMARKET', 'GROCERY', 'RETAIL_STORE', 'BOUTIQUE', 'RESTAURANT', 'PHARMACY');

INSERT INTO tenant_number_sequences (document_type, prefix, pad_length, reset_policy)
VALUES
  ('LEAD', 'LEAD-', 6, 'YEAR'),
  ('OPP', 'OPP-', 6, 'YEAR'),
  ('CMP', 'CMP-', 6, 'YEAR')
ON CONFLICT DO NOTHING;

INSERT INTO schema_migrations (version) VALUES ('043_crm_engine_v1') ON CONFLICT DO NOTHING;
