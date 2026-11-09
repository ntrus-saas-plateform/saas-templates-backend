-- Migration 075: Okapi Edge P2 Commercial foundation (Control Plane only)
-- Additive — does not rewrite 073/074. References P1 product/capability/segment FKs.
-- No invented seed prices or market sizes.

-- ---------------------------------------------------------------------------
-- Market intelligence
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_commercial_markets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  vertical_id UUID NOT NULL REFERENCES edge_verticals(id) ON DELETE RESTRICT,
  geographic_scope VARCHAR(128),
  market_status VARCHAR(32) NOT NULL DEFAULT 'DRAFT'
    CHECK (market_status IN (
      'DRAFT','RESEARCHING','ACTIVE','SUSPENDED','DEPRECATED','ARCHIVED'
    )),
  market_category VARCHAR(64),
  research_status VARCHAR(32) NOT NULL DEFAULT 'NEEDS_RESEARCH'
    CHECK (research_status IN (
      'NEEDS_RESEARCH','IN_PROGRESS','COMPLETE','STALE'
    )),
  owner_ref VARCHAR(255),
  effective_from TIMESTAMPTZ,
  effective_until TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  row_version INT NOT NULL DEFAULT 1,
  CONSTRAINT edge_commercial_markets_code_key UNIQUE (code)
);

CREATE INDEX IF NOT EXISTS idx_edge_commercial_markets_vertical
  ON edge_commercial_markets (vertical_id);
CREATE INDEX IF NOT EXISTS idx_edge_commercial_markets_status
  ON edge_commercial_markets (market_status);

CREATE TABLE IF NOT EXISTS edge_market_research_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id UUID NOT NULL REFERENCES edge_commercial_markets(id) ON DELETE CASCADE,
  code VARCHAR(64) NOT NULL,
  title VARCHAR(255) NOT NULL,
  research_question TEXT,
  hypothesis TEXT,
  methodology TEXT,
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT','IN_PROGRESS','COMPLETED','CANCELLED','ARCHIVED')),
  confidence_level VARCHAR(32),
  owner_ref VARCHAR(255),
  geographic_scope VARCHAR(128),
  findings TEXT,
  conclusions TEXT,
  limitations TEXT,
  completed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_market_research_projects_code_key UNIQUE (code)
);

CREATE TABLE IF NOT EXISTS edge_market_research_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES edge_market_research_projects(id) ON DELETE CASCADE,
  source_type VARCHAR(64) NOT NULL,
  title VARCHAR(255) NOT NULL,
  uri TEXT,
  publication_date DATE,
  collection_date DATE,
  reliability VARCHAR(32),
  confidence VARCHAR(32),
  validation_status VARCHAR(32) NOT NULL DEFAULT 'UNVALIDATED',
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS edge_segment_intelligence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  segment_id UUID NOT NULL REFERENCES edge_market_segments(id) ON DELETE CASCADE,
  commercial_description TEXT,
  lifecycle_status VARCHAR(32) NOT NULL DEFAULT 'DISCOVERY'
    CHECK (lifecycle_status IN (
      'DISCOVERY','RESEARCHING','EVALUATED','PRIORITIZED','TARGETED','DEPRIORITIZED','ARCHIVED'
    )),
  attractiveness_score NUMERIC(8,4),
  strategic_fit_score NUMERIC(8,4),
  product_readiness_score NUMERIC(8,4),
  overall_priority_score NUMERIC(8,4),
  scoring_model_version INT NOT NULL DEFAULT 1,
  research_confidence VARCHAR(32) NOT NULL DEFAULT 'NEEDS_RESEARCH',
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_segment_intelligence_segment_key UNIQUE (segment_id)
);

-- ---------------------------------------------------------------------------
-- ICP / personas / value props
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_icp_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  vertical_id UUID NOT NULL REFERENCES edge_verticals(id) ON DELETE RESTRICT,
  product_id UUID NOT NULL REFERENCES edge_products(id) ON DELETE RESTRICT,
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT','REVIEW','APPROVED','ACTIVE','DEPRECATED','ARCHIVED')),
  version INT NOT NULL DEFAULT 1,
  geographic_scope VARCHAR(128),
  attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
  scoring JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  CONSTRAINT edge_icp_definitions_code_key UNIQUE (code)
);

CREATE TABLE IF NOT EXISTS edge_icp_segment_links (
  icp_id UUID NOT NULL REFERENCES edge_icp_definitions(id) ON DELETE CASCADE,
  segment_id UUID NOT NULL REFERENCES edge_market_segments(id) ON DELETE CASCADE,
  PRIMARY KEY (icp_id, segment_id)
);

CREATE TABLE IF NOT EXISTS edge_persona_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role_label VARCHAR(128) NOT NULL,
  vertical_id UUID REFERENCES edge_verticals(id) ON DELETE SET NULL,
  product_id UUID REFERENCES edge_products(id) ON DELETE SET NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
  attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
  influence_level VARCHAR(32),
  decision_authority VARCHAR(32),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_persona_definitions_code_key UNIQUE (code)
);

CREATE TABLE IF NOT EXISTS edge_value_propositions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  product_id UUID NOT NULL REFERENCES edge_products(id) ON DELETE RESTRICT,
  vertical_id UUID NOT NULL REFERENCES edge_verticals(id) ON DELETE RESTRICT,
  segment_id UUID REFERENCES edge_market_segments(id) ON DELETE SET NULL,
  icp_id UUID REFERENCES edge_icp_definitions(id) ON DELETE SET NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
  target_audience TEXT,
  customer_problem TEXT,
  proposed_solution TEXT,
  expected_outcome TEXT,
  differentiation TEXT,
  positioning_statement TEXT,
  evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  limitations TEXT,
  validation_status VARCHAR(32) NOT NULL DEFAULT 'UNVALIDATED',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_value_propositions_code_key UNIQUE (code)
);

-- ---------------------------------------------------------------------------
-- Solution packages / plans / add-ons
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_solution_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  product_id UUID NOT NULL REFERENCES edge_products(id) ON DELETE RESTRICT,
  vertical_id UUID NOT NULL REFERENCES edge_verticals(id) ON DELETE RESTRICT,
  value_proposition_id UUID REFERENCES edge_value_propositions(id) ON DELETE SET NULL,
  package_type VARCHAR(64),
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN (
      'DRAFT','CONFIGURING','VALIDATING','APPROVED','PUBLISHED','DEPRECATED','RETIRED','ARCHIVED'
    )),
  version INT NOT NULL DEFAULT 1,
  effective_from TIMESTAMPTZ,
  effective_until TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  CONSTRAINT edge_solution_packages_code_key UNIQUE (code)
);

CREATE TABLE IF NOT EXISTS edge_solution_package_capabilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID NOT NULL REFERENCES edge_solution_packages(id) ON DELETE CASCADE,
  capability_id UUID NOT NULL REFERENCES edge_technical_capabilities(id) ON DELETE RESTRICT,
  inclusion_type VARCHAR(32) NOT NULL DEFAULT 'INCLUDED'
    CHECK (inclusion_type IN (
      'INCLUDED','OPTIONAL','ADD_ON_REQUIRED','NOT_INCLUDED','RESTRICTED','ENTERPRISE_NEGOTIATED'
    )),
  restrictions JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (package_id, capability_id)
);

CREATE TABLE IF NOT EXISTS edge_commercial_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  product_id UUID NOT NULL REFERENCES edge_products(id) ON DELETE RESTRICT,
  vertical_id UUID NOT NULL REFERENCES edge_verticals(id) ON DELETE RESTRICT,
  plan_tier VARCHAR(32) NOT NULL
    CHECK (plan_tier IN ('LITE','PROFESSIONAL','BUSINESS','ENTERPRISE','CUSTOM')),
  solution_package_id UUID REFERENCES edge_solution_packages(id) ON DELETE SET NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN (
      'DRAFT','CONFIGURING','REVIEW','APPROVED','PUBLISHED','SUSPENDED','DEPRECATED','RETIRED','ARCHIVED'
    )),
  version INT NOT NULL DEFAULT 1,
  availability_policy JSONB NOT NULL DEFAULT '{}'::jsonb,
  deployment_policy JSONB NOT NULL DEFAULT '{}'::jsonb,
  effective_from TIMESTAMPTZ,
  effective_until TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  CONSTRAINT edge_commercial_plans_code_key UNIQUE (code)
);

CREATE TABLE IF NOT EXISTS edge_commercial_plan_capabilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES edge_commercial_plans(id) ON DELETE CASCADE,
  capability_id UUID NOT NULL REFERENCES edge_technical_capabilities(id) ON DELETE RESTRICT,
  inclusion_type VARCHAR(32) NOT NULL DEFAULT 'INCLUDED'
    CHECK (inclusion_type IN (
      'INCLUDED','OPTIONAL','ADD_ON_REQUIRED','NOT_INCLUDED','RESTRICTED','ENTERPRISE_NEGOTIATED'
    )),
  restrictions JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (plan_id, capability_id)
);

CREATE TABLE IF NOT EXISTS edge_commercial_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  product_id UUID NOT NULL REFERENCES edge_products(id) ON DELETE RESTRICT,
  addon_type VARCHAR(64) NOT NULL DEFAULT 'CAPABILITY',
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN (
      'DRAFT','CONFIGURING','REVIEW','APPROVED','PUBLISHED','SUSPENDED','DEPRECATED','RETIRED'
    )),
  version INT NOT NULL DEFAULT 1,
  eligibility JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  CONSTRAINT edge_commercial_addons_code_key UNIQUE (code)
);

CREATE TABLE IF NOT EXISTS edge_commercial_addon_capabilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  addon_id UUID NOT NULL REFERENCES edge_commercial_addons(id) ON DELETE CASCADE,
  capability_id UUID NOT NULL REFERENCES edge_technical_capabilities(id) ON DELETE RESTRICT,
  inclusion_type VARCHAR(32) NOT NULL DEFAULT 'INCLUDED',
  UNIQUE (addon_id, capability_id)
);

CREATE TABLE IF NOT EXISTS edge_commercial_addon_plan_links (
  addon_id UUID NOT NULL REFERENCES edge_commercial_addons(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES edge_commercial_plans(id) ON DELETE CASCADE,
  compatibility VARCHAR(32) NOT NULL DEFAULT 'COMPATIBLE'
    CHECK (compatibility IN ('COMPATIBLE','REQUIRED','INCOMPATIBLE','OPTIONAL')),
  PRIMARY KEY (addon_id, plan_id)
);

-- ---------------------------------------------------------------------------
-- Pricing
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_pricing_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  unit_category VARCHAR(64),
  measurement_semantics TEXT,
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  version INT NOT NULL DEFAULT 1,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_pricing_units_code_key UNIQUE (code)
);

CREATE TABLE IF NOT EXISTS edge_pricing_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  model_type VARCHAR(64) NOT NULL
    CHECK (model_type IN (
      'FLAT_FEE','PER_USER','PER_LOCATION','PER_DEVICE','PER_BRANCH','PER_TRANSACTION',
      'USAGE_BASED','TIERED','VOLUME','HYBRID','ONE_TIME','RECURRING','CUSTOM_ENTERPRISE'
    )),
  product_id UUID NOT NULL REFERENCES edge_products(id) ON DELETE RESTRICT,
  pricing_unit_id UUID REFERENCES edge_pricing_units(id) ON DELETE SET NULL,
  components JSONB NOT NULL DEFAULT '{}'::jsonb,
  currency CHAR(3),
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
  version INT NOT NULL DEFAULT 1,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_pricing_models_code_key UNIQUE (code)
);

CREATE TABLE IF NOT EXISTS edge_price_books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  product_id UUID NOT NULL REFERENCES edge_products(id) ON DELETE RESTRICT,
  geographic_scope VARCHAR(128),
  currency CHAR(3) NOT NULL,
  market_segment_id UUID REFERENCES edge_market_segments(id) ON DELETE SET NULL,
  channel_scope VARCHAR(64),
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN (
      'DRAFT','REVIEW','APPROVED','PUBLISHED','SUPERSEDED','DEPRECATED','ARCHIVED'
    )),
  version INT NOT NULL DEFAULT 1,
  effective_from TIMESTAMPTZ,
  effective_until TIMESTAMPTZ,
  approval_reference TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  CONSTRAINT edge_price_books_code_key UNIQUE (code)
);

CREATE TABLE IF NOT EXISTS edge_price_book_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  price_book_id UUID NOT NULL REFERENCES edge_price_books(id) ON DELETE CASCADE,
  commercial_item_type VARCHAR(32) NOT NULL
    CHECK (commercial_item_type IN ('PLAN','ADDON','PACKAGE','SERVICE')),
  commercial_item_id UUID NOT NULL,
  pricing_model_id UUID REFERENCES edge_pricing_models(id) ON DELETE SET NULL,
  pricing_unit_id UUID REFERENCES edge_pricing_units(id) ON DELETE SET NULL,
  currency CHAR(3) NOT NULL,
  amount NUMERIC(19,6) NOT NULL,
  billing_frequency VARCHAR(32),
  conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
  effective_from TIMESTAMPTZ,
  effective_until TIMESTAMPTZ,
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_price_book_entries_amount_nonneg CHECK (amount >= 0)
);

CREATE INDEX IF NOT EXISTS idx_edge_price_book_entries_book
  ON edge_price_book_entries (price_book_id);

CREATE TABLE IF NOT EXISTS edge_discount_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  product_id UUID REFERENCES edge_products(id) ON DELETE SET NULL,
  discount_type VARCHAR(32) NOT NULL
    CHECK (discount_type IN (
      'PERCENTAGE','FIXED_AMOUNT','VOLUME','PROMOTIONAL','COMMITMENT','PARTNER','NEGOTIATED_ENTERPRISE'
    )),
  max_percentage NUMERIC(8,4),
  max_amount NUMERIC(19,6),
  approval_matrix JSONB NOT NULL DEFAULT '[]'::jsonb,
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
  version INT NOT NULL DEFAULT 1,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_discount_policies_code_key UNIQUE (code)
);

-- ---------------------------------------------------------------------------
-- Commercial readiness & publication
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_commercial_readiness_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  rules JSONB NOT NULL DEFAULT '{}'::jsonb,
  version INT NOT NULL DEFAULT 1,
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_commercial_readiness_profiles_code_key UNIQUE (code)
);

CREATE TABLE IF NOT EXISTS edge_commercial_readiness_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_type VARCHAR(32) NOT NULL
    CHECK (offer_type IN ('PLAN','PACKAGE','ADDON','PRICE_BOOK','ENTERPRISE_TEMPLATE')),
  offer_id UUID NOT NULL,
  product_id UUID NOT NULL REFERENCES edge_products(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES edge_commercial_readiness_profiles(id) ON DELETE SET NULL,
  result VARCHAR(32) NOT NULL
    CHECK (result IN ('NOT_READY','NEEDS_REVIEW','READY','BLOCKED')),
  checks JSONB NOT NULL DEFAULT '[]'::jsonb,
  blockers JSONB NOT NULL DEFAULT '[]'::jsonb,
  warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
  triggered_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edge_commercial_readiness_offer
  ON edge_commercial_readiness_evaluations (offer_type, offer_id, created_at DESC);

CREATE TABLE IF NOT EXISTS edge_commercial_publication_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_type VARCHAR(32) NOT NULL,
  offer_id UUID NOT NULL,
  product_id UUID NOT NULL REFERENCES edge_products(id) ON DELETE RESTRICT,
  snapshot JSONB NOT NULL,
  readiness_evaluation_id UUID REFERENCES edge_commercial_readiness_evaluations(id) ON DELETE SET NULL,
  published_by UUID,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approval_refs JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_edge_commercial_publication_offer
  ON edge_commercial_publication_snapshots (offer_type, offer_id, published_at DESC);

-- Default readiness profile (rules only — no fake commercial data)
INSERT INTO edge_commercial_readiness_profiles (code, name, rules, status)
VALUES (
  'DEFAULT_COMMERCIAL',
  'Default commercial readiness',
  '{"requireProductPublished":true,"requireCurrencyOnPriceBook":true,"forbidUnvalidatedCapabilities":true,"requirePlanTier":true}'::jsonb,
  'ACTIVE'
)
ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------------

INSERT INTO edge_permissions (code, description) VALUES
  ('platform:commercial:markets:read', 'Read commercial markets and research'),
  ('platform:commercial:markets:manage', 'Manage commercial markets and research'),
  ('platform:commercial:icp:manage', 'Manage ICP definitions'),
  ('platform:commercial:personas:manage', 'Manage personas'),
  ('platform:commercial:value_props:manage', 'Manage value propositions'),
  ('platform:commercial:packages:read', 'Read solution packages'),
  ('platform:commercial:packages:manage', 'Manage solution packages'),
  ('platform:commercial:plans:read', 'Read commercial plans'),
  ('platform:commercial:plans:manage', 'Manage commercial plans'),
  ('platform:commercial:plans:approve', 'Approve commercial plans'),
  ('platform:commercial:addons:manage', 'Manage commercial add-ons'),
  ('platform:commercial:catalog:read', 'Read commercial catalog'),
  ('platform:pricing:read', 'Read pricing models and price books'),
  ('platform:pricing:manage', 'Manage pricing models and price books'),
  ('platform:pricing:discounts:manage', 'Manage discount policies'),
  ('platform:commercial:readiness:evaluate', 'Evaluate commercial readiness'),
  ('platform:commercial:offers:publish', 'Publish commercial offers')
ON CONFLICT (code) DO NOTHING;

INSERT INTO edge_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM edge_roles r
CROSS JOIN edge_permissions p
WHERE r.code = 'EDGE_PLATFORM_SUPER_ADMIN'
  AND (
    p.code LIKE 'platform:commercial:%'
    OR p.code LIKE 'platform:pricing:%'
  )
ON CONFLICT DO NOTHING;

INSERT INTO edge_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM edge_roles r
INNER JOIN edge_permissions p ON p.code IN (
  'platform:commercial:markets:read',
  'platform:commercial:markets:manage',
  'platform:commercial:icp:manage',
  'platform:commercial:packages:read',
  'platform:commercial:packages:manage',
  'platform:commercial:plans:read',
  'platform:commercial:plans:manage',
  'platform:commercial:plans:approve',
  'platform:commercial:addons:manage',
  'platform:commercial:catalog:read',
  'platform:pricing:read',
  'platform:pricing:manage',
  'platform:commercial:readiness:evaluate',
  'platform:commercial:offers:publish'
)
WHERE r.code = 'EDGE_PLATFORM_OPERATOR'
ON CONFLICT DO NOTHING;

INSERT INTO edge_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM edge_roles r
INNER JOIN edge_permissions p ON p.code IN (
  'platform:commercial:markets:read',
  'platform:commercial:packages:read',
  'platform:commercial:plans:read',
  'platform:commercial:catalog:read',
  'platform:pricing:read',
  'platform:commercial:readiness:evaluate'
)
WHERE r.code IN ('VERTICAL_OWNER', 'VERTICAL_ADMIN')
ON CONFLICT DO NOTHING;

INSERT INTO schema_migrations (version) VALUES ('075_edge_commercial_foundation') ON CONFLICT DO NOTHING;
