-- Migration 074: Okapi Edge P1 Product Catalog foundation
-- Additive only — does not modify 073_edge_foundation.sql structure beyond vertical status CHECK expansion.

-- ---------------------------------------------------------------------------
-- Vertical lifecycle events + status CHECK expansion
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_vertical_lifecycle_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vertical_id UUID NOT NULL REFERENCES edge_verticals(id) ON DELETE CASCADE,
  from_status VARCHAR(32) NOT NULL,
  to_status VARCHAR(32) NOT NULL,
  reason TEXT,
  actor_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edge_vertical_lifecycle_events_vertical
  ON edge_vertical_lifecycle_events (vertical_id, created_at DESC);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'edge_verticals_status_check'
      AND conrelid = 'edge_verticals'::regclass
  ) THEN
    ALTER TABLE edge_verticals DROP CONSTRAINT edge_verticals_status_check;
  ELSIF EXISTS (
    SELECT 1
    FROM pg_constraint c
    WHERE c.conrelid = 'edge_verticals'::regclass
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%status%'
  ) THEN
    EXECUTE (
      SELECT format('ALTER TABLE edge_verticals DROP CONSTRAINT %I', c.conname)
      FROM pg_constraint c
      WHERE c.conrelid = 'edge_verticals'::regclass
        AND c.contype = 'c'
        AND pg_get_constraintdef(c.oid) ILIKE '%status%'
      LIMIT 1
    );
  END IF;
END $$;

ALTER TABLE edge_verticals
  ADD CONSTRAINT edge_verticals_status_check
  CHECK (status IN (
    'DRAFT',
    'CONFIGURING',
    'READY_FOR_ACTIVATION',
    'ACTIVE',
    'SUSPENDED',
    'DEACTIVATION_PENDING',
    'DEACTIVATED',
    'DEPRECATED',
    'RETIRED',
    'ARCHIVED'
  ));

-- ---------------------------------------------------------------------------
-- Products & versions
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(64) NOT NULL,
  slug VARCHAR(128) NOT NULL,
  name VARCHAR(255) NOT NULL,
  short_description TEXT,
  description TEXT,
  vertical_id UUID NOT NULL REFERENCES edge_verticals(id) ON DELETE RESTRICT,
  product_type VARCHAR(64),
  lifecycle_status VARCHAR(48) NOT NULL
    CHECK (lifecycle_status IN (
      'DRAFT',
      'CONFIGURING',
      'TECHNICAL_VALIDATION',
      'READY_FOR_PUBLICATION',
      'PUBLISHED',
      'DEPRECATED',
      'RETIRED',
      'ARCHIVED'
    )),
  technical_status VARCHAR(64),
  commercial_availability VARCHAR(48) NOT NULL DEFAULT 'UNAVAILABLE'
    CHECK (commercial_availability IN (
      'UNAVAILABLE',
      'INTERNAL_ONLY',
      'BETA',
      'CONTROLLED_ROLLOUT',
      'AVAILABLE',
      'DEPRECATED'
    )),
  default_version_id UUID,
  icon_ref TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  row_version INT NOT NULL DEFAULT 1,
  CONSTRAINT edge_products_code_key UNIQUE (code),
  CONSTRAINT edge_products_slug_key UNIQUE (slug)
);

CREATE TABLE IF NOT EXISTS edge_product_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES edge_products(id) ON DELETE CASCADE,
  version VARCHAR(64) NOT NULL,
  release_name VARCHAR(255),
  description TEXT,
  status VARCHAR(32) NOT NULL
    CHECK (status IN (
      'DRAFT',
      'CONFIGURING',
      'VALIDATION',
      'VALIDATED',
      'PUBLISHED',
      'DEPRECATED',
      'RETIRED',
      'ARCHIVED'
    )),
  release_type VARCHAR(32) NOT NULL
    CHECK (release_type IN ('MAJOR', 'MINOR', 'PATCH', 'HOTFIX', 'SECURITY', 'LTS')),
  api_compatibility VARCHAR(128),
  event_compatibility VARCHAR(128),
  minimum_backend_version VARCHAR(64),
  release_date TIMESTAMPTZ,
  effective_from TIMESTAMPTZ,
  deprecated_at TIMESTAMPTZ,
  retired_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  CONSTRAINT edge_product_versions_product_version_key UNIQUE (product_id, version)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'edge_products_default_version_id_fkey'
  ) THEN
    ALTER TABLE edge_products
      ADD CONSTRAINT edge_products_default_version_id_fkey
      FOREIGN KEY (default_version_id) REFERENCES edge_product_versions(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_edge_products_vertical
  ON edge_products (vertical_id);
CREATE INDEX IF NOT EXISTS idx_edge_products_lifecycle_status
  ON edge_products (lifecycle_status);
CREATE INDEX IF NOT EXISTS idx_edge_products_commercial_availability
  ON edge_products (commercial_availability);
CREATE INDEX IF NOT EXISTS idx_edge_product_versions_product
  ON edge_product_versions (product_id);
CREATE INDEX IF NOT EXISTS idx_edge_product_versions_status
  ON edge_product_versions (status);

-- ---------------------------------------------------------------------------
-- Market taxonomy
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_market_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  vertical_id UUID NOT NULL REFERENCES edge_verticals(id) ON DELETE CASCADE,
  parent_segment_id UUID REFERENCES edge_market_segments(id) ON DELETE SET NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  version INT NOT NULL DEFAULT 1,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_market_segments_code_key UNIQUE (code)
);

CREATE INDEX IF NOT EXISTS idx_edge_market_segments_vertical
  ON edge_market_segments (vertical_id);
CREATE INDEX IF NOT EXISTS idx_edge_market_segments_parent
  ON edge_market_segments (parent_segment_id);

CREATE TABLE IF NOT EXISTS edge_taxonomy_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
  effective_from TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID
);

CREATE INDEX IF NOT EXISTS idx_edge_taxonomy_versions_code
  ON edge_taxonomy_versions (code);
CREATE INDEX IF NOT EXISTS idx_edge_taxonomy_versions_status
  ON edge_taxonomy_versions (status);

CREATE TABLE IF NOT EXISTS edge_business_profile_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  vertical_id UUID NOT NULL REFERENCES edge_verticals(id) ON DELETE CASCADE,
  segment_id UUID REFERENCES edge_market_segments(id) ON DELETE SET NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  version INT NOT NULL DEFAULT 1,
  attributes_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_business_profile_templates_code_key UNIQUE (code)
);

CREATE INDEX IF NOT EXISTS idx_edge_business_profile_templates_vertical
  ON edge_business_profile_templates (vertical_id);

CREATE TABLE IF NOT EXISTS edge_operating_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  dimension VARCHAR(64),
  vertical_id UUID REFERENCES edge_verticals(id) ON DELETE SET NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  version INT NOT NULL DEFAULT 1,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_operating_models_code_key UNIQUE (code)
);

CREATE INDEX IF NOT EXISTS idx_edge_operating_models_vertical
  ON edge_operating_models (vertical_id);

CREATE TABLE IF NOT EXISTS edge_product_compatibilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES edge_products(id) ON DELETE CASCADE,
  product_version_id UUID REFERENCES edge_product_versions(id) ON DELETE CASCADE,
  target_type VARCHAR(32) NOT NULL
    CHECK (target_type IN ('SEGMENT', 'PROFILE', 'OPERATING_MODEL')),
  target_id UUID NOT NULL,
  status VARCHAR(48) NOT NULL
    CHECK (status IN (
      'NOT_ASSESSED',
      'COMPATIBLE',
      'COMPATIBLE_WITH_RESTRICTIONS',
      'INCOMPATIBLE',
      'UNDER_VALIDATION',
      'DEPRECATED'
    )),
  justification TEXT,
  restrictions JSONB NOT NULL DEFAULT '{}'::jsonb,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  validated_by UUID,
  validated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_product_compatibilities_unique
    UNIQUE (product_id, product_version_id, target_type, target_id)
);

CREATE INDEX IF NOT EXISTS idx_edge_product_compatibilities_product
  ON edge_product_compatibilities (product_id);

-- ---------------------------------------------------------------------------
-- Technical capabilities
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_technical_capabilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(64),
  technical_status VARCHAR(64),
  commercial_availability VARCHAR(64),
  owner_ref VARCHAR(255),
  version INT NOT NULL DEFAULT 1,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_technical_capabilities_code_key UNIQUE (code)
);

CREATE INDEX IF NOT EXISTS idx_edge_technical_capabilities_code
  ON edge_technical_capabilities (code);
CREATE INDEX IF NOT EXISTS idx_edge_technical_capabilities_category
  ON edge_technical_capabilities (category);

CREATE TABLE IF NOT EXISTS edge_capability_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  capability_id UUID NOT NULL REFERENCES edge_technical_capabilities(id) ON DELETE CASCADE,
  depends_on_capability_id UUID NOT NULL REFERENCES edge_technical_capabilities(id) ON DELETE CASCADE,
  dependency_kind VARCHAR(32) NOT NULL
    CHECK (dependency_kind IN ('REQUIRED', 'OPTIONAL', 'MUTUALLY_EXCLUSIVE')),
  min_version VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_capability_dependencies_unique
    UNIQUE (capability_id, depends_on_capability_id),
  CONSTRAINT edge_capability_dependencies_no_self
    CHECK (capability_id <> depends_on_capability_id)
);

CREATE INDEX IF NOT EXISTS idx_edge_capability_dependencies_capability
  ON edge_capability_dependencies (capability_id);
CREATE INDEX IF NOT EXISTS idx_edge_capability_dependencies_depends_on
  ON edge_capability_dependencies (depends_on_capability_id);

CREATE TABLE IF NOT EXISTS edge_capability_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  capability_id UUID NOT NULL REFERENCES edge_technical_capabilities(id) ON DELETE CASCADE,
  evidence_type VARCHAR(64) NOT NULL,
  reference TEXT,
  result VARCHAR(64),
  assessed_at TIMESTAMPTZ,
  assessed_by UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edge_capability_evidence_capability
  ON edge_capability_evidence (capability_id);

CREATE TABLE IF NOT EXISTS edge_product_capability_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES edge_products(id) ON DELETE CASCADE,
  product_version_id UUID REFERENCES edge_product_versions(id) ON DELETE CASCADE,
  capability_id UUID NOT NULL REFERENCES edge_technical_capabilities(id) ON DELETE CASCADE,
  classification VARCHAR(32) NOT NULL
    CHECK (classification IN (
      'REQUIRED',
      'OPTIONAL',
      'SUPPORTED',
      'NOT_SUPPORTED',
      'PLANNED',
      'DEPRECATED'
    )),
  technical_status VARCHAR(64),
  commercial_availability VARCHAR(64),
  restrictions JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_product_capability_mappings_unique
    UNIQUE (product_id, product_version_id, capability_id)
);

CREATE INDEX IF NOT EXISTS idx_edge_product_capability_mappings_product
  ON edge_product_capability_mappings (product_id);
CREATE INDEX IF NOT EXISTS idx_edge_product_capability_mappings_capability
  ON edge_product_capability_mappings (capability_id);

-- ---------------------------------------------------------------------------
-- Backends & contracts
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_business_backends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  backend_type VARCHAR(64),
  lifecycle_status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  deployment_modes JSONB NOT NULL DEFAULT '[]'::jsonb,
  supported_protocols JSONB NOT NULL DEFAULT '[]'::jsonb,
  supported_api_versions JSONB NOT NULL DEFAULT '[]'::jsonb,
  supported_event_versions JSONB NOT NULL DEFAULT '[]'::jsonb,
  security_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_business_backends_code_key UNIQUE (code)
);

CREATE INDEX IF NOT EXISTS idx_edge_business_backends_status
  ON edge_business_backends (lifecycle_status);

CREATE TABLE IF NOT EXISTS edge_product_backend_bindings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES edge_products(id) ON DELETE CASCADE,
  product_version_id UUID REFERENCES edge_product_versions(id) ON DELETE CASCADE,
  backend_id UUID NOT NULL REFERENCES edge_business_backends(id) ON DELETE CASCADE,
  binding_type VARCHAR(32) NOT NULL
    CHECK (binding_type IN ('PRIMARY', 'SUPPORTING', 'INTEGRATION', 'EXTERNAL')),
  deployment_mode VARCHAR(64),
  compatibility_status VARCHAR(64),
  effective_from TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edge_product_backend_bindings_product
  ON edge_product_backend_bindings (product_id);
CREATE INDEX IF NOT EXISTS idx_edge_product_backend_bindings_backend
  ON edge_product_backend_bindings (backend_id);

CREATE TABLE IF NOT EXISTS edge_integration_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  contract_type VARCHAR(64),
  version VARCHAR(64) NOT NULL,
  owner_ref VARCHAR(255),
  description TEXT,
  schema_ref TEXT,
  compatibility_policy VARCHAR(128),
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  effective_from TIMESTAMPTZ,
  deprecated_at TIMESTAMPTZ,
  documentation_ref TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_integration_contracts_code_key UNIQUE (code)
);

CREATE INDEX IF NOT EXISTS idx_edge_integration_contracts_status
  ON edge_integration_contracts (status);

-- ---------------------------------------------------------------------------
-- Readiness & publication
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_readiness_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  product_type VARCHAR(64),
  deployment_mode VARCHAR(64),
  release_type VARCHAR(32),
  rules JSONB NOT NULL DEFAULT '{}'::jsonb,
  version INT NOT NULL DEFAULT 1,
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_readiness_profiles_code_key UNIQUE (code)
);

CREATE TABLE IF NOT EXISTS edge_readiness_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES edge_products(id) ON DELETE CASCADE,
  product_version_id UUID NOT NULL REFERENCES edge_product_versions(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES edge_readiness_profiles(id) ON DELETE SET NULL,
  result VARCHAR(32) NOT NULL
    CHECK (result IN ('NOT_READY', 'NEEDS_REVIEW', 'READY', 'BLOCKED')),
  checks JSONB NOT NULL DEFAULT '[]'::jsonb,
  blockers JSONB NOT NULL DEFAULT '[]'::jsonb,
  warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
  triggered_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edge_readiness_evaluations_product
  ON edge_readiness_evaluations (product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_edge_readiness_evaluations_result
  ON edge_readiness_evaluations (result);

CREATE TABLE IF NOT EXISTS edge_publication_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES edge_products(id) ON DELETE CASCADE,
  product_version_id UUID NOT NULL REFERENCES edge_product_versions(id) ON DELETE CASCADE,
  snapshot JSONB NOT NULL,
  published_by UUID,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approval_refs JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_edge_publication_snapshots_product
  ON edge_publication_snapshots (product_id, published_at DESC);

-- ---------------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------------

INSERT INTO edge_permissions (code, description) VALUES
  ('platform:products:read', 'Read Edge products and versions'),
  ('platform:products:create', 'Create Edge products and versions'),
  ('platform:products:update', 'Update Edge products and draft versions'),
  ('platform:products:lifecycle', 'Transition Edge product lifecycle'),
  ('platform:products:publish', 'Publish Edge product versions'),
  ('platform:taxonomy:read', 'Read market segments and taxonomy'),
  ('platform:taxonomy:manage', 'Manage market segments and taxonomy'),
  ('platform:profiles:manage', 'Manage business profile templates'),
  ('platform:operating_models:manage', 'Manage operating models'),
  ('platform:capabilities:read', 'Read technical capabilities'),
  ('platform:capabilities:manage', 'Manage technical capabilities and mappings'),
  ('platform:backends:read', 'Read business backends'),
  ('platform:backends:manage', 'Manage business backends and bindings'),
  ('platform:contracts:manage', 'Manage integration contracts'),
  ('platform:readiness:evaluate', 'Evaluate product readiness'),
  ('platform:publication:approve', 'Approve and publish products')
ON CONFLICT (code) DO NOTHING;

-- SUPER ADMIN gets everything via existing cross-join pattern (new perms auto-linked)
INSERT INTO edge_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM edge_roles r
CROSS JOIN edge_permissions p
WHERE r.code = 'EDGE_PLATFORM_SUPER_ADMIN'
  AND p.code LIKE 'platform:%'
ON CONFLICT DO NOTHING;

-- PLATFORM OPERATOR: product ops + taxonomy/capabilities/backends read/manage subset
INSERT INTO edge_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM edge_roles r
INNER JOIN edge_permissions p ON p.code IN (
  'platform:products:read',
  'platform:products:create',
  'platform:products:update',
  'platform:products:lifecycle',
  'platform:products:publish',
  'platform:taxonomy:read',
  'platform:taxonomy:manage',
  'platform:profiles:manage',
  'platform:operating_models:manage',
  'platform:capabilities:read',
  'platform:capabilities:manage',
  'platform:backends:read',
  'platform:backends:manage',
  'platform:contracts:manage',
  'platform:readiness:evaluate',
  'platform:publication:approve'
)
WHERE r.code = 'EDGE_PLATFORM_OPERATOR'
ON CONFLICT DO NOTHING;

-- VERTICAL_OWNER: product read/update/lifecycle within vertical sense + taxonomy/profiles
INSERT INTO edge_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM edge_roles r
INNER JOIN edge_permissions p ON p.code IN (
  'platform:products:read',
  'platform:products:update',
  'platform:products:lifecycle',
  'platform:taxonomy:read',
  'platform:profiles:manage',
  'platform:operating_models:manage',
  'platform:capabilities:read',
  'platform:backends:read',
  'platform:readiness:evaluate'
)
WHERE r.code = 'VERTICAL_OWNER'
ON CONFLICT DO NOTHING;

-- VERTICAL_ADMIN: read products + taxonomy, update products
INSERT INTO edge_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM edge_roles r
INNER JOIN edge_permissions p ON p.code IN (
  'platform:products:read',
  'platform:products:update',
  'platform:taxonomy:read',
  'platform:capabilities:read',
  'platform:backends:read',
  'platform:readiness:evaluate'
)
WHERE r.code = 'VERTICAL_ADMIN'
ON CONFLICT DO NOTHING;

INSERT INTO schema_migrations (version) VALUES ('074_edge_product_catalog') ON CONFLICT DO NOTHING;
