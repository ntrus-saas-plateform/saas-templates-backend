-- Migration 077: P3 marketing / demand generation / acquisition foundation
-- Control-plane only. No invented metrics. No tenant CRM merge.
-- References P1 products and P2 commercial entities by FK where applicable.

-- ---------------------------------------------------------------------------
-- Strategy & planning
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_marketing_strategies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  scope_type VARCHAR(32) NOT NULL
    CHECK (scope_type IN ('GLOBAL','PRODUCT','VERTICAL','MARKET','SEGMENT')),
  product_id UUID REFERENCES edge_products(id) ON DELETE SET NULL,
  vertical_id UUID REFERENCES edge_verticals(id) ON DELETE SET NULL,
  market_id UUID REFERENCES edge_commercial_markets(id) ON DELETE SET NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN (
      'DRAFT','IN_REVIEW','APPROVED','ACTIVE','SUPERSEDED','ARCHIVED'
    )),
  version INT NOT NULL DEFAULT 1,
  owner_administrator_id UUID REFERENCES edge_administrators(id) ON DELETE SET NULL,
  effective_from TIMESTAMPTZ,
  effective_until TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  CONSTRAINT edge_marketing_strategies_code_key UNIQUE (code)
);

CREATE TABLE IF NOT EXISTS edge_marketing_objectives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_id UUID NOT NULL REFERENCES edge_marketing_strategies(id) ON DELETE CASCADE,
  code VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  objective_type VARCHAR(64) NOT NULL
    CHECK (objective_type IN (
      'AWARENESS','DEMAND_GENERATION','ACQUISITION','CONVERSION','GROWTH','BUDGET'
    )),
  period_type VARCHAR(16) NOT NULL
    CHECK (period_type IN ('ANNUAL','QUARTERLY','MONTHLY','CUSTOM')),
  target_metric VARCHAR(128) NOT NULL,
  target_value NUMERIC(19,6),
  actual_value NUMERIC(19,6),
  actual_value_source VARCHAR(32) NOT NULL DEFAULT 'UNAVAILABLE'
    CHECK (actual_value_source IN ('MEASURED','ESTIMATED','UNAVAILABLE')),
  currency CHAR(3),
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (strategy_id, code)
);

-- ---------------------------------------------------------------------------
-- Audiences (rules reference P2 entities — no forked definitions)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_marketing_audiences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  audience_kind VARCHAR(16) NOT NULL DEFAULT 'DYNAMIC'
    CHECK (audience_kind IN ('STATIC','DYNAMIC')),
  product_id UUID REFERENCES edge_products(id) ON DELETE SET NULL,
  vertical_id UUID REFERENCES edge_verticals(id) ON DELETE SET NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT','ACTIVE','DEPRECATED','ARCHIVED')),
  version INT NOT NULL DEFAULT 1,
  estimated_size INT,
  estimated_size_source VARCHAR(32) NOT NULL DEFAULT 'UNAVAILABLE'
    CHECK (estimated_size_source IN ('MEASURED','ESTIMATED','UNAVAILABLE')),
  rules_hash VARCHAR(128),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  CONSTRAINT edge_marketing_audiences_code_key UNIQUE (code)
);

CREATE TABLE IF NOT EXISTS edge_marketing_audience_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audience_id UUID NOT NULL REFERENCES edge_marketing_audiences(id) ON DELETE CASCADE,
  rule_type VARCHAR(32) NOT NULL
    CHECK (rule_type IN ('INCLUDE','EXCLUDE')),
  criterion_type VARCHAR(64) NOT NULL
    CHECK (criterion_type IN (
      'MARKET','VERTICAL','SEGMENT','ICP','PERSONA','COUNTRY','REGION','LANGUAGE',
      'COMPANY_SIZE','INDUSTRY','PRODUCT_INTEREST','LEAD_ORIGIN','CONVERTED_LEAD',
      'INELIGIBLE_LEAD'
    )),
  criterion_ref VARCHAR(255),
  criterion_value JSONB NOT NULL DEFAULT '{}'::jsonb,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edge_marketing_audience_rules_audience
  ON edge_marketing_audience_rules (audience_id, position);

-- ---------------------------------------------------------------------------
-- Campaigns
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_marketing_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  campaign_type VARCHAR(64) NOT NULL
    CHECK (campaign_type IN (
      'BRAND_AWARENESS','PRODUCT_AWARENESS','PRODUCT_LAUNCH','VERTICAL_ACQUISITION',
      'MARKET_EXPANSION','LEAD_GENERATION','DEMO_REQUEST','FREE_TRIAL_ACQUISITION',
      'WEBINAR_REGISTRATION','EVENT_REGISTRATION','PARTNER_ACQUISITION',
      'REFERRAL_ACQUISITION','CUSTOMER_RE_ENGAGEMENT','COMMERCIAL_ANNOUNCEMENT',
      'PRODUCT_EDUCATION','COMPETITIVE_POSITIONING','RETARGETING'
    )),
  objective TEXT,
  product_id UUID NOT NULL REFERENCES edge_products(id) ON DELETE RESTRICT,
  vertical_id UUID REFERENCES edge_verticals(id) ON DELETE SET NULL,
  market_id UUID REFERENCES edge_commercial_markets(id) ON DELETE SET NULL,
  segment_id UUID REFERENCES edge_market_segments(id) ON DELETE SET NULL,
  icp_id UUID REFERENCES edge_icp_definitions(id) ON DELETE SET NULL,
  persona_id UUID REFERENCES edge_persona_definitions(id) ON DELETE SET NULL,
  offer_type VARCHAR(32)
    CHECK (offer_type IS NULL OR offer_type IN (
      'PLAN','PACKAGE','ADDON','ENTERPRISE_TEMPLATE'
    )),
  offer_id UUID,
  audience_id UUID REFERENCES edge_marketing_audiences(id) ON DELETE SET NULL,
  strategy_id UUID REFERENCES edge_marketing_strategies(id) ON DELETE SET NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN (
      'DRAFT','IN_REVIEW','APPROVED','SCHEDULED','ACTIVE','PAUSED',
      'COMPLETED','ARCHIVED','REJECTED','CANCELLED'
    )),
  version INT NOT NULL DEFAULT 1,
  budget_amount NUMERIC(19,6),
  budget_currency CHAR(3),
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  owner_administrator_id UUID REFERENCES edge_administrators(id) ON DELETE SET NULL,
  channels JSONB NOT NULL DEFAULT '[]'::jsonb,
  attribution_policy JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  CONSTRAINT edge_marketing_campaigns_code_key UNIQUE (code)
);

CREATE INDEX IF NOT EXISTS idx_edge_marketing_campaigns_product
  ON edge_marketing_campaigns (product_id, status);

CREATE TABLE IF NOT EXISTS edge_marketing_campaign_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES edge_marketing_campaigns(id) ON DELETE CASCADE,
  campaign_version INT NOT NULL,
  approval_type VARCHAR(32) NOT NULL
    CHECK (approval_type IN (
      'CONTENT','OFFER','BUDGET','TARGETING','CHANNEL','FINAL'
    )),
  decision VARCHAR(16) NOT NULL
    CHECK (decision IN ('PENDING','APPROVED','REJECTED')),
  decided_by UUID REFERENCES edge_administrators(id) ON DELETE SET NULL,
  decided_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Content & landing pages
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_marketing_contents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  content_type VARCHAR(64) NOT NULL
    CHECK (content_type IN (
      'ARTICLE','PRODUCT_PAGE','VERTICAL_PAGE','PRESENTATION','OFFER_DESCRIPTION',
      'CASE_STUDY','TESTIMONIAL','WHITEPAPER','GUIDE','COMMERCIAL_DOC','INFOGRAPHIC',
      'VIDEO','IMAGE','BANNER','SOCIAL_POST','NEWSLETTER','EVENT_INVITE',
      'WHATSAPP_MESSAGE','DEMO_SCRIPT'
    )),
  product_id UUID REFERENCES edge_products(id) ON DELETE SET NULL,
  vertical_id UUID REFERENCES edge_verticals(id) ON DELETE SET NULL,
  market_id UUID REFERENCES edge_commercial_markets(id) ON DELETE SET NULL,
  locale VARCHAR(16) NOT NULL DEFAULT 'en',
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN (
      'DRAFT','IN_REVIEW','APPROVED','PUBLISHED','EXPIRED','ARCHIVED','REJECTED'
    )),
  version INT NOT NULL DEFAULT 1,
  body JSONB NOT NULL DEFAULT '{}'::jsonb,
  seo JSONB NOT NULL DEFAULT '{}'::jsonb,
  usage_rights JSONB NOT NULL DEFAULT '{}'::jsonb,
  owner_administrator_id UUID REFERENCES edge_administrators(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  CONSTRAINT edge_marketing_contents_code_key UNIQUE (code)
);

CREATE TABLE IF NOT EXISTS edge_marketing_landing_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  page_type VARCHAR(64) NOT NULL
    CHECK (page_type IN (
      'PRODUCT','VERTICAL','SEGMENT','CAMPAIGN','LAUNCH','DEMO','TRIAL',
      'EVENT','PARTNER','CONTACT','RESOURCE_DOWNLOAD'
    )),
  slug VARCHAR(128) NOT NULL,
  product_id UUID REFERENCES edge_products(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES edge_marketing_campaigns(id) ON DELETE SET NULL,
  locale VARCHAR(16) NOT NULL DEFAULT 'en',
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN (
      'DRAFT','IN_REVIEW','APPROVED','PUBLISHED','UNPUBLISHED','ARCHIVED'
    )),
  version INT NOT NULL DEFAULT 1,
  layout JSONB NOT NULL DEFAULT '{}'::jsonb,
  seo JSONB NOT NULL DEFAULT '{}'::jsonb,
  cta JSONB NOT NULL DEFAULT '{}'::jsonb,
  form_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  CONSTRAINT edge_marketing_landing_pages_code_key UNIQUE (code),
  CONSTRAINT edge_marketing_landing_pages_slug_key UNIQUE (slug)
);

-- ---------------------------------------------------------------------------
-- Forms & submissions
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_marketing_form_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  form_type VARCHAR(64) NOT NULL
    CHECK (form_type IN (
      'CONTACT','DEMO_REQUEST','TRIAL_REQUEST','INFORMATION','QUOTE_REQUEST',
      'PARTNERSHIP','EVENT_REGISTRATION','RESOURCE_DOWNLOAD','CALLBACK',
      'SALES_PRESENTATION'
    )),
  slug VARCHAR(128) NOT NULL,
  product_id UUID REFERENCES edge_products(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES edge_marketing_campaigns(id) ON DELETE SET NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT','PUBLISHED','UNPUBLISHED','ARCHIVED')),
  version INT NOT NULL DEFAULT 1,
  fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  required_consents JSONB NOT NULL DEFAULT '[]'::jsonb,
  confirmation JSONB NOT NULL DEFAULT '{}'::jsonb,
  routing JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  CONSTRAINT edge_marketing_form_definitions_code_key UNIQUE (code),
  CONSTRAINT edge_marketing_form_definitions_slug_key UNIQUE (slug)
);

ALTER TABLE edge_marketing_landing_pages
  DROP CONSTRAINT IF EXISTS edge_marketing_landing_pages_form_fk;
ALTER TABLE edge_marketing_landing_pages
  ADD CONSTRAINT edge_marketing_landing_pages_form_fk
  FOREIGN KEY (form_id) REFERENCES edge_marketing_form_definitions(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS edge_marketing_form_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID NOT NULL REFERENCES edge_marketing_form_definitions(id) ON DELETE RESTRICT,
  form_version INT NOT NULL,
  idempotency_key VARCHAR(128),
  lead_id UUID,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  utm JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_url TEXT,
  campaign_id UUID REFERENCES edge_marketing_campaigns(id) ON DELETE SET NULL,
  product_id UUID REFERENCES edge_products(id) ON DELETE SET NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'RECEIVED'
    CHECK (status IN ('RECEIVED','PROCESSED','REJECTED','DUPLICATE')),
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_marketing_form_submissions_idempotency
    UNIQUE (form_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_edge_marketing_form_submissions_form
  ON edge_marketing_form_submissions (form_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Leads / prospects
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_marketing_prospect_organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  country VARCHAR(64),
  region VARCHAR(128),
  industry VARCHAR(128),
  company_size VARCHAR(64),
  website VARCHAR(512),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS edge_marketing_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status VARCHAR(32) NOT NULL DEFAULT 'NEW'
    CHECK (status IN (
      'NEW','IDENTIFIED','ENGAGED','MARKETING_QUALIFIED','SALES_ACCEPTED',
      'DISQUALIFIED','CONVERTED','RECYCLED','NURTURING'
    )),
  email_normalized VARCHAR(320),
  primary_product_id UUID REFERENCES edge_products(id) ON DELETE SET NULL,
  vertical_id UUID REFERENCES edge_verticals(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES edge_marketing_prospect_organizations(id) ON DELETE SET NULL,
  source_type VARCHAR(64),
  source_campaign_id UUID REFERENCES edge_marketing_campaigns(id) ON DELETE SET NULL,
  source_form_id UUID REFERENCES edge_marketing_form_definitions(id) ON DELETE SET NULL,
  duplicate_of_lead_id UUID REFERENCES edge_marketing_leads(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES edge_administrators(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edge_marketing_leads_email
  ON edge_marketing_leads (email_normalized)
  WHERE email_normalized IS NOT NULL AND duplicate_of_lead_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_edge_marketing_leads_status
  ON edge_marketing_leads (status, created_at DESC);

ALTER TABLE edge_marketing_form_submissions
  DROP CONSTRAINT IF EXISTS edge_marketing_form_submissions_lead_fk;
ALTER TABLE edge_marketing_form_submissions
  ADD CONSTRAINT edge_marketing_form_submissions_lead_fk
  FOREIGN KEY (lead_id) REFERENCES edge_marketing_leads(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS edge_marketing_lead_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES edge_marketing_leads(id) ON DELETE CASCADE,
  full_name VARCHAR(255),
  job_title VARCHAR(255),
  email VARCHAR(320),
  email_normalized VARCHAR(320),
  phone VARCHAR(64),
  preferred_channel VARCHAR(32),
  is_primary BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS edge_marketing_lead_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES edge_marketing_leads(id) ON DELETE CASCADE,
  activity_type VARCHAR(64) NOT NULL,
  campaign_id UUID REFERENCES edge_marketing_campaigns(id) ON DELETE SET NULL,
  form_submission_id UUID REFERENCES edge_marketing_form_submissions(id) ON DELETE SET NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edge_marketing_lead_activities_lead
  ON edge_marketing_lead_activities (lead_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS edge_marketing_lead_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES edge_marketing_leads(id) ON DELETE CASCADE,
  purpose VARCHAR(128) NOT NULL,
  channel VARCHAR(64) NOT NULL,
  state VARCHAR(16) NOT NULL
    CHECK (state IN ('GRANTED','WITHDRAWN','DENIED')),
  granted_at TIMESTAMPTZ,
  withdrawn_at TIMESTAMPTZ,
  source VARCHAR(128) NOT NULL,
  consent_text_version VARCHAR(64) NOT NULL,
  proof_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edge_marketing_lead_consents_lead
  ON edge_marketing_lead_consents (lead_id, purpose, channel);

CREATE TABLE IF NOT EXISTS edge_marketing_scoring_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  version INT NOT NULL DEFAULT 1,
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('DRAFT','ACTIVE','DEPRECATED')),
  weights JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_marketing_scoring_models_code_version UNIQUE (code, version)
);

CREATE TABLE IF NOT EXISTS edge_marketing_lead_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES edge_marketing_leads(id) ON DELETE CASCADE,
  model_id UUID NOT NULL REFERENCES edge_marketing_scoring_models(id) ON DELETE RESTRICT,
  model_version INT NOT NULL,
  score NUMERIC(12,4) NOT NULL,
  explanation JSONB NOT NULL DEFAULT '{}'::jsonb,
  missing_signals JSONB NOT NULL DEFAULT '[]'::jsonb,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edge_marketing_lead_scores_lead
  ON edge_marketing_lead_scores (lead_id, calculated_at DESC);

-- ---------------------------------------------------------------------------
-- Attribution touchpoints (measured only — no invented metrics)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_marketing_attribution_touchpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES edge_marketing_leads(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES edge_marketing_campaigns(id) ON DELETE SET NULL,
  touch_type VARCHAR(64) NOT NULL
    CHECK (touch_type IN (
      'FIRST_TOUCH','LAST_TOUCH','LEAD_CREATION','CAMPAIGN_INFLUENCE',
      'CONVERSION','REFERRAL','PARTNER'
    )),
  channel VARCHAR(64),
  landing_page_id UUID REFERENCES edge_marketing_landing_pages(id) ON DELETE SET NULL,
  utm JSONB NOT NULL DEFAULT '{}'::jsonb,
  referrer TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  data_quality VARCHAR(16) NOT NULL DEFAULT 'MEASURED'
    CHECK (data_quality IN ('MEASURED','ESTIMATED','UNAVAILABLE')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Budget (pilotage — not accounting SoT)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_marketing_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  scope_type VARCHAR(32) NOT NULL
    CHECK (scope_type IN ('GLOBAL','PRODUCT','VERTICAL','CAMPAIGN','MARKET','CHANNEL')),
  product_id UUID REFERENCES edge_products(id) ON DELETE SET NULL,
  vertical_id UUID REFERENCES edge_verticals(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES edge_marketing_campaigns(id) ON DELETE SET NULL,
  market_id UUID REFERENCES edge_commercial_markets(id) ON DELETE SET NULL,
  channel VARCHAR(64),
  currency CHAR(3) NOT NULL,
  planned_amount NUMERIC(19,6) NOT NULL DEFAULT 0,
  committed_amount NUMERIC(19,6) NOT NULL DEFAULT 0,
  spent_amount NUMERIC(19,6) NOT NULL DEFAULT 0,
  spent_source VARCHAR(32) NOT NULL DEFAULT 'DECLARED'
    CHECK (spent_source IN ('DECLARED','IMPORTED','INTEGRATION_CONFIRMED')),
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT','APPROVED','ACTIVE','CLOSED','ARCHIVED')),
  period_start DATE,
  period_end DATE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_marketing_budgets_code_key UNIQUE (code),
  CONSTRAINT edge_marketing_budgets_amounts_nonneg CHECK (
    planned_amount >= 0 AND committed_amount >= 0 AND spent_amount >= 0
  )
);

-- ---------------------------------------------------------------------------
-- Channel config stubs (secrets never stored here)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_marketing_channel_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(64) NOT NULL,
  channel_type VARCHAR(64) NOT NULL
    CHECK (channel_type IN (
      'EMAIL','WHATSAPP_BUSINESS','WEB_NOTIFICATION','SOCIAL','DIGITAL_ADS',
      'PHYSICAL_EVENT','WEBINAR','PARTNER','REFERRAL','WEB_PUBLICATION','DIRECT_SALES'
    )),
  display_name VARCHAR(255) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'DISABLED'
    CHECK (status IN ('DISABLED','CONFIGURING','ACTIVE','SUSPENDED')),
  provider_ref VARCHAR(128),
  secret_ref VARCHAR(255),
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_marketing_channel_configs_code_key UNIQUE (code)
);

-- Default explainable scoring model (weights only — no fake scores)
INSERT INTO edge_marketing_scoring_models (code, name, version, status, weights)
VALUES (
  'DEFAULT_MQL',
  'Default marketing qualification',
  1,
  'ACTIVE',
  '{
    "icpMatch": 25,
    "segmentMatch": 15,
    "demoRequest": 30,
    "explicitContact": 20,
    "resourceDownload": 10,
    "eventParticipation": 15,
    "recencyDaysDecay": 0.5,
    "profileCompleteness": 10
  }'::jsonb
)
ON CONFLICT (code, version) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Permissions (platform:marketing:* — Edge RBAC convention)
-- ---------------------------------------------------------------------------

INSERT INTO edge_permissions (code, description) VALUES
  ('platform:marketing:strategy:read', 'Read marketing strategies and objectives'),
  ('platform:marketing:strategy:manage', 'Manage marketing strategies and objectives'),
  ('platform:marketing:audience:read', 'Read marketing audiences'),
  ('platform:marketing:audience:manage', 'Manage marketing audiences and rules'),
  ('platform:marketing:campaign:read', 'Read marketing campaigns'),
  ('platform:marketing:campaign:create', 'Create marketing campaigns'),
  ('platform:marketing:campaign:update', 'Update marketing campaigns'),
  ('platform:marketing:campaign:approve', 'Approve marketing campaigns'),
  ('platform:marketing:campaign:publish', 'Publish / activate marketing campaigns'),
  ('platform:marketing:campaign:pause', 'Pause marketing campaigns'),
  ('platform:marketing:content:read', 'Read marketing content'),
  ('platform:marketing:content:manage', 'Manage marketing content'),
  ('platform:marketing:content:approve', 'Approve marketing content'),
  ('platform:marketing:landing_page:manage', 'Manage landing pages'),
  ('platform:marketing:form:manage', 'Manage acquisition forms'),
  ('platform:marketing:lead:read', 'Read marketing leads'),
  ('platform:marketing:lead:manage', 'Manage marketing leads'),
  ('platform:marketing:lead:assign', 'Assign marketing leads'),
  ('platform:marketing:lead:export', 'Export marketing leads'),
  ('platform:marketing:automation:manage', 'Manage marketing journeys'),
  ('platform:marketing:analytics:read', 'Read marketing analytics'),
  ('platform:marketing:budget:read', 'Read marketing budgets'),
  ('platform:marketing:budget:manage', 'Manage marketing budgets'),
  ('platform:marketing:budget:approve', 'Approve marketing budgets'),
  ('platform:marketing:integrations:manage', 'Manage marketing channel integrations'),
  ('platform:marketing:governance:manage', 'Manage marketing governance settings')
ON CONFLICT (code) DO NOTHING;

INSERT INTO edge_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM edge_roles r
CROSS JOIN edge_permissions p
WHERE r.code = 'EDGE_PLATFORM_SUPER_ADMIN'
  AND p.code LIKE 'platform:marketing:%'
ON CONFLICT DO NOTHING;

INSERT INTO edge_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM edge_roles r
INNER JOIN edge_permissions p ON p.code IN (
  'platform:marketing:strategy:read',
  'platform:marketing:strategy:manage',
  'platform:marketing:audience:read',
  'platform:marketing:audience:manage',
  'platform:marketing:campaign:read',
  'platform:marketing:campaign:create',
  'platform:marketing:campaign:update',
  'platform:marketing:campaign:approve',
  'platform:marketing:campaign:publish',
  'platform:marketing:campaign:pause',
  'platform:marketing:content:read',
  'platform:marketing:content:manage',
  'platform:marketing:content:approve',
  'platform:marketing:landing_page:manage',
  'platform:marketing:form:manage',
  'platform:marketing:lead:read',
  'platform:marketing:lead:manage',
  'platform:marketing:lead:assign',
  'platform:marketing:analytics:read',
  'platform:marketing:budget:read',
  'platform:marketing:budget:manage'
)
WHERE r.code = 'EDGE_PLATFORM_OPERATOR'
ON CONFLICT DO NOTHING;

INSERT INTO edge_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM edge_roles r
INNER JOIN edge_permissions p ON p.code IN (
  'platform:marketing:strategy:read',
  'platform:marketing:audience:read',
  'platform:marketing:campaign:read',
  'platform:marketing:content:read',
  'platform:marketing:lead:read',
  'platform:marketing:analytics:read',
  'platform:marketing:budget:read'
)
WHERE r.code IN ('VERTICAL_OWNER', 'VERTICAL_ADMIN')
ON CONFLICT DO NOTHING;

INSERT INTO schema_migrations (version) VALUES ('077_edge_marketing_foundation') ON CONFLICT DO NOTHING;
