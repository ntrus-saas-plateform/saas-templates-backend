-- Migration 076: P2 commercial governance extensions (additive on 075)
-- Buying committees, decision journeys, enterprise templates, usage metrics,
-- eligibility policies, market assessment dimensions. No invented commercial data.

CREATE TABLE IF NOT EXISTS edge_buying_committee_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  product_id UUID REFERENCES edge_products(id) ON DELETE SET NULL,
  vertical_id UUID REFERENCES edge_verticals(id) ON DELETE SET NULL,
  segment_id UUID REFERENCES edge_market_segments(id) ON DELETE SET NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
  roles JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_buying_committee_models_code_key UNIQUE (code)
);

CREATE TABLE IF NOT EXISTS edge_decision_journey_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  product_id UUID REFERENCES edge_products(id) ON DELETE SET NULL,
  vertical_id UUID REFERENCES edge_verticals(id) ON DELETE SET NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
  stages JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_decision_journey_models_code_key UNIQUE (code)
);

CREATE TABLE IF NOT EXISTS edge_enterprise_offer_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  product_id UUID NOT NULL REFERENCES edge_products(id) ON DELETE RESTRICT,
  vertical_id UUID NOT NULL REFERENCES edge_verticals(id) ON DELETE RESTRICT,
  solution_package_id UUID REFERENCES edge_solution_packages(id) ON DELETE SET NULL,
  base_plan_id UUID REFERENCES edge_commercial_plans(id) ON DELETE SET NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN (
      'DRAFT','CONFIGURING','REVIEW','APPROVED','PUBLISHED','SUSPENDED','DEPRECATED','RETIRED'
    )),
  version INT NOT NULL DEFAULT 1,
  deployment_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  support_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  sla_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  negotiable_terms JSONB NOT NULL DEFAULT '[]'::jsonb,
  non_negotiable_terms JSONB NOT NULL DEFAULT '[]'::jsonb,
  approval_level_required VARCHAR(64),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  CONSTRAINT edge_enterprise_offer_templates_code_key UNIQUE (code)
);

CREATE TABLE IF NOT EXISTS edge_usage_metric_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  pricing_unit_id UUID REFERENCES edge_pricing_units(id) ON DELETE SET NULL,
  source_event VARCHAR(128),
  aggregation_window VARCHAR(64),
  aggregation_method VARCHAR(64),
  deduplication_required BOOLEAN NOT NULL DEFAULT FALSE,
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
  version INT NOT NULL DEFAULT 1,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_usage_metric_definitions_code_key UNIQUE (code)
);

CREATE TABLE IF NOT EXISTS edge_eligibility_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  product_id UUID REFERENCES edge_products(id) ON DELETE CASCADE,
  offer_type VARCHAR(32) NOT NULL DEFAULT 'PLAN'
    CHECK (offer_type IN ('PLAN','PACKAGE','ADDON','ENTERPRISE_TEMPLATE','PRICE_BOOK')),
  offer_id UUID,
  rules JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
  version INT NOT NULL DEFAULT 1,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_eligibility_policies_code_key UNIQUE (code)
);

CREATE TABLE IF NOT EXISTS edge_market_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id UUID NOT NULL REFERENCES edge_commercial_markets(id) ON DELETE CASCADE,
  dimension VARCHAR(64) NOT NULL,
  value_text TEXT,
  value_numeric NUMERIC(19,6),
  unknown BOOLEAN NOT NULL DEFAULT TRUE,
  source_ref TEXT,
  confidence VARCHAR(32),
  validation_status VARCHAR(32) NOT NULL DEFAULT 'UNVALIDATED',
  assessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edge_market_assessments_market
  ON edge_market_assessments (market_id, dimension);

CREATE TABLE IF NOT EXISTS edge_segment_priority_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  weights JSONB NOT NULL DEFAULT '{}'::jsonb,
  version INT NOT NULL DEFAULT 1,
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_segment_priority_models_code_key UNIQUE (code)
);

INSERT INTO edge_segment_priority_models (code, name, weights, status)
VALUES (
  'DEFAULT_SEGMENT_PRIORITY',
  'Default segment priority weights',
  '{
    "marketAttractiveness":0.15,
    "strategicFit":0.15,
    "productReadiness":0.15,
    "competitiveIntensity":0.10,
    "acquisitionComplexity":0.10,
    "revenuePotential":0.10,
    "deliveryComplexity":0.05,
    "supportComplexity":0.05,
    "regulatoryRisk":0.10,
    "geographicAccessibility":0.05
  }'::jsonb,
  'ACTIVE'
)
ON CONFLICT (code) DO NOTHING;

INSERT INTO edge_permissions (code, description) VALUES
  ('platform:commercial:catalog:manage', 'Manage commercial catalog governance objects')
ON CONFLICT (code) DO NOTHING;

INSERT INTO edge_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM edge_roles r
CROSS JOIN edge_permissions p
WHERE r.code = 'EDGE_PLATFORM_SUPER_ADMIN'
  AND p.code = 'platform:commercial:catalog:manage'
ON CONFLICT DO NOTHING;

INSERT INTO edge_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM edge_roles r
INNER JOIN edge_permissions p ON p.code = 'platform:commercial:catalog:manage'
WHERE r.code = 'EDGE_PLATFORM_OPERATOR'
ON CONFLICT DO NOTHING;

INSERT INTO schema_migrations (version) VALUES ('076_edge_commercial_governance_extensions')
ON CONFLICT DO NOTHING;
