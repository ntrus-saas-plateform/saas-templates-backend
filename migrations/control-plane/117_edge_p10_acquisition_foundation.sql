-- Migration 117: P10.0 SaaS Customer Experience & Subscription Acquisition foundation
-- Presentations, prospects, forms, applications, quotes, checkout orchestration, handoffs.
-- Never invent products/prices; no payment credentials; no tenant IAM.
-- Soft UUID refs to P1/P2/P4 where optional nulls make hard FKs risky.

INSERT INTO edge_permissions (code, description) VALUES
  ('platform:acquisition:read', 'Read acquisition CX resources'),
  ('platform:acquisition:manage', 'Manage acquisition prospects/leads/applications'),
  ('platform:acquisition:review', 'Review acquisition applications and qualifications'),
  ('platform:acquisition:approve', 'Approve acquisition qualifications / SoD decisions'),
  ('platform:acquisition:forms:manage', 'Manage acquisition form schemas and draft versions'),
  ('platform:acquisition:forms:publish', 'Publish acquisition form versions (immutable after publish)'),
  ('platform:acquisition:documents:review', 'Review acquisition document references'),
  ('platform:acquisition:quotes:manage', 'Manage quote requests and quote references'),
  ('platform:acquisition:checkout:operate', 'Operate checkout sessions (no payment credentials)'),
  ('platform:acquisition:analytics:read', 'Read acquisition analytics and attribution'),
  ('platform:acquisition:governance:manage', 'Manage acquisition journeys, audit, governance')
ON CONFLICT (code) DO NOTHING;

INSERT INTO edge_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM edge_roles r
INNER JOIN edge_permissions p ON p.code LIKE 'platform:acquisition:%'
WHERE r.code = 'EDGE_PLATFORM_SUPER_ADMIN'
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- Product / segment / plan presentations (display only — refs to P1/P2)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_p10_product_presentations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES edge_products(id) ON DELETE RESTRICT,
  code VARCHAR(64) NOT NULL,
  slug VARCHAR(128) NOT NULL,
  title VARCHAR(255) NOT NULL,
  summary TEXT,
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT','REVIEW','PUBLISHED','DEPRECATED','ARCHIVED')),
  locale VARCHAR(16) NOT NULL DEFAULT 'en',
  current_published_version_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by VARCHAR(255) NOT NULL,
  updated_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  CONSTRAINT uq_edge_p10_product_presentations_code UNIQUE (code),
  CONSTRAINT uq_edge_p10_product_presentations_slug UNIQUE (slug)
);
CREATE INDEX IF NOT EXISTS idx_edge_p10_product_presentations_product
  ON edge_p10_product_presentations (product_id, status);

CREATE TABLE IF NOT EXISTS edge_p10_product_content_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  presentation_id UUID NOT NULL REFERENCES edge_p10_product_presentations(id) ON DELETE RESTRICT,
  version_number INTEGER NOT NULL CHECK (version_number >= 1),
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT','PUBLISHED','SUPERSEDED','ARCHIVED')),
  published_at TIMESTAMPTZ,
  published_by VARCHAR(255),
  immutable_after_publish BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_edge_p10_product_content_versions UNIQUE (presentation_id, version_number)
);
CREATE INDEX IF NOT EXISTS idx_edge_p10_product_content_versions_status
  ON edge_p10_product_content_versions (presentation_id, status);

ALTER TABLE edge_p10_product_presentations
  DROP CONSTRAINT IF EXISTS edge_p10_prod_pres_pub_ver_fkey;
ALTER TABLE edge_p10_product_presentations
  ADD CONSTRAINT edge_p10_prod_pres_pub_ver_fkey
  FOREIGN KEY (current_published_version_id)
  REFERENCES edge_p10_product_content_versions(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS edge_p10_segment_presentations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  product_presentation_id UUID REFERENCES edge_p10_product_presentations(id) ON DELETE SET NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT','PUBLISHED','DEPRECATED','ARCHIVED')),
  targeting_rules JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by VARCHAR(255) NOT NULL,
  updated_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  CONSTRAINT uq_edge_p10_segment_presentations_code UNIQUE (code)
);

CREATE TABLE IF NOT EXISTS edge_p10_plan_presentations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commercial_plan_id UUID NOT NULL REFERENCES edge_commercial_plans(id) ON DELETE RESTRICT,
  product_presentation_id UUID REFERENCES edge_p10_product_presentations(id) ON DELETE SET NULL,
  code VARCHAR(64) NOT NULL,
  title VARCHAR(255) NOT NULL,
  summary TEXT,
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT','REVIEW','PUBLISHED','DEPRECATED','ARCHIVED')),
  -- Display-only pricing mode — never invent amounts; store display refs only
  price_display_mode VARCHAR(32) NOT NULL DEFAULT 'INDICATIVE'
    CHECK (price_display_mode IN (
      'AUTHORITATIVE','INDICATIVE','QUOTE_REQUIRED','ENTERPRISE_CUSTOM'
    )),
  price_display_ref TEXT,
  currency_hint VARCHAR(8),
  features_display JSONB NOT NULL DEFAULT '[]'::jsonb,
  cta_label VARCHAR(128),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by VARCHAR(255) NOT NULL,
  updated_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  CONSTRAINT uq_edge_p10_plan_presentations_code UNIQUE (code)
);
CREATE INDEX IF NOT EXISTS idx_edge_p10_plan_presentations_plan
  ON edge_p10_plan_presentations (commercial_plan_id, status);

-- ---------------------------------------------------------------------------
-- Prospects / leads
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_p10_prospects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_normalized VARCHAR(255) NOT NULL,
  display_name VARCHAR(255),
  company_name VARCHAR(255),
  status VARCHAR(32) NOT NULL DEFAULT 'NEW'
    CHECK (status IN (
      'NEW','CONTACTED','ENGAGED','QUALIFYING','QUALIFIED',
      'APPLICATION_IN_PROGRESS','CHECKOUT_PENDING','HANDED_OFF',
      'CONVERTED','DISQUALIFIED','ARCHIVED'
    )),
  commercial_account_id UUID, -- soft ref → edge_sales_commercial_accounts (P4)
  product_id UUID,            -- soft ref → edge_products (P1)
  commercial_plan_id UUID,    -- soft ref → edge_commercial_plans (P2)
  plan_presentation_id UUID REFERENCES edge_p10_plan_presentations(id) ON DELETE SET NULL,
  locale VARCHAR(16),
  country VARCHAR(64),
  source_channel VARCHAR(64),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by VARCHAR(255),
  updated_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1)
);
CREATE INDEX IF NOT EXISTS idx_edge_p10_prospects_email
  ON edge_p10_prospects (email_normalized);
CREATE INDEX IF NOT EXISTS idx_edge_p10_prospects_status
  ON edge_p10_prospects (status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_edge_p10_prospects_account
  ON edge_p10_prospects (commercial_account_id)
  WHERE commercial_account_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS edge_p10_acquisition_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id UUID REFERENCES edge_p10_prospects(id) ON DELETE SET NULL,
  email_normalized VARCHAR(255) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'CAPTURED'
    CHECK (status IN (
      'CAPTURED','VERIFIED','SCORED','PROMOTED','MERGED','REJECTED','EXPIRED'
    )),
  source_type VARCHAR(64) NOT NULL DEFAULT 'FORM'
    CHECK (source_type IN (
      'FORM','PUBLIC_LANDING','MARKETING_SIGNAL','MANUAL','API','PARTNER','OTHER'
    )),
  source_ref TEXT,
  form_publication_id UUID,
  marketing_lead_soft_ref UUID,
  score NUMERIC(8,2),
  score_band VARCHAR(32),
  attribution JSONB NOT NULL DEFAULT '{}'::jsonb,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1)
);
CREATE INDEX IF NOT EXISTS idx_edge_p10_leads_email
  ON edge_p10_acquisition_leads (email_normalized, status);
CREATE INDEX IF NOT EXISTS idx_edge_p10_leads_prospect
  ON edge_p10_acquisition_leads (prospect_id)
  WHERE prospect_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS edge_p10_acquisition_lead_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES edge_p10_acquisition_leads(id) ON DELETE RESTRICT,
  event_type VARCHAR(64) NOT NULL,
  body JSONB NOT NULL DEFAULT '{}'::jsonb,
  actor_id VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_edge_p10_lead_events_lead
  ON edge_p10_acquisition_lead_events (lead_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Forms (published versions immutable)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_p10_form_schemas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT','ACTIVE','DEPRECATED','ARCHIVED')),
  product_id UUID,
  commercial_plan_id UUID,
  current_published_version_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by VARCHAR(255) NOT NULL,
  updated_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  CONSTRAINT uq_edge_p10_form_schemas_code UNIQUE (code)
);

CREATE TABLE IF NOT EXISTS edge_p10_form_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_schema_id UUID NOT NULL REFERENCES edge_p10_form_schemas(id) ON DELETE RESTRICT,
  version_number INTEGER NOT NULL CHECK (version_number >= 1),
  schema_definition JSONB NOT NULL DEFAULT '{}'::jsonb,
  condition_rules JSONB NOT NULL DEFAULT '[]'::jsonb,
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT','PUBLISHED','SUPERSEDED','ARCHIVED')),
  published_at TIMESTAMPTZ,
  published_by VARCHAR(255),
  immutable_after_publish BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_edge_p10_form_versions UNIQUE (form_schema_id, version_number)
);

ALTER TABLE edge_p10_form_schemas
  DROP CONSTRAINT IF EXISTS edge_p10_form_schema_pub_ver_fkey;
ALTER TABLE edge_p10_form_schemas
  ADD CONSTRAINT edge_p10_form_schema_pub_ver_fkey
  FOREIGN KEY (current_published_version_id)
  REFERENCES edge_p10_form_versions(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS edge_p10_form_publications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_schema_id UUID NOT NULL REFERENCES edge_p10_form_schemas(id) ON DELETE RESTRICT,
  form_version_id UUID NOT NULL REFERENCES edge_p10_form_versions(id) ON DELETE RESTRICT,
  channel VARCHAR(64) NOT NULL DEFAULT 'PUBLIC_WEB'
    CHECK (channel IN ('PUBLIC_WEB','PARTNER','INTERNAL','EMBED','API')),
  public_slug VARCHAR(128),
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE','SUSPENDED','RETIRED')),
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_by VARCHAR(255) NOT NULL,
  expires_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_edge_p10_form_publications_slug UNIQUE (public_slug)
);
CREATE INDEX IF NOT EXISTS idx_edge_p10_form_publications_version
  ON edge_p10_form_publications (form_version_id, status);

ALTER TABLE edge_p10_acquisition_leads
  DROP CONSTRAINT IF EXISTS edge_p10_leads_form_pub_fkey;
ALTER TABLE edge_p10_acquisition_leads
  ADD CONSTRAINT edge_p10_leads_form_pub_fkey
  FOREIGN KEY (form_publication_id)
  REFERENCES edge_p10_form_publications(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS edge_p10_document_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  form_schema_id UUID REFERENCES edge_p10_form_schemas(id) ON DELETE SET NULL,
  document_type VARCHAR(64) NOT NULL,
  required BOOLEAN NOT NULL DEFAULT TRUE,
  condition_rules JSONB NOT NULL DEFAULT '[]'::jsonb,
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE','INACTIVE','ARCHIVED')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_edge_p10_document_requirements_code UNIQUE (code)
);

-- ---------------------------------------------------------------------------
-- Applications / documents / qualification
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_p10_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_number VARCHAR(32) NOT NULL,
  prospect_id UUID NOT NULL REFERENCES edge_p10_prospects(id) ON DELETE RESTRICT,
  lead_id UUID REFERENCES edge_p10_acquisition_leads(id) ON DELETE SET NULL,
  form_schema_id UUID NOT NULL REFERENCES edge_p10_form_schemas(id) ON DELETE RESTRICT,
  form_version_id UUID NOT NULL REFERENCES edge_p10_form_versions(id) ON DELETE RESTRICT,
  form_publication_id UUID REFERENCES edge_p10_form_publications(id) ON DELETE SET NULL,
  product_id UUID,
  commercial_plan_id UUID,
  plan_presentation_id UUID REFERENCES edge_p10_plan_presentations(id) ON DELETE SET NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN (
      'DRAFT','SUBMITTED','IN_REVIEW','DOCUMENTS_PENDING','QUALIFICATION_PENDING',
      'APPROVED','REJECTED','WITHDRAWN','EXPIRED','CHECKOUT_READY','COMPLETED'
    )),
  submitted_at TIMESTAMPTZ,
  decided_at TIMESTAMPTZ,
  decided_by VARCHAR(255),
  decision_reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by VARCHAR(255),
  updated_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  CONSTRAINT uq_edge_p10_applications_number UNIQUE (application_number)
);
CREATE INDEX IF NOT EXISTS idx_edge_p10_applications_status
  ON edge_p10_applications (status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_edge_p10_applications_prospect
  ON edge_p10_applications (prospect_id);

CREATE TABLE IF NOT EXISTS edge_p10_application_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES edge_p10_applications(id) ON DELETE RESTRICT,
  field_key VARCHAR(128) NOT NULL,
  value JSONB NOT NULL DEFAULT 'null'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_edge_p10_application_answers UNIQUE (application_id, field_key)
);

CREATE TABLE IF NOT EXISTS edge_p10_application_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES edge_p10_applications(id) ON DELETE RESTRICT,
  event_type VARCHAR(64) NOT NULL,
  from_status VARCHAR(32),
  to_status VARCHAR(32),
  body JSONB NOT NULL DEFAULT '{}'::jsonb,
  actor_id VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_edge_p10_application_events_app
  ON edge_p10_application_events (application_id, created_at DESC);

CREATE TABLE IF NOT EXISTS edge_p10_document_references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES edge_p10_applications(id) ON DELETE RESTRICT,
  requirement_id UUID REFERENCES edge_p10_document_requirements(id) ON DELETE SET NULL,
  document_type VARCHAR(64) NOT NULL,
  storage_ref TEXT NOT NULL,
  file_name VARCHAR(255),
  content_type VARCHAR(128),
  checksum_sha256 VARCHAR(64),
  status VARCHAR(32) NOT NULL DEFAULT 'UPLOADED'
    CHECK (status IN (
      'UPLOADED','PENDING_REVIEW','ACCEPTED','REJECTED','EXPIRED','WITHDRAWN'
    )),
  -- No binary blob / credentials — storage_ref only
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  uploaded_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1)
);
CREATE INDEX IF NOT EXISTS idx_edge_p10_document_refs_app
  ON edge_p10_document_references (application_id, status);

CREATE TABLE IF NOT EXISTS edge_p10_document_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_reference_id UUID NOT NULL REFERENCES edge_p10_document_references(id) ON DELETE RESTRICT,
  decision VARCHAR(32) NOT NULL
    CHECK (decision IN ('ACCEPTED','REJECTED','NEEDS_RESUBMIT')),
  reviewer_id VARCHAR(255) NOT NULL,
  comments TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_edge_p10_document_reviews_doc
  ON edge_p10_document_reviews (document_reference_id, created_at DESC);

CREATE TABLE IF NOT EXISTS edge_p10_qualification_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES edge_p10_applications(id) ON DELETE RESTRICT,
  status VARCHAR(32) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN (
      'PENDING','IN_PROGRESS','APPROVED','REJECTED','CONDITIONAL','WITHDRAWN'
    )),
  outcome_summary TEXT,
  reviewer_id VARCHAR(255),
  approved_by VARCHAR(255),
  decided_at TIMESTAMPTZ,
  criteria JSONB NOT NULL DEFAULT '{}'::jsonb,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  CONSTRAINT uq_edge_p10_qualification_application UNIQUE (application_id)
);

CREATE TABLE IF NOT EXISTS edge_p10_review_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES edge_p10_applications(id) ON DELETE RESTRICT,
  assignee_id VARCHAR(255) NOT NULL,
  role_hint VARCHAR(64) NOT NULL DEFAULT 'REVIEWER'
    CHECK (role_hint IN ('REVIEWER','APPROVER','DOCUMENT_REVIEWER','QUALIFIER')),
  status VARCHAR(32) NOT NULL DEFAULT 'ASSIGNED'
    CHECK (status IN ('ASSIGNED','IN_PROGRESS','COMPLETED','REASSIGNED','CANCELLED')),
  assigned_by VARCHAR(255) NOT NULL,
  due_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_edge_p10_review_assignments_app
  ON edge_p10_review_assignments (application_id, status);
CREATE INDEX IF NOT EXISTS idx_edge_p10_review_assignments_assignee
  ON edge_p10_review_assignments (assignee_id, status);

-- ---------------------------------------------------------------------------
-- Quotes / checkout / handoff
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_p10_quote_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID REFERENCES edge_p10_applications(id) ON DELETE SET NULL,
  prospect_id UUID NOT NULL REFERENCES edge_p10_prospects(id) ON DELETE RESTRICT,
  commercial_plan_id UUID,
  plan_presentation_id UUID REFERENCES edge_p10_plan_presentations(id) ON DELETE SET NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'REQUESTED'
    CHECK (status IN (
      'REQUESTED','IN_PROGRESS','QUOTED','ACCEPTED','REJECTED','EXPIRED','CANCELLED'
    )),
  requested_by VARCHAR(255),
  notes TEXT,
  -- Never store invented price amounts as authoritative
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1)
);
CREATE INDEX IF NOT EXISTS idx_edge_p10_quote_requests_status
  ON edge_p10_quote_requests (status, updated_at DESC);

CREATE TABLE IF NOT EXISTS edge_p10_quote_references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_request_id UUID NOT NULL REFERENCES edge_p10_quote_requests(id) ON DELETE RESTRICT,
  external_quote_ref TEXT NOT NULL,
  commercial_source VARCHAR(64) NOT NULL DEFAULT 'P2_COMMERCIAL'
    CHECK (commercial_source IN ('P2_COMMERCIAL','SALES_MANUAL','PARTNER','OTHER')),
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE','SUPERSEDED','EXPIRED','VOID')),
  valid_until TIMESTAMPTZ,
  display_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_edge_p10_quote_references_ext UNIQUE (external_quote_ref)
);

CREATE TABLE IF NOT EXISTS edge_p10_checkout_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID REFERENCES edge_p10_applications(id) ON DELETE SET NULL,
  prospect_id UUID NOT NULL REFERENCES edge_p10_prospects(id) ON DELETE RESTRICT,
  plan_presentation_id UUID REFERENCES edge_p10_plan_presentations(id) ON DELETE SET NULL,
  commercial_plan_id UUID,
  quote_reference_id UUID REFERENCES edge_p10_quote_references(id) ON DELETE SET NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'CREATED'
    CHECK (status IN (
      'CREATED','AWAITING_PAYMENT','AUTHORIZED','CAPTURED','FAILED',
      'CANCELLED','EXPIRED','HANDOFF_READY','COMPLETED'
    )),
  billing_session_ref TEXT,
  idempotency_key VARCHAR(128) NOT NULL,
  -- Explicitly NO payment credential columns
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  CONSTRAINT uq_edge_p10_checkout_sessions_idem UNIQUE (idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_edge_p10_checkout_sessions_status
  ON edge_p10_checkout_sessions (status, updated_at DESC);

CREATE TABLE IF NOT EXISTS edge_p10_checkout_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checkout_session_id UUID NOT NULL REFERENCES edge_p10_checkout_sessions(id) ON DELETE RESTRICT,
  event_type VARCHAR(64) NOT NULL,
  from_status VARCHAR(32),
  to_status VARCHAR(32),
  external_ref TEXT,
  body JSONB NOT NULL DEFAULT '{}'::jsonb,
  actor_id VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_edge_p10_checkout_events_session
  ON edge_p10_checkout_events (checkout_session_id, created_at DESC);

CREATE TABLE IF NOT EXISTS edge_p10_subscription_handoffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checkout_session_id UUID REFERENCES edge_p10_checkout_sessions(id) ON DELETE SET NULL,
  application_id UUID REFERENCES edge_p10_applications(id) ON DELETE SET NULL,
  prospect_id UUID NOT NULL REFERENCES edge_p10_prospects(id) ON DELETE RESTRICT,
  commercial_account_id UUID,
  commercial_plan_id UUID,
  status VARCHAR(32) NOT NULL DEFAULT 'REQUESTED'
    CHECK (status IN (
      'REQUESTED','SUBMITTED','ACKNOWLEDGED','COMPLETED','FAILED','CANCELLED'
    )),
  subscription_ref TEXT,
  external_evidence_ref TEXT,
  failure_reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1)
);
CREATE INDEX IF NOT EXISTS idx_edge_p10_subscription_handoffs_status
  ON edge_p10_subscription_handoffs (status, updated_at DESC);

-- ---------------------------------------------------------------------------
-- Journeys / communications / analytics / audit / idempotency
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_p10_journey_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT','ACTIVE','DEPRECATED','ARCHIVED')),
  definition JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  CONSTRAINT uq_edge_p10_journey_definitions_code UNIQUE (code)
);

CREATE TABLE IF NOT EXISTS edge_p10_journey_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_definition_id UUID NOT NULL REFERENCES edge_p10_journey_definitions(id) ON DELETE RESTRICT,
  prospect_id UUID REFERENCES edge_p10_prospects(id) ON DELETE SET NULL,
  application_id UUID REFERENCES edge_p10_applications(id) ON DELETE SET NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE','PAUSED','COMPLETED','FAILED','CANCELLED')),
  current_step_key VARCHAR(128),
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1)
);
CREATE INDEX IF NOT EXISTS idx_edge_p10_journey_instances_status
  ON edge_p10_journey_instances (status, updated_at DESC);

CREATE TABLE IF NOT EXISTS edge_p10_journey_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_instance_id UUID NOT NULL REFERENCES edge_p10_journey_instances(id) ON DELETE RESTRICT,
  event_type VARCHAR(64) NOT NULL,
  step_key VARCHAR(128),
  body JSONB NOT NULL DEFAULT '{}'::jsonb,
  actor_id VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_edge_p10_journey_events_instance
  ON edge_p10_journey_events (journey_instance_id, created_at DESC);

CREATE TABLE IF NOT EXISTS edge_p10_communications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id UUID REFERENCES edge_p10_prospects(id) ON DELETE SET NULL,
  application_id UUID REFERENCES edge_p10_applications(id) ON DELETE SET NULL,
  journey_instance_id UUID REFERENCES edge_p10_journey_instances(id) ON DELETE SET NULL,
  channel VARCHAR(32) NOT NULL
    CHECK (channel IN ('EMAIL','SMS','WHATSAPP','IN_APP','WEBHOOK','OTHER')),
  template_ref TEXT,
  status VARCHAR(32) NOT NULL DEFAULT 'QUEUED'
    CHECK (status IN ('QUEUED','SENT','ACCEPTED','DELIVERED','FAILED','CANCELLED')),
  provider_ref TEXT,
  subject VARCHAR(255),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_edge_p10_communications_prospect
  ON edge_p10_communications (prospect_id, created_at DESC);

CREATE TABLE IF NOT EXISTS edge_p10_analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name VARCHAR(128) NOT NULL,
  prospect_id UUID,
  lead_id UUID,
  application_id UUID,
  session_key VARCHAR(128),
  properties JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_edge_p10_analytics_events_name
  ON edge_p10_analytics_events (event_name, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_edge_p10_analytics_events_prospect
  ON edge_p10_analytics_events (prospect_id, occurred_at DESC)
  WHERE prospect_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS edge_p10_attribution_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id UUID REFERENCES edge_p10_prospects(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES edge_p10_acquisition_leads(id) ON DELETE SET NULL,
  channel VARCHAR(64),
  campaign_ref TEXT,
  marketing_soft_ref UUID,
  utm JSONB NOT NULL DEFAULT '{}'::jsonb,
  first_touch_at TIMESTAMPTZ,
  last_touch_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_edge_p10_attribution_prospect
  ON edge_p10_attribution_records (prospect_id)
  WHERE prospect_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS edge_p10_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aggregate_type VARCHAR(64) NOT NULL,
  aggregate_id UUID NOT NULL,
  action VARCHAR(64) NOT NULL,
  actor_id VARCHAR(255),
  before_state JSONB,
  after_state JSONB,
  correlation_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_edge_p10_audit_aggregate
  ON edge_p10_audit_events (aggregate_type, aggregate_id, created_at DESC);

CREATE TABLE IF NOT EXISTS edge_p10_idempotency_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope VARCHAR(64) NOT NULL,
  idempotency_key VARCHAR(128) NOT NULL,
  request_hash VARCHAR(128),
  response_ref TEXT,
  status VARCHAR(32) NOT NULL DEFAULT 'STARTED'
    CHECK (status IN ('STARTED','COMPLETED','FAILED')),
  expires_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_edge_p10_idempotency_scope_key UNIQUE (scope, idempotency_key)
);

INSERT INTO schema_migrations (version)
VALUES ('117_edge_p10_acquisition_foundation')
ON CONFLICT DO NOTHING;
