-- Migration 101: P7.6 — Infrastructure & Database Provisioning
-- Durable resource plans, infrastructure/database/network/storage registry,
-- credentials (opaque refs only), backups, reconciliation, history.
-- Secrets NEVER stored in plaintext. Mutative ops go through P7.4 handlers.
-- Does NOT provision Keycloak (P7.7) or activate tenants (P7.8+).

-- ---------------------------------------------------------------------------
-- Provider catalog (capability declarations)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_p7_infrastructure_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(128) NOT NULL,
  name VARCHAR(255) NOT NULL,
  provider_version VARCHAR(64) NOT NULL,
  provider_kind VARCHAR(64) NOT NULL
    CHECK (provider_kind IN (
      'LOCAL_MANAGED','PRIVATE_CLOUD','PUBLIC_CLOUD','KUBERNETES','ON_PREM','DEDICATED'
    )),
  operational_status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE'
    CHECK (operational_status IN ('ACTIVE','DEGRADED','UNAVAILABLE','RETIRED')),
  capabilities JSONB NOT NULL DEFAULT '{}'::jsonb,
  supported_regions JSONB NOT NULL DEFAULT '[]'::jsonb,
  supported_resource_types JSONB NOT NULL DEFAULT '[]'::jsonb,
  supported_database_engines JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_p7_infra_providers_code_key UNIQUE (code)
);

CREATE INDEX IF NOT EXISTS idx_edge_p7_infra_providers_status
  ON edge_p7_infrastructure_providers (operational_status);

-- Seed the only provider with real adapters in this phase.
INSERT INTO edge_p7_infrastructure_providers (
  code, name, provider_version, provider_kind, operational_status,
  capabilities, supported_regions, supported_resource_types, supported_database_engines
) VALUES (
  'local-managed-v1',
  'Local Managed Infrastructure Provider',
  '1.0.0',
  'LOCAL_MANAGED',
  'ACTIVE',
  '{
    "encryption": true,
    "backup": true,
    "restore": true,
    "highAvailability": false,
    "privateNetworking": true,
    "tlsRequired": true,
    "operations": [
      "validate_plan","provision_network","provision_storage",
      "provision_database","configure_security","create_credentials",
      "verify_connectivity","verify_isolation","configure_backup",
      "verify_backup_policy","reconcile","deprovision"
    ]
  }'::jsonb,
  '["local","lab"]'::jsonb,
  '["NETWORK","STORAGE","DATABASE","COMPUTE"]'::jsonb,
  '["POSTGRESQL","MONGODB","SURREALDB"]'::jsonb
)
ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Resource plans (immutable versions)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_p7_resource_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  product_id UUID NOT NULL REFERENCES edge_products(id) ON DELETE RESTRICT,
  subscription_id UUID,
  authorization_id UUID,
  authorization_version INTEGER,
  placement_decision_id UUID,
  reservation_id UUID,
  provider_id UUID NOT NULL
    REFERENCES edge_p7_infrastructure_providers(id) ON DELETE RESTRICT,
  region VARCHAR(64) NOT NULL,
  availability_zone VARCHAR(64),
  deployment_profile_id UUID
    REFERENCES edge_p7_deployment_profiles(id) ON DELETE RESTRICT,
  deployment_profile_version INTEGER,
  runtime_profile_id UUID,
  database_engine VARCHAR(32) NOT NULL
    CHECK (database_engine IN ('POSTGRESQL','MONGODB','SURREALDB')),
  database_topology VARCHAR(64) NOT NULL DEFAULT 'DEDICATED_DATABASE'
    CHECK (database_topology IN (
      'DEDICATED_DATABASE','DEDICATED_SCHEMA','DEDICATED_CLUSTER'
    )),
  compute_requirements JSONB NOT NULL DEFAULT '{}'::jsonb,
  storage_requirements JSONB NOT NULL DEFAULT '{}'::jsonb,
  network_requirements JSONB NOT NULL DEFAULT '{}'::jsonb,
  backup_policy JSONB NOT NULL DEFAULT '{}'::jsonb,
  encryption_policy JSONB NOT NULL DEFAULT '{}'::jsonb,
  retention_policy JSONB NOT NULL DEFAULT '{}'::jsonb,
  estimated_capacity JSONB NOT NULL DEFAULT '{}'::jsonb,
  resource_dependencies JSONB NOT NULL DEFAULT '[]'::jsonb,
  security_classification VARCHAR(32) NOT NULL DEFAULT 'INTERNAL'
    CHECK (security_classification IN ('PUBLIC','INTERNAL','CONFIDENTIAL','RESTRICTED')),
  plan_fingerprint VARCHAR(128) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN (
      'DRAFT','VALIDATING','VALIDATED','REJECTED','COMMITTED','SUPERSEDED','CANCELLED'
    )),
  current_version INTEGER NOT NULL DEFAULT 1 CHECK (current_version >= 1),
  workflow_id UUID,
  validation_errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_by VARCHAR(255),
  updated_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_p7_resource_plans_fingerprint_key UNIQUE (plan_fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_edge_p7_resource_plans_tenant
  ON edge_p7_resource_plans (tenant_id, product_id, status);
CREATE INDEX IF NOT EXISTS idx_edge_p7_resource_plans_provider
  ON edge_p7_resource_plans (provider_id, status);
CREATE INDEX IF NOT EXISTS idx_edge_p7_resource_plans_reservation
  ON edge_p7_resource_plans (reservation_id)
  WHERE reservation_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS edge_p7_resource_plan_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL
    REFERENCES edge_p7_resource_plans(id) ON DELETE RESTRICT,
  version_number INTEGER NOT NULL CHECK (version_number >= 1),
  plan_fingerprint VARCHAR(128) NOT NULL,
  snapshot JSONB NOT NULL,
  validated_at TIMESTAMPTZ,
  validation_status VARCHAR(32) NOT NULL DEFAULT 'PENDING'
    CHECK (validation_status IN ('PENDING','VALID','INVALID')),
  created_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_p7_resource_plan_versions_uniq UNIQUE (plan_id, version_number)
);

-- ---------------------------------------------------------------------------
-- Infrastructure resources (generic)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_p7_infrastructure_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL
    REFERENCES edge_p7_resource_plans(id) ON DELETE RESTRICT,
  tenant_id UUID NOT NULL,
  product_id UUID NOT NULL REFERENCES edge_products(id) ON DELETE RESTRICT,
  subscription_id UUID,
  provider_id UUID NOT NULL
    REFERENCES edge_p7_infrastructure_providers(id) ON DELETE RESTRICT,
  resource_type VARCHAR(64) NOT NULL
    CHECK (resource_type IN (
      'NETWORK','SUBNET','SECURITY_GROUP','COMPUTE','STORAGE',
      'LOAD_BALANCER','DNS','PRIVATE_ENDPOINT','DATABASE','OTHER'
    )),
  provider_resource_id VARCHAR(512),
  environment VARCHAR(64) NOT NULL DEFAULT 'lab',
  region VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'PLANNED'
    CHECK (status IN (
      'PLANNED','VALIDATING','RESERVED','PROVISIONING','CONFIGURING','VERIFYING',
      'READY','DEGRADED','FAILED','UNKNOWN','RECONCILIATION_REQUIRED',
      'DEPROVISIONING','DEPROVISIONED','QUARANTINED'
    )),
  configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
  configuration_fingerprint VARCHAR(128),
  ownership JSONB NOT NULL DEFAULT '{}'::jsonb,
  deletion_protection BOOLEAN NOT NULL DEFAULT TRUE,
  health_status VARCHAR(32) NOT NULL DEFAULT 'UNKNOWN'
    CHECK (health_status IN ('HEALTHY','DEGRADED','UNAVAILABLE','UNKNOWN')),
  drift_status VARCHAR(32) NOT NULL DEFAULT 'NONE'
    CHECK (drift_status IN ('NONE','DETECTED','REMEDIATING','RESOLVED')),
  workflow_id UUID,
  last_reconciled_at TIMESTAMPTZ,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edge_p7_infra_resources_tenant
  ON edge_p7_infrastructure_resources (tenant_id, resource_type, status);
CREATE INDEX IF NOT EXISTS idx_edge_p7_infra_resources_plan
  ON edge_p7_infrastructure_resources (plan_id);
CREATE INDEX IF NOT EXISTS idx_edge_p7_infra_resources_status
  ON edge_p7_infrastructure_resources (status, updated_at DESC);

-- ---------------------------------------------------------------------------
-- Network / storage specialized rows
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_p7_network_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id UUID NOT NULL UNIQUE
    REFERENCES edge_p7_infrastructure_resources(id) ON DELETE RESTRICT,
  network_mode VARCHAR(64) NOT NULL DEFAULT 'PRIVATE'
    CHECK (network_mode IN ('PRIVATE','RESTRICTED','PUBLIC_EXPLICIT')),
  cidr_block VARCHAR(64),
  deny_by_default BOOLEAN NOT NULL DEFAULT TRUE,
  ingress_rules JSONB NOT NULL DEFAULT '[]'::jsonb,
  egress_rules JSONB NOT NULL DEFAULT '[]'::jsonb,
  dns_policy JSONB NOT NULL DEFAULT '{}'::jsonb,
  public_endpoint_allowed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS edge_p7_storage_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id UUID NOT NULL UNIQUE
    REFERENCES edge_p7_infrastructure_resources(id) ON DELETE RESTRICT,
  storage_class VARCHAR(64) NOT NULL DEFAULT 'STANDARD',
  size_gb INTEGER CHECK (size_gb IS NULL OR size_gb > 0),
  encrypted BOOLEAN NOT NULL DEFAULT TRUE,
  encryption_algorithm VARCHAR(64) NOT NULL DEFAULT 'AES-256',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Database resources
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_p7_database_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id UUID NOT NULL UNIQUE
    REFERENCES edge_p7_infrastructure_resources(id) ON DELETE RESTRICT,
  plan_id UUID NOT NULL
    REFERENCES edge_p7_resource_plans(id) ON DELETE RESTRICT,
  tenant_id UUID NOT NULL,
  product_id UUID NOT NULL REFERENCES edge_products(id) ON DELETE RESTRICT,
  subscription_id UUID,
  database_engine VARCHAR(32) NOT NULL
    CHECK (database_engine IN ('POSTGRESQL','MONGODB','SURREALDB')),
  engine_version VARCHAR(64),
  provider_id UUID NOT NULL
    REFERENCES edge_p7_infrastructure_providers(id) ON DELETE RESTRICT,
  cluster_id VARCHAR(255),
  database_name VARCHAR(255) NOT NULL,
  endpoint_ref VARCHAR(512),
  credential_ref VARCHAR(512),
  network_policy JSONB NOT NULL DEFAULT '{}'::jsonb,
  encryption_policy JSONB NOT NULL DEFAULT '{}'::jsonb,
  backup_policy JSONB NOT NULL DEFAULT '{}'::jsonb,
  restore_policy JSONB NOT NULL DEFAULT '{}'::jsonb,
  isolation_verified BOOLEAN NOT NULL DEFAULT FALSE,
  connectivity_verified BOOLEAN NOT NULL DEFAULT FALSE,
  least_privilege_verified BOOLEAN NOT NULL DEFAULT FALSE,
  tls_required BOOLEAN NOT NULL DEFAULT TRUE,
  public_endpoint BOOLEAN NOT NULL DEFAULT FALSE,
  status VARCHAR(32) NOT NULL DEFAULT 'PLANNED'
    CHECK (status IN (
      'PLANNED','VALIDATING','RESERVED','PROVISIONING','CONFIGURING','VERIFYING',
      'READY','DEGRADED','FAILED','UNKNOWN','RECONCILIATION_REQUIRED',
      'DEPROVISIONING','DEPROVISIONED','QUARANTINED'
    )),
  configuration_fingerprint VARCHAR(128),
  workflow_id UUID,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_p7_database_resources_tenant_engine_name_key
    UNIQUE (tenant_id, database_engine, database_name),
  CONSTRAINT edge_p7_database_no_public_default
    CHECK (public_endpoint = FALSE OR status IN ('FAILED','DEPROVISIONED','QUARANTINED'))
);

CREATE INDEX IF NOT EXISTS idx_edge_p7_db_resources_tenant
  ON edge_p7_database_resources (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_edge_p7_db_resources_engine
  ON edge_p7_database_resources (database_engine, status);
CREATE INDEX IF NOT EXISTS idx_edge_p7_db_resources_plan
  ON edge_p7_database_resources (plan_id);

-- ---------------------------------------------------------------------------
-- Provider allocations / dependencies / configurations
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_p7_provider_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL
    REFERENCES edge_p7_infrastructure_providers(id) ON DELETE RESTRICT,
  plan_id UUID NOT NULL
    REFERENCES edge_p7_resource_plans(id) ON DELETE RESTRICT,
  reservation_id UUID,
  allocation_ref VARCHAR(512) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'RESERVED'
    CHECK (status IN ('RESERVED','COMMITTED','RELEASED','FAILED')),
  capacity_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_p7_provider_allocations_ref_key UNIQUE (provider_id, allocation_ref)
);

CREATE TABLE IF NOT EXISTS edge_p7_resource_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id UUID NOT NULL
    REFERENCES edge_p7_infrastructure_resources(id) ON DELETE RESTRICT,
  depends_on_resource_id UUID NOT NULL
    REFERENCES edge_p7_infrastructure_resources(id) ON DELETE RESTRICT,
  dependency_type VARCHAR(64) NOT NULL DEFAULT 'REQUIRES'
    CHECK (dependency_type IN ('REQUIRES','SOFT','NETWORK','STORAGE','CREDENTIAL')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_p7_resource_deps_uniq UNIQUE (resource_id, depends_on_resource_id),
  CONSTRAINT edge_p7_resource_deps_no_self CHECK (resource_id <> depends_on_resource_id)
);

CREATE TABLE IF NOT EXISTS edge_p7_resource_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id UUID NOT NULL
    REFERENCES edge_p7_infrastructure_resources(id) ON DELETE RESTRICT,
  config_key VARCHAR(128) NOT NULL,
  config_value JSONB NOT NULL,
  fingerprint VARCHAR(128) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_p7_resource_configurations_uniq UNIQUE (resource_id, config_key)
);

-- Opaque credential references only — secret material lives in SecretsProvider.
CREATE TABLE IF NOT EXISTS edge_p7_resource_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id UUID NOT NULL
    REFERENCES edge_p7_infrastructure_resources(id) ON DELETE RESTRICT,
  database_resource_id UUID
    REFERENCES edge_p7_database_resources(id) ON DELETE RESTRICT,
  credential_ref VARCHAR(512) NOT NULL,
  credential_kind VARCHAR(64) NOT NULL DEFAULT 'DATABASE_APP'
    CHECK (credential_kind IN (
      'DATABASE_APP','DATABASE_ADMIN','PROVIDER','BACKUP','OTHER'
    )),
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE','ROTATING','REVOKED','EXPIRED')),
  expires_at TIMESTAMPTZ,
  rotated_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_p7_resource_credentials_ref_key UNIQUE (credential_ref)
);

CREATE INDEX IF NOT EXISTS idx_edge_p7_resource_credentials_status
  ON edge_p7_resource_credentials (status, resource_id);

-- ---------------------------------------------------------------------------
-- Backups / restore / health / reconciliation
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_p7_resource_backups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id UUID NOT NULL
    REFERENCES edge_p7_infrastructure_resources(id) ON DELETE RESTRICT,
  database_resource_id UUID
    REFERENCES edge_p7_database_resources(id) ON DELETE RESTRICT,
  provider_backup_id VARCHAR(512),
  backup_type VARCHAR(64) NOT NULL DEFAULT 'FULL'
    CHECK (backup_type IN ('FULL','INCREMENTAL','SNAPSHOT')),
  status VARCHAR(32) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN (
      'PENDING','RUNNING','SUCCEEDED','FAILED','VERIFIED','CORRUPT','EXPIRED'
    )),
  integrity_verified BOOLEAN NOT NULL DEFAULT FALSE,
  restorable_verified BOOLEAN NOT NULL DEFAULT FALSE,
  encrypted BOOLEAN NOT NULL DEFAULT TRUE,
  size_bytes BIGINT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edge_p7_resource_backups_resource
  ON edge_p7_resource_backups (resource_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS edge_p7_resource_restore_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id UUID NOT NULL
    REFERENCES edge_p7_infrastructure_resources(id) ON DELETE RESTRICT,
  backup_id UUID NOT NULL
    REFERENCES edge_p7_resource_backups(id) ON DELETE RESTRICT,
  status VARCHAR(32) NOT NULL DEFAULT 'REQUESTED'
    CHECK (status IN (
      'REQUESTED','AUTHORIZED','RUNNING','SUCCEEDED','FAILED','VERIFIED','CANCELLED'
    )),
  authorized_by VARCHAR(255),
  workflow_id UUID,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  verification JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS edge_p7_resource_health_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id UUID NOT NULL
    REFERENCES edge_p7_infrastructure_resources(id) ON DELETE RESTRICT,
  check_type VARCHAR(64) NOT NULL
    CHECK (check_type IN (
      'CONNECTIVITY','ISOLATION','TLS','BACKUP_POLICY','CONFIGURATION','CUSTOM'
    )),
  result VARCHAR(32) NOT NULL
    CHECK (result IN ('HEALTHY','DEGRADED','UNAVAILABLE','UNKNOWN','FAILED')),
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edge_p7_resource_health_resource
  ON edge_p7_resource_health_checks (resource_id, checked_at DESC);

CREATE TABLE IF NOT EXISTS edge_p7_resource_reconciliation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id UUID NOT NULL
    REFERENCES edge_p7_infrastructure_resources(id) ON DELETE RESTRICT,
  status VARCHAR(32) NOT NULL DEFAULT 'REQUIRED'
    CHECK (status IN (
      'REQUIRED','IN_PROGRESS','RECONCILED','DRIFT_DETECTED','ABANDONED'
    )),
  drift_classification VARCHAR(64),
  expected_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  observed_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  remediation_action VARCHAR(64)
    CHECK (remediation_action IS NULL OR remediation_action IN (
      'NONE','RECONCILE_STATE','QUARANTINE','MANUAL','RESTORE_CONFIG'
    )),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  actor_id VARCHAR(255),
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edge_p7_resource_recon_status
  ON edge_p7_resource_reconciliation (status, started_at DESC);

-- ---------------------------------------------------------------------------
-- History (immutable)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_p7_resource_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_type VARCHAR(64) NOT NULL
    CHECK (resource_type IN (
      'PLAN','INFRASTRUCTURE','DATABASE','NETWORK','STORAGE',
      'CREDENTIAL','BACKUP','RESTORE','RECONCILIATION','ALLOCATION'
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

CREATE INDEX IF NOT EXISTS idx_edge_p7_resource_history_resource
  ON edge_p7_resource_history (resource_type, resource_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Permissions (not auto-granted to all roles)
-- ---------------------------------------------------------------------------

INSERT INTO edge_permissions (code, description) VALUES
  ('platform:infrastructure:read', 'Read infrastructure providers and resources'),
  ('platform:infrastructure:manage', 'Manage resource plans and provider bindings'),
  ('platform:infrastructure:provision', 'Trigger infrastructure provisioning via workflow'),
  ('platform:infrastructure:reconcile', 'Reconcile infrastructure resource drift'),
  ('platform:infrastructure:deprovision', 'Deprovision infrastructure resources'),
  ('platform:infrastructure:history:read', 'Read infrastructure resource history'),
  ('platform:database:read', 'Read database resources'),
  ('platform:database:provision', 'Trigger database provisioning via workflow'),
  ('platform:database:configure', 'Configure database security and policies'),
  ('platform:database:verify', 'Verify connectivity and isolation'),
  ('platform:database:credentials:rotate', 'Rotate database credential references'),
  ('platform:database:backup', 'Create and manage database backups'),
  ('platform:database:restore', 'Authorize and execute database restores'),
  ('platform:resource:remediate', 'Apply audited remediations for drift')
ON CONFLICT (code) DO NOTHING;

INSERT INTO edge_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM edge_roles r
CROSS JOIN edge_permissions p
WHERE r.code = 'EDGE_PLATFORM_SUPER_ADMIN'
  AND (
    p.code LIKE 'platform:infrastructure:%'
    OR p.code LIKE 'platform:database:%'
    OR p.code = 'platform:resource:remediate'
  )
ON CONFLICT DO NOTHING;

INSERT INTO edge_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM edge_roles r
INNER JOIN edge_permissions p ON p.code IN (
  'platform:infrastructure:read',
  'platform:infrastructure:reconcile',
  'platform:infrastructure:history:read',
  'platform:database:read',
  'platform:database:verify',
  'platform:database:backup'
)
WHERE r.code = 'EDGE_PLATFORM_OPERATOR'
ON CONFLICT DO NOTHING;

INSERT INTO schema_migrations (version)
VALUES ('101_edge_p7_infrastructure_database_provisioning')
ON CONFLICT DO NOTHING;
