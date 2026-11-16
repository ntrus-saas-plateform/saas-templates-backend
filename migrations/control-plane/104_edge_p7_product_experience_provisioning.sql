-- Migration 104: P7.9 — Product Experience Provisioning
-- Application/experience registry, tenant assignments, technical OIDC clients,
-- domain/TLS binding and deployment evidence.
-- Does NOT manage business IAM users, roles, memberships or organizations.
-- Mutative ops go through P7.4 with P7.1 authorization. Secrets = vault refs only.

INSERT INTO edge_permissions (code, description) VALUES
  ('platform:experience:read', 'Read product experience profiles, apps, domains and assignments'),
  ('platform:experience:manage', 'Manage experience profiles, applications and versions'),
  ('platform:experience:deploy', 'Deploy tenant product experience via workflow'),
  ('platform:experience:domains', 'Manage tenant domain bindings and TLS'),
  ('platform:experience:history:read', 'Read experience deployment history and evidence')
ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Experience profiles (product-scoped experience blueprints)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_p7_experience_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(128) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  product_id UUID,
  profile_status VARCHAR(32) NOT NULL DEFAULT 'DRAFT'
    CHECK (profile_status IN ('DRAFT','VALIDATED','PUBLISHED','DEPRECATED','RETIRED')),
  compatible_runtime_codes JSONB NOT NULL DEFAULT '[]'::jsonb,
  compatible_deployment_profile_codes JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by VARCHAR(255) NOT NULL,
  updated_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  CONSTRAINT edge_p7_experience_profiles_code UNIQUE (code)
);

CREATE INDEX IF NOT EXISTS idx_edge_p7_experience_profiles_status
  ON edge_p7_experience_profiles (profile_status, product_id);

-- ---------------------------------------------------------------------------
-- Applications + immutable versions
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_p7_experience_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(128) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  product_id UUID,
  application_kind VARCHAR(64) NOT NULL
    CHECK (application_kind IN (
      'WEB','MOBILE','DESKTOP','POS','OPERATIONS','CUSTOMER','KIOSK','DISPLAY','DEVICE','OTHER'
    )),
  experience_profile_id UUID
    REFERENCES edge_p7_experience_profiles(id) ON DELETE SET NULL,
  application_status VARCHAR(32) NOT NULL DEFAULT 'DRAFT'
    CHECK (application_status IN ('DRAFT','VALIDATED','PUBLISHED','DEPRECATED','RETIRED')),
  latest_version INTEGER NOT NULL DEFAULT 0 CHECK (latest_version >= 0),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by VARCHAR(255) NOT NULL,
  updated_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  CONSTRAINT edge_p7_experience_applications_code UNIQUE (code)
);

CREATE TABLE IF NOT EXISTS edge_p7_experience_application_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL
    REFERENCES edge_p7_experience_applications(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL CHECK (version_number >= 1),
  product_version VARCHAR(64),
  runtime_version VARCHAR(64),
  api_compatibility_version VARCHAR(64),
  deployment_profile_code VARCHAR(128),
  configuration_bundle_code VARCHAR(128),
  entitlement_snapshot_version VARCHAR(64),
  manifest JSONB NOT NULL DEFAULT '{}'::jsonb,
  checksum CHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT','VALIDATED','PUBLISHED','SUPERSEDED')),
  published_at TIMESTAMPTZ,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_p7_experience_app_versions_uniq UNIQUE (application_id, version_number)
);

-- ---------------------------------------------------------------------------
-- Tenant experience assignments
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_p7_tenant_experience_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  product_id UUID NOT NULL,
  subscription_id UUID,
  account_id UUID,
  experience_profile_id UUID
    REFERENCES edge_p7_experience_profiles(id) ON DELETE RESTRICT,
  assignment_status VARCHAR(32) NOT NULL DEFAULT 'ASSIGNED'
    CHECK (assignment_status IN (
      'ASSIGNED','PROVISIONING','READY','FAILED','DEACTIVATING','DEACTIVATED','SUPERSEDED'
    )),
  authorization_row_id UUID,
  authorization_version INTEGER,
  provisioning_request_id UUID,
  workflow_id UUID,
  desired_manifest JSONB NOT NULL DEFAULT '{}'::jsonb,
  applied_manifest JSONB NOT NULL DEFAULT '{}'::jsonb,
  applied_checksum CHAR(64),
  drift_status VARCHAR(32) NOT NULL DEFAULT 'NONE'
    CHECK (drift_status IN ('NONE','DETECTED','REMEDIATING','RESOLVED','UNKNOWN')),
  last_deployed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by VARCHAR(255) NOT NULL,
  updated_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_edge_p7_tenant_experience_active
  ON edge_p7_tenant_experience_assignments (tenant_id, product_id)
  WHERE assignment_status IN ('ASSIGNED','PROVISIONING','READY');

CREATE INDEX IF NOT EXISTS idx_edge_p7_tenant_experience_tenant
  ON edge_p7_tenant_experience_assignments (tenant_id, assignment_status);

CREATE TABLE IF NOT EXISTS edge_p7_tenant_application_bindings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL
    REFERENCES edge_p7_tenant_experience_assignments(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  application_id UUID NOT NULL
    REFERENCES edge_p7_experience_applications(id) ON DELETE RESTRICT,
  application_version INTEGER NOT NULL CHECK (application_version >= 1),
  binding_status VARCHAR(32) NOT NULL DEFAULT 'PENDING'
    CHECK (binding_status IN ('PENDING','PROVISIONING','ACTIVE','FAILED','REVOKED')),
  client_registration_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_p7_tenant_app_bindings_uniq UNIQUE (assignment_id, application_id)
);

-- ---------------------------------------------------------------------------
-- Technical OIDC client registrations (no business users/roles)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_p7_experience_client_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL
    REFERENCES edge_p7_tenant_experience_assignments(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  application_binding_id UUID
    REFERENCES edge_p7_tenant_application_bindings(id) ON DELETE SET NULL,
  client_id VARCHAR(255) NOT NULL,
  client_kind VARCHAR(64) NOT NULL DEFAULT 'PUBLIC'
    CHECK (client_kind IN ('PUBLIC','CONFIDENTIAL','SERVICE_ACCOUNT')),
  keycloak_topology_id UUID,
  keycloak_client_ref VARCHAR(255),
  redirect_uris JSONB NOT NULL DEFAULT '[]'::jsonb,
  post_logout_redirect_uris JSONB NOT NULL DEFAULT '[]'::jsonb,
  web_origins JSONB NOT NULL DEFAULT '[]'::jsonb,
  audiences JSONB NOT NULL DEFAULT '[]'::jsonb,
  scopes JSONB NOT NULL DEFAULT '[]'::jsonb,
  credential_ref VARCHAR(128),
  registration_status VARCHAR(32) NOT NULL DEFAULT 'PENDING'
    CHECK (registration_status IN ('PENDING','ACTIVE','FAILED','REVOKED')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  CONSTRAINT edge_p7_experience_clients_tenant_client UNIQUE (tenant_id, client_id)
);

CREATE INDEX IF NOT EXISTS idx_edge_p7_experience_clients_assignment
  ON edge_p7_experience_client_registrations (assignment_id);

-- ---------------------------------------------------------------------------
-- Domain bindings + TLS
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_p7_experience_domain_bindings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL
    REFERENCES edge_p7_tenant_experience_assignments(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  hostname VARCHAR(255) NOT NULL,
  domain_kind VARCHAR(32) NOT NULL DEFAULT 'SUBDOMAIN'
    CHECK (domain_kind IN ('SUBDOMAIN','CUSTOM')),
  ownership_status VARCHAR(32) NOT NULL DEFAULT 'PENDING'
    CHECK (ownership_status IN ('PENDING','VERIFIED','FAILED','REVOKED')),
  ownership_token VARCHAR(128),
  dns_status VARCHAR(32) NOT NULL DEFAULT 'PENDING'
    CHECK (dns_status IN ('PENDING','VERIFIED','FAILED','NOT_REQUIRED')),
  tls_status VARCHAR(32) NOT NULL DEFAULT 'PENDING'
    CHECK (tls_status IN ('PENDING','PROVISIONING','ACTIVE','FAILED','EXPIRED','REVOKED')),
  certificate_ref VARCHAR(128),
  route_status VARCHAR(32) NOT NULL DEFAULT 'PENDING'
    CHECK (route_status IN ('PENDING','ACTIVE','FAILED','DEACTIVATED')),
  binding_status VARCHAR(32) NOT NULL DEFAULT 'PENDING'
    CHECK (binding_status IN ('PENDING','ACTIVE','FAILED','DEACTIVATED')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by VARCHAR(255) NOT NULL,
  updated_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  CONSTRAINT edge_p7_experience_domains_hostname UNIQUE (hostname)
);

CREATE INDEX IF NOT EXISTS idx_edge_p7_experience_domains_tenant
  ON edge_p7_experience_domain_bindings (tenant_id, binding_status);

CREATE TABLE IF NOT EXISTS edge_p7_experience_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_binding_id UUID NOT NULL
    REFERENCES edge_p7_experience_domain_bindings(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  certificate_ref VARCHAR(128) NOT NULL,
  issuer VARCHAR(255),
  not_before TIMESTAMPTZ,
  not_after TIMESTAMPTZ,
  fingerprint_sha256 CHAR(64),
  certificate_status VARCHAR(32) NOT NULL DEFAULT 'PENDING'
    CHECK (certificate_status IN ('PENDING','ACTIVE','EXPIRED','REVOKED','FAILED')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Deployment runs / history / evidence
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_p7_experience_deployment_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL
    REFERENCES edge_p7_tenant_experience_assignments(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  product_id UUID NOT NULL,
  operation VARCHAR(64) NOT NULL
    CHECK (operation IN (
      'DEPLOY','VERIFY','BIND_DOMAIN','PROVISION_TLS','REGISTER_CLIENT','REVOKE_CLIENT','DEACTIVATE'
    )),
  workflow_id UUID,
  outcome VARCHAR(32) NOT NULL DEFAULT 'PENDING'
    CHECK (outcome IN ('PENDING','SUCCEEDED','FAILED','PARTIAL','SKIPPED')),
  error_code VARCHAR(64),
  error_message TEXT,
  observed_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  performed_by VARCHAR(255),
  correlation_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edge_p7_experience_runs_assignment
  ON edge_p7_experience_deployment_runs (assignment_id, started_at DESC);

CREATE TABLE IF NOT EXISTS edge_p7_experience_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_type VARCHAR(64) NOT NULL,
  resource_id UUID NOT NULL,
  tenant_id UUID,
  from_status VARCHAR(64),
  to_status VARCHAR(64),
  action VARCHAR(64) NOT NULL,
  reason TEXT,
  actor_id VARCHAR(255) NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edge_p7_experience_history_resource
  ON edge_p7_experience_history (resource_type, resource_id, created_at DESC);

CREATE TABLE IF NOT EXISTS edge_p7_experience_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID,
  tenant_id UUID,
  workflow_id UUID,
  step_key VARCHAR(128),
  operation VARCHAR(128) NOT NULL,
  outcome VARCHAR(32) NOT NULL
    CHECK (outcome IN ('SUCCEEDED','FAILED','SKIPPED','PARTIAL')),
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_code VARCHAR(64),
  error_message TEXT,
  duration_ms INTEGER,
  performed_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edge_p7_experience_evidence_assignment
  ON edge_p7_experience_evidence (assignment_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Role bindings (not auto-granted to all roles)
-- ---------------------------------------------------------------------------

INSERT INTO edge_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM edge_roles r
CROSS JOIN edge_permissions p
WHERE r.code = 'EDGE_PLATFORM_SUPER_ADMIN'
  AND p.code LIKE 'platform:experience:%'
ON CONFLICT DO NOTHING;

INSERT INTO edge_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM edge_roles r
INNER JOIN edge_permissions p ON p.code IN (
  'platform:experience:read',
  'platform:experience:history:read'
)
WHERE r.code = 'EDGE_PLATFORM_OPERATOR'
ON CONFLICT DO NOTHING;

INSERT INTO schema_migrations (version)
VALUES ('104_edge_p7_product_experience_provisioning')
ON CONFLICT DO NOTHING;
