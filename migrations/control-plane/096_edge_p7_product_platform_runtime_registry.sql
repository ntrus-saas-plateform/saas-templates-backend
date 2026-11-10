-- Migration 096: P7.2 — Product, Platform & Runtime Registry
-- Technical registries for provisioning placement/control (no tenant/infra/Keycloak side effects).
-- References canonical P1 product IDs; does not duplicate commercial catalog truth.

-- ---------------------------------------------------------------------------
-- Product technical registry (extends P1 product with P7 provisioning metadata)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_p7_product_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES edge_products(id) ON DELETE RESTRICT,
  code VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  vertical_category VARCHAR(128),
  registry_status VARCHAR(32) NOT NULL DEFAULT 'DRAFT'
    CHECK (registry_status IN (
      'DRAFT','VALIDATING','CERTIFIED','SUSPENDED','DEPRECATED','RETIRED'
    )),
  certification_status VARCHAR(32) NOT NULL DEFAULT 'UNCERTIFIED'
    CHECK (certification_status IN (
      'UNCERTIFIED','PENDING','CERTIFIED','REVOKED'
    )),
  provisionable BOOLEAN NOT NULL DEFAULT FALSE,
  technical_constraints JSONB NOT NULL DEFAULT '{}'::jsonb,
  declared_capabilities JSONB NOT NULL DEFAULT '[]'::jsonb,
  compatible_platform_ids UUID[] NOT NULL DEFAULT '{}',
  compatible_environment_ids UUID[] NOT NULL DEFAULT '{}',
  compatible_profile_ids UUID[] NOT NULL DEFAULT '{}',
  compatible_contract_ids UUID[] NOT NULL DEFAULT '{}',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_by VARCHAR(255),
  updated_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_p7_product_registry_product_key UNIQUE (product_id),
  CONSTRAINT edge_p7_product_registry_code_key UNIQUE (code),
  CONSTRAINT edge_p7_product_registry_provisionable_chk CHECK (
    provisionable = FALSE OR (
      registry_status = 'CERTIFIED' AND certification_status = 'CERTIFIED'
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_edge_p7_product_registry_status
  ON edge_p7_product_registry (registry_status, certification_status);
CREATE INDEX IF NOT EXISTS idx_edge_p7_product_registry_provisionable
  ON edge_p7_product_registry (provisionable) WHERE provisionable = TRUE;

-- Technical versions of a registered product
CREATE TABLE IF NOT EXISTS edge_p7_product_technical_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_registry_id UUID NOT NULL REFERENCES edge_p7_product_registry(id) ON DELETE CASCADE,
  technical_version VARCHAR(64) NOT NULL,
  release_channel VARCHAR(32) NOT NULL DEFAULT 'STABLE'
    CHECK (release_channel IN ('DEV','BETA','STABLE','LTS','HOTFIX')),
  version_status VARCHAR(32) NOT NULL DEFAULT 'DRAFT'
    CHECK (version_status IN (
      'DRAFT','VALIDATING','PUBLISHED','DEPRECATED','RETIRED'
    )),
  compatible_contract_versions JSONB NOT NULL DEFAULT '[]'::jsonb,
  compatible_profile_codes JSONB NOT NULL DEFAULT '[]'::jsonb,
  compatible_runtime_types JSONB NOT NULL DEFAULT '[]'::jsonb,
  schema_compatibility JSONB NOT NULL DEFAULT '{}'::jsonb,
  api_compatibility JSONB NOT NULL DEFAULT '{}'::jsonb,
  available_from TIMESTAMPTZ,
  support_ends_at TIMESTAMPTZ,
  certification_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  change_summary TEXT,
  immutable_after_publish BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by VARCHAR(255),
  updated_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_p7_product_tech_version_key
    UNIQUE (product_registry_id, technical_version)
);

CREATE INDEX IF NOT EXISTS idx_edge_p7_product_tech_versions_status
  ON edge_p7_product_technical_versions (version_status);

-- ---------------------------------------------------------------------------
-- Product Platforms
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_p7_product_platforms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  platform_type VARCHAR(48) NOT NULL
    CHECK (platform_type IN (
      'SHARED_SAAS_PLATFORM','DEDICATED_PLATFORM','PRIVATE_PLATFORM','ON_PREMISE_PLATFORM'
    )),
  business_backend_id UUID REFERENCES edge_business_backends(id) ON DELETE RESTRICT,
  allowed_product_ids UUID[] NOT NULL DEFAULT '{}',
  supported_environment_types JSONB NOT NULL DEFAULT '[]'::jsonb,
  supported_profile_codes JSONB NOT NULL DEFAULT '[]'::jsonb,
  connectivity_reference VARCHAR(512),
  -- secrets stored as reference handles only — never plaintext credentials
  secure_config_ref VARCHAR(512),
  integration_protocol_version VARCHAR(64),
  control_contract_version VARCHAR(64),
  certification_status VARCHAR(32) NOT NULL DEFAULT 'UNCERTIFIED'
    CHECK (certification_status IN (
      'UNCERTIFIED','PENDING','CERTIFIED','REVOKED'
    )),
  operational_status VARCHAR(32) NOT NULL DEFAULT 'DRAFT'
    CHECK (operational_status IN (
      'DRAFT','VALIDATING','ACTIVE','SUSPENDED','DEPRECATED','RETIRED'
    )),
  declared_capabilities JSONB NOT NULL DEFAULT '[]'::jsonb,
  constraints JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_by VARCHAR(255),
  updated_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_p7_product_platforms_code_key UNIQUE (code)
);

CREATE INDEX IF NOT EXISTS idx_edge_p7_platforms_status
  ON edge_p7_product_platforms (operational_status, certification_status);

-- ---------------------------------------------------------------------------
-- Runtime Environments
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_p7_runtime_environments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_id UUID NOT NULL REFERENCES edge_p7_product_platforms(id) ON DELETE RESTRICT,
  code VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  environment_type VARCHAR(32) NOT NULL
    CHECK (environment_type IN ('DEVELOPMENT','TEST','STAGING','PRODUCTION')),
  region VARCHAR(64),
  geo_zone VARCHAR(64),
  security_classification VARCHAR(64),
  data_classification VARCHAR(64),
  available_capabilities JSONB NOT NULL DEFAULT '[]'::jsonb,
  data_residency_constraints JSONB NOT NULL DEFAULT '{}'::jsonb,
  backup_policy JSONB NOT NULL DEFAULT '{}'::jsonb,
  availability_policy JSONB NOT NULL DEFAULT '{}'::jsonb,
  allowed_profile_codes JSONB NOT NULL DEFAULT '[]'::jsonb,
  environment_status VARCHAR(32) NOT NULL DEFAULT 'DRAFT'
    CHECK (environment_status IN (
      'DRAFT','VALIDATING','ACTIVE','SUSPENDED','DEPRECATED','RETIRED'
    )),
  governance_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_by VARCHAR(255),
  updated_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_p7_runtime_env_platform_code_key UNIQUE (platform_id, code)
);

CREATE INDEX IF NOT EXISTS idx_edge_p7_runtime_env_type_status
  ON edge_p7_runtime_environments (environment_type, environment_status);

-- ---------------------------------------------------------------------------
-- Deployment Profiles (structured, not scattered conditionals)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_p7_deployment_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(64) NOT NULL
    CHECK (code IN (
      'SHARED_SAAS','DEDICATED_DATA','DEDICATED_RUNTIME','PRIVATE_CLOUD','ON_PREMISE'
    )),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  technical_requirements JSONB NOT NULL DEFAULT '{}'::jsonb,
  security_requirements JSONB NOT NULL DEFAULT '{}'::jsonb,
  isolation_model VARCHAR(128) NOT NULL,
  connectivity_model VARCHAR(128) NOT NULL,
  network_constraints JSONB NOT NULL DEFAULT '{}'::jsonb,
  data_residency_constraints JSONB NOT NULL DEFAULT '{}'::jsonb,
  backup_requirements JSONB NOT NULL DEFAULT '{}'::jsonb,
  availability_requirements JSONB NOT NULL DEFAULT '{}'::jsonb,
  disaster_recovery_requirements JSONB NOT NULL DEFAULT '{}'::jsonb,
  compatible_product_ids UUID[] NOT NULL DEFAULT '{}',
  compatible_platform_types JSONB NOT NULL DEFAULT '[]'::jsonb,
  compatible_environment_types JSONB NOT NULL DEFAULT '[]'::jsonb,
  certification_status VARCHAR(32) NOT NULL DEFAULT 'UNCERTIFIED'
    CHECK (certification_status IN (
      'UNCERTIFIED','PENDING','CERTIFIED','REVOKED'
    )),
  profile_status VARCHAR(32) NOT NULL DEFAULT 'DRAFT'
    CHECK (profile_status IN (
      'DRAFT','VALIDATING','ACTIVE','SUSPENDED','DEPRECATED','RETIRED'
    )),
  profile_version INTEGER NOT NULL DEFAULT 1 CHECK (profile_version >= 1),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by VARCHAR(255),
  updated_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_p7_deployment_profiles_code_key UNIQUE (code)
);

-- ---------------------------------------------------------------------------
-- Product Control Contracts (immutable after publish)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_p7_product_control_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES edge_products(id) ON DELETE RESTRICT,
  platform_id UUID NOT NULL REFERENCES edge_p7_product_platforms(id) ON DELETE RESTRICT,
  contract_code VARCHAR(128) NOT NULL,
  contract_version VARCHAR(64) NOT NULL,
  schema_version VARCHAR(64) NOT NULL,
  supported_capabilities JSONB NOT NULL DEFAULT '[]'::jsonb,
  supported_control_operations JSONB NOT NULL DEFAULT '[]'::jsonb,
  connectivity_model VARCHAR(128) NOT NULL,
  s2s_auth_policy JSONB NOT NULL DEFAULT '{}'::jsonb,
  signature_requirements JSONB NOT NULL DEFAULT '{}'::jsonb,
  published_events JSONB NOT NULL DEFAULT '[]'::jsonb,
  consumed_events JSONB NOT NULL DEFAULT '[]'::jsonb,
  backward_compatible BOOLEAN NOT NULL DEFAULT TRUE,
  forward_compatible BOOLEAN NOT NULL DEFAULT FALSE,
  versioning_policy JSONB NOT NULL DEFAULT '{}'::jsonb,
  effective_from TIMESTAMPTZ,
  deprecated_at TIMESTAMPTZ,
  contract_status VARCHAR(32) NOT NULL DEFAULT 'DRAFT'
    CHECK (contract_status IN (
      'DRAFT','VALIDATING','CERTIFIED','PUBLISHED','DEPRECATED','RETIRED'
    )),
  certification_evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  immutable BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by VARCHAR(255),
  updated_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_p7_control_contract_version_key
    UNIQUE (contract_code, contract_version),
  CONSTRAINT edge_p7_control_contract_immutable_chk CHECK (
    immutable = FALSE OR contract_status IN ('PUBLISHED','DEPRECATED','RETIRED')
  )
);

CREATE INDEX IF NOT EXISTS idx_edge_p7_control_contracts_status
  ON edge_p7_product_control_contracts (contract_status);
CREATE INDEX IF NOT EXISTS idx_edge_p7_control_contracts_product_platform
  ON edge_p7_product_control_contracts (product_id, platform_id);

-- ---------------------------------------------------------------------------
-- Compatibility evaluations (deterministic audit trail)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_p7_compatibility_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  correlation_id UUID NOT NULL,
  product_registry_id UUID REFERENCES edge_p7_product_registry(id) ON DELETE SET NULL,
  technical_version_id UUID REFERENCES edge_p7_product_technical_versions(id) ON DELETE SET NULL,
  platform_id UUID REFERENCES edge_p7_product_platforms(id) ON DELETE SET NULL,
  environment_id UUID REFERENCES edge_p7_runtime_environments(id) ON DELETE SET NULL,
  profile_id UUID REFERENCES edge_p7_deployment_profiles(id) ON DELETE SET NULL,
  contract_id UUID REFERENCES edge_p7_product_control_contracts(id) ON DELETE SET NULL,
  result VARCHAR(32) NOT NULL
    CHECK (result IN ('COMPATIBLE','INCOMPATIBLE','REQUIRES_REVIEW')),
  rules_applied JSONB NOT NULL DEFAULT '[]'::jsonb,
  reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  examined_refs JSONB NOT NULL DEFAULT '{}'::jsonb,
  evaluated_by VARCHAR(255),
  evaluated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edge_p7_compat_eval_corr
  ON edge_p7_compatibility_evaluations (correlation_id);
CREATE INDEX IF NOT EXISTS idx_edge_p7_compat_eval_result
  ON edge_p7_compatibility_evaluations (result, evaluated_at DESC);

-- ---------------------------------------------------------------------------
-- Unified registry history
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_p7_registry_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_type VARCHAR(64) NOT NULL
    CHECK (resource_type IN (
      'PRODUCT_REGISTRY','PRODUCT_TECHNICAL_VERSION','PRODUCT_PLATFORM',
      'RUNTIME_ENVIRONMENT','DEPLOYMENT_PROFILE','PRODUCT_CONTROL_CONTRACT',
      'COMPATIBILITY_EVALUATION'
    )),
  resource_id UUID NOT NULL,
  from_status VARCHAR(64),
  to_status VARCHAR(64),
  action VARCHAR(64) NOT NULL,
  reason TEXT,
  actor_id VARCHAR(255) NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edge_p7_registry_history_resource
  ON edge_p7_registry_history (resource_type, resource_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Seed canonical deployment profiles (extensible; not hard-coded in services)
-- ---------------------------------------------------------------------------

INSERT INTO edge_p7_deployment_profiles (
  code, name, description, isolation_model, connectivity_model,
  certification_status, profile_status, created_by
) VALUES
  ('SHARED_SAAS', 'Shared SaaS', 'Multi-tenant shared runtime and data plane',
   'LOGICAL_TENANT_ISOLATION', 'EDGE_TO_SHARED_BACKEND', 'CERTIFIED', 'ACTIVE', 'system'),
  ('DEDICATED_DATA', 'Dedicated Data', 'Shared runtime with dedicated data store',
   'DEDICATED_DATA_PLANE', 'EDGE_TO_SHARED_BACKEND', 'CERTIFIED', 'ACTIVE', 'system'),
  ('DEDICATED_RUNTIME', 'Dedicated Runtime', 'Dedicated runtime and data for a customer',
   'DEDICATED_RUNTIME_AND_DATA', 'EDGE_TO_DEDICATED_BACKEND', 'CERTIFIED', 'ACTIVE', 'system'),
  ('PRIVATE_CLOUD', 'Private Cloud', 'Customer private cloud hosting',
   'CUSTOMER_PRIVATE_CLOUD', 'EDGE_TO_PRIVATE_ENDPOINT', 'UNCERTIFIED', 'DRAFT', 'system'),
  ('ON_PREMISE', 'On Premise', 'Customer on-premise deployment',
   'CUSTOMER_ON_PREMISE', 'EDGE_TO_ONPREM_CONNECTOR', 'UNCERTIFIED', 'DRAFT', 'system')
ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------------

INSERT INTO edge_permissions (code, description) VALUES
  ('platform:product_registry:read', 'Read P7.2 product technical registry'),
  ('platform:product_registry:manage', 'Create/update product registry entries'),
  ('platform:product_registry:certify', 'Certify/suspend/deprecate product registry'),
  ('platform:product_platforms:read', 'Read product platforms'),
  ('platform:product_platforms:manage', 'Manage product platforms'),
  ('platform:runtime_environments:read', 'Read runtime environments'),
  ('platform:runtime_environments:manage', 'Manage runtime environments'),
  ('platform:deployment_profiles:read', 'Read deployment profiles'),
  ('platform:deployment_profiles:manage', 'Manage deployment profiles'),
  ('platform:product_control_contracts:read', 'Read product control contracts'),
  ('platform:product_control_contracts:manage', 'Manage product control contracts'),
  ('platform:product_control_contracts:certify', 'Certify/publish control contracts'),
  ('platform:registry_compatibility:evaluate', 'Evaluate registry compatibility'),
  ('platform:registry_history:read', 'Read P7.2 registry audit history')
ON CONFLICT (code) DO NOTHING;

INSERT INTO edge_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM edge_roles r
CROSS JOIN edge_permissions p
WHERE r.code = 'EDGE_PLATFORM_SUPER_ADMIN'
  AND (
    p.code LIKE 'platform:product_registry:%'
    OR p.code LIKE 'platform:product_platforms:%'
    OR p.code LIKE 'platform:runtime_environments:%'
    OR p.code LIKE 'platform:deployment_profiles:%'
    OR p.code LIKE 'platform:product_control_contracts:%'
    OR p.code LIKE 'platform:registry_%'
  )
ON CONFLICT DO NOTHING;

INSERT INTO edge_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM edge_roles r
INNER JOIN edge_permissions p ON p.code IN (
  'platform:product_registry:read',
  'platform:product_platforms:read',
  'platform:runtime_environments:read',
  'platform:deployment_profiles:read',
  'platform:product_control_contracts:read',
  'platform:registry_compatibility:evaluate',
  'platform:registry_history:read',
  'platform:product_registry:manage',
  'platform:product_platforms:manage',
  'platform:runtime_environments:manage',
  'platform:deployment_profiles:manage',
  'platform:product_control_contracts:manage'
)
WHERE r.code = 'EDGE_PLATFORM_OPERATOR'
ON CONFLICT DO NOTHING;

INSERT INTO schema_migrations (version) VALUES ('096_edge_p7_product_platform_runtime_registry')
ON CONFLICT DO NOTHING;
