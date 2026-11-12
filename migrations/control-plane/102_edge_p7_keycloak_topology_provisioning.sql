-- Migration 102: P7.7 — Keycloak Topology Provisioning & Identity Infrastructure
-- Durable Keycloak provider/server/capability registry, topology resources
-- (realms, organizations, technical clients, OIDC configs), health,
-- reconciliation, history and evidence.
-- Secrets NEVER stored in plaintext (opaque credential_ref only).
-- Mutative ops go through P7.4 handlers with P7.1 authorization.
-- Does NOT manage business IAM users/roles (business backends own that) and
-- does NOT activate tenants (P7.8+).

-- ---------------------------------------------------------------------------
-- Keycloak providers (capability declarations, contract-driven)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_p7_keycloak_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(128) NOT NULL,
  name VARCHAR(255) NOT NULL,
  provider_version VARCHAR(64) NOT NULL,
  provider_kind VARCHAR(64) NOT NULL
    CHECK (provider_kind IN ('KEYCLOAK_MANAGED','KEYCLOAK_EXTERNAL','KEYCLOAK_HYBRID')),
  operational_status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE'
    CHECK (operational_status IN ('ACTIVE','DEGRADED','UNAVAILABLE','RETIRED')),
  supported_topology_types JSONB NOT NULL DEFAULT '[]'::jsonb,
  capabilities JSONB NOT NULL DEFAULT '{}'::jsonb,
  constraints JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_p7_keycloak_providers_code_key UNIQUE (code)
);

CREATE INDEX IF NOT EXISTS idx_edge_p7_keycloak_providers_status
  ON edge_p7_keycloak_providers (operational_status);

-- Seed the only provider exercised by live tests in this phase.
INSERT INTO edge_p7_keycloak_providers (
  code, name, provider_version, provider_kind, operational_status,
  supported_topology_types, capabilities, constraints
) VALUES (
  'keycloak-managed-v1',
  'Managed Keycloak Identity Infrastructure Provider',
  '1.0.0',
  'KEYCLOAK_MANAGED',
  'ACTIVE',
  '["DEDICATED_REALM","SHARED_REALM_ORGANIZATIONS"]'::jsonb,
  '{
    "realms": true,
    "organizations": true,
    "technicalClients": true,
    "oidcDiscovery": true,
    "reconciliation": true,
    "serviceAccountAuth": true,
    "tlsRequired": true
  }'::jsonb,
  '{
    "noBusinessUsers": true,
    "noBusinessRoles": true,
    "externalTopologyRequiresCertification": true
  }'::jsonb
)
ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Keycloak servers (registered target servers, operator-managed)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_p7_keycloak_servers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL
    REFERENCES edge_p7_keycloak_providers(id) ON DELETE RESTRICT,
  code VARCHAR(128) NOT NULL,
  name VARCHAR(255) NOT NULL,
  base_url VARCHAR(512) NOT NULL,
  admin_realm VARCHAR(255) NOT NULL DEFAULT 'master',
  admin_client_id VARCHAR(255) NOT NULL,
  -- Opaque vault reference for the service-account client secret. NEVER plaintext.
  admin_credential_ref VARCHAR(128),
  tls_mode VARCHAR(32) NOT NULL DEFAULT 'REQUIRED'
    CHECK (tls_mode IN ('REQUIRED','OPTIONAL_INSECURE_LOCAL')),
  -- Operator attestation allowing loopback/private network targets (lab/test only).
  allow_private_network BOOLEAN NOT NULL DEFAULT FALSE,
  environment VARCHAR(32) NOT NULL DEFAULT 'TEST'
    CHECK (environment IN ('DEVELOPMENT','TEST','STAGING','PRODUCTION')),
  operational_status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE'
    CHECK (operational_status IN ('ACTIVE','DEGRADED','UNAVAILABLE','RETIRED')),
  discovered_version VARCHAR(64),
  last_connectivity_status VARCHAR(32),
  last_connectivity_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_by VARCHAR(255),
  updated_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_p7_keycloak_servers_code_key UNIQUE (code),
  CONSTRAINT edge_p7_keycloak_servers_url_key UNIQUE (base_url, admin_realm, admin_client_id)
);

CREATE INDEX IF NOT EXISTS idx_edge_p7_keycloak_servers_status
  ON edge_p7_keycloak_servers (operational_status);

-- ---------------------------------------------------------------------------
-- Keycloak capabilities (discovered, verified feature matrix per server)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_p7_keycloak_capabilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id UUID NOT NULL
    REFERENCES edge_p7_keycloak_servers(id) ON DELETE CASCADE,
  keycloak_version VARCHAR(64),
  features JSONB NOT NULL DEFAULT '{}'::jsonb,
  organizations_supported BOOLEAN NOT NULL DEFAULT FALSE,
  realms_supported BOOLEAN NOT NULL DEFAULT TRUE,
  admin_api_reachable BOOLEAN NOT NULL DEFAULT FALSE,
  discovery_source VARCHAR(64) NOT NULL DEFAULT 'SERVERINFO'
    CHECK (discovery_source IN ('SERVERINFO','ENDPOINT_PROBE','MANUAL')),
  raw_evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_p7_keycloak_capabilities_server_key UNIQUE (server_id)
);

-- ---------------------------------------------------------------------------
-- Keycloak topologies (desired-state registry root, one per tenant/product)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_p7_keycloak_topologies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  product_id UUID NOT NULL REFERENCES edge_products(id) ON DELETE RESTRICT,
  subscription_id UUID,
  authorization_id UUID,
  authorization_version INTEGER,
  placement_decision_id UUID,
  deployment_profile_id UUID
    REFERENCES edge_p7_deployment_profiles(id) ON DELETE RESTRICT,
  deployment_profile_version INTEGER,
  runtime_profile_id UUID,
  provider_id UUID NOT NULL
    REFERENCES edge_p7_keycloak_providers(id) ON DELETE RESTRICT,
  server_id UUID NOT NULL
    REFERENCES edge_p7_keycloak_servers(id) ON DELETE RESTRICT,
  topology_type VARCHAR(64) NOT NULL
    CHECK (topology_type IN (
      'DEDICATED_REALM','SHARED_REALM_ORGANIZATIONS','EXTERNAL_SPECIFIC'
    )),
  -- Internal identity (UUID) — NEVER replaced by realm name or external id.
  realm_ref UUID,
  organization_ref UUID,
  oidc_configuration_ref UUID,
  -- External Keycloak identifiers (nullable until provisioned).
  external_realm_id VARCHAR(255),
  external_organization_id VARCHAR(255),
  keycloak_version VARCHAR(64),
  desired_config_version INTEGER NOT NULL DEFAULT 1 CHECK (desired_config_version >= 1),
  applied_config_version INTEGER,
  resource_fingerprint VARCHAR(128),
  status VARCHAR(32) NOT NULL DEFAULT 'PLANNED'
    CHECK (status IN (
      'PLANNED','PENDING','PROVISIONING','CONFIGURING','VERIFYING','READY',
      'DEGRADED','FAILED','RECONCILIATION_REQUIRED','QUARANTINED',
      'DEPROVISIONING_PENDING','DEPROVISIONED'
    )),
  status_reason TEXT,
  last_health_check_at TIMESTAMPTZ,
  last_reconciliation_at TIMESTAMPTZ,
  workflow_id UUID,
  -- Retention / deletion protection (never auto-delete without ownership proof).
  deletion_protection BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_by VARCHAR(255),
  updated_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One active topology per tenant+product+server (collision protection).
CREATE UNIQUE INDEX IF NOT EXISTS uq_edge_p7_keycloak_topologies_active
  ON edge_p7_keycloak_topologies (tenant_id, product_id, server_id)
  WHERE status <> 'DEPROVISIONED';

CREATE INDEX IF NOT EXISTS idx_edge_p7_keycloak_topologies_tenant
  ON edge_p7_keycloak_topologies (tenant_id, product_id, status);
CREATE INDEX IF NOT EXISTS idx_edge_p7_keycloak_topologies_workflow
  ON edge_p7_keycloak_topologies (workflow_id);

-- ---------------------------------------------------------------------------
-- Topology versions (immutable desired snapshots)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_p7_keycloak_topology_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topology_id UUID NOT NULL
    REFERENCES edge_p7_keycloak_topologies(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL CHECK (version_number >= 1),
  fingerprint VARCHAR(128) NOT NULL,
  snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  validation_status VARCHAR(32) NOT NULL DEFAULT 'PENDING'
    CHECK (validation_status IN ('PENDING','VALID','INVALID')),
  validation_errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_p7_keycloak_topology_versions_key UNIQUE (topology_id, version_number),
  CONSTRAINT edge_p7_keycloak_topology_versions_fp_key UNIQUE (fingerprint)
);

-- ---------------------------------------------------------------------------
-- Realms (technical realm resources)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_p7_keycloak_realms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topology_id UUID NOT NULL
    REFERENCES edge_p7_keycloak_topologies(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  -- Internal name decided by Edge (never user-supplied free text).
  realm_name VARCHAR(128) NOT NULL,
  external_realm_id VARCHAR(255),
  managed_by_edge BOOLEAN NOT NULL DEFAULT TRUE,
  ssl_required VARCHAR(16) NOT NULL DEFAULT 'external'
    CHECK (ssl_required IN ('none','external','all')),
  sso_session_idle_seconds INTEGER NOT NULL DEFAULT 1800 CHECK (sso_session_idle_seconds > 0),
  sso_session_max_seconds INTEGER NOT NULL DEFAULT 36000 CHECK (sso_session_max_seconds > 0),
  access_token_lifespan_seconds INTEGER NOT NULL DEFAULT 300 CHECK (access_token_lifespan_seconds > 0),
  password_policy VARCHAR(255),
  offline_session_idle_seconds INTEGER,
  revoke_refresh_token BOOLEAN NOT NULL DEFAULT TRUE,
  refresh_token_max_reuse INTEGER NOT NULL DEFAULT 0 CHECK (refresh_token_max_reuse >= 0),
  desired_fingerprint VARCHAR(128),
  applied_fingerprint VARCHAR(128),
  status VARCHAR(32) NOT NULL DEFAULT 'PLANNED'
    CHECK (status IN (
      'PLANNED','PROVISIONING','CONFIGURING','VERIFYING','READY','DEGRADED',
      'FAILED','RECONCILIATION_REQUIRED','QUARANTINED','DEPROVISIONING_PENDING','DEPROVISIONED'
    )),
  workflow_id UUID,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_p7_keycloak_realms_name_key UNIQUE (realm_name),
  CONSTRAINT edge_p7_keycloak_realms_topology_key UNIQUE (topology_id)
);

CREATE INDEX IF NOT EXISTS idx_edge_p7_keycloak_realms_status
  ON edge_p7_keycloak_realms (status);

-- ---------------------------------------------------------------------------
-- Organizations (Keycloak Organizations — TECHNICAL, never business orgs)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_p7_keycloak_organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topology_id UUID NOT NULL
    REFERENCES edge_p7_keycloak_topologies(id) ON DELETE CASCADE,
  realm_id UUID NOT NULL
    REFERENCES edge_p7_keycloak_realms(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  -- Technical alias only; explicitly NOT a business organization id.
  org_alias VARCHAR(128) NOT NULL,
  org_name VARCHAR(255) NOT NULL,
  external_organization_id VARCHAR(255),
  technical_purpose VARCHAR(255) NOT NULL DEFAULT 'tenant-identity-infrastructure',
  status VARCHAR(32) NOT NULL DEFAULT 'PLANNED'
    CHECK (status IN (
      'PLANNED','PROVISIONING','VERIFYING','READY','DEGRADED','FAILED',
      'RECONCILIATION_REQUIRED','QUARANTINED','DEPROVISIONED'
    )),
  workflow_id UUID,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_p7_keycloak_orgs_alias_key UNIQUE (realm_id, org_alias),
  CONSTRAINT edge_p7_keycloak_orgs_topology_key UNIQUE (topology_id)
);

-- ---------------------------------------------------------------------------
-- Technical clients (OIDC clients owned by the deployment contract)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_p7_keycloak_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topology_id UUID NOT NULL
    REFERENCES edge_p7_keycloak_topologies(id) ON DELETE CASCADE,
  realm_id UUID NOT NULL
    REFERENCES edge_p7_keycloak_realms(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  client_id VARCHAR(255) NOT NULL,
  client_uuid VARCHAR(255),
  client_kind VARCHAR(32) NOT NULL
    CHECK (client_kind IN ('CONFIDENTIAL','PUBLIC','SERVICE_ACCOUNT')),
  -- Functional owner (service or backend code), never a business end-user.
  owner_function VARCHAR(255) NOT NULL,
  documented_usage TEXT NOT NULL,
  redirect_uris JSONB NOT NULL DEFAULT '[]'::jsonb,
  web_origins JSONB NOT NULL DEFAULT '[]'::jsonb,
  scopes JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Opaque vault reference for the client secret. NEVER plaintext.
  secret_credential_ref VARCHAR(128),
  secret_rotated_at TIMESTAMPTZ,
  standard_flow_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  direct_access_grants_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  service_accounts_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  pkce_required BOOLEAN NOT NULL DEFAULT TRUE,
  compliance_status VARCHAR(32) NOT NULL DEFAULT 'PENDING'
    CHECK (compliance_status IN ('PENDING','COMPLIANT','NON_COMPLIANT','WAIVED')),
  status VARCHAR(32) NOT NULL DEFAULT 'PLANNED'
    CHECK (status IN (
      'PLANNED','PROVISIONING','VERIFYING','READY','DEGRADED','FAILED',
      'RECONCILIATION_REQUIRED','QUARANTINED','DEPROVISIONED'
    )),
  workflow_id UUID,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_p7_keycloak_clients_clientid_key UNIQUE (realm_id, client_id)
);

CREATE INDEX IF NOT EXISTS idx_edge_p7_keycloak_clients_kind
  ON edge_p7_keycloak_clients (client_kind, compliance_status);

-- ---------------------------------------------------------------------------
-- OIDC configurations (discovery-validated endpoint bundles)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_p7_keycloak_oidc_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topology_id UUID NOT NULL
    REFERENCES edge_p7_keycloak_topologies(id) ON DELETE CASCADE,
  realm_id UUID NOT NULL
    REFERENCES edge_p7_keycloak_realms(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  issuer VARCHAR(512) NOT NULL,
  authorization_endpoint VARCHAR(512),
  token_endpoint VARCHAR(512) NOT NULL,
  jwks_uri VARCHAR(512) NOT NULL,
  userinfo_endpoint VARCHAR(512),
  end_session_endpoint VARCHAR(512),
  supported_scopes JSONB NOT NULL DEFAULT '[]'::jsonb,
  supported_response_types JSONB NOT NULL DEFAULT '[]'::jsonb,
  supported_signing_algs JSONB NOT NULL DEFAULT '[]'::jsonb,
  discovery_document JSONB NOT NULL DEFAULT '{}'::jsonb,
  discovery_validated BOOLEAN NOT NULL DEFAULT FALSE,
  jwks_validated BOOLEAN NOT NULL DEFAULT FALSE,
  validated_at TIMESTAMPTZ,
  status VARCHAR(32) NOT NULL DEFAULT 'PLANNED'
    CHECK (status IN ('PLANNED','VERIFYING','READY','DEGRADED','FAILED','RECONCILIATION_REQUIRED','DEPROVISIONED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_p7_keycloak_oidc_topology_key UNIQUE (topology_id),
  CONSTRAINT edge_p7_keycloak_oidc_issuer_key UNIQUE (issuer)
);

-- ---------------------------------------------------------------------------
-- Resource references (external id bindings, internal ↔ external distinct)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_p7_keycloak_resource_references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topology_id UUID NOT NULL
    REFERENCES edge_p7_keycloak_topologies(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  resource_kind VARCHAR(64) NOT NULL
    CHECK (resource_kind IN ('REALM','ORGANIZATION','CLIENT','OIDC_CONFIGURATION','SERVER')),
  internal_ref UUID NOT NULL,
  external_id VARCHAR(255) NOT NULL,
  external_kind VARCHAR(64) NOT NULL DEFAULT 'KEYCLOAK',
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_p7_keycloak_resrefs_unique UNIQUE (resource_kind, internal_ref, external_id)
);

CREATE INDEX IF NOT EXISTS idx_edge_p7_keycloak_resrefs_topology
  ON edge_p7_keycloak_resource_references (topology_id, resource_kind);

-- ---------------------------------------------------------------------------
-- Health checks
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_p7_keycloak_health_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topology_id UUID
    REFERENCES edge_p7_keycloak_topologies(id) ON DELETE CASCADE,
  server_id UUID NOT NULL
    REFERENCES edge_p7_keycloak_servers(id) ON DELETE CASCADE,
  check_type VARCHAR(64) NOT NULL,
  outcome VARCHAR(32) NOT NULL
    CHECK (outcome IN ('HEALTHY','DEGRADED','UNHEALTHY','UNKNOWN')),
  latency_ms INTEGER,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edge_p7_keycloak_health_topology
  ON edge_p7_keycloak_health_checks (topology_id, checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_edge_p7_keycloak_health_server
  ON edge_p7_keycloak_health_checks (server_id, checked_at DESC);

-- ---------------------------------------------------------------------------
-- Reconciliation runs (desired vs observed)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_p7_keycloak_reconciliation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topology_id UUID NOT NULL
    REFERENCES edge_p7_keycloak_topologies(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  workflow_id UUID,
  trigger VARCHAR(32) NOT NULL DEFAULT 'MANUAL'
    CHECK (trigger IN ('MANUAL','SCHEDULED','DRIFT_DETECTED','WORKFLOW')),
  observed_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  drift_detected BOOLEAN NOT NULL DEFAULT FALSE,
  drift_classification VARCHAR(64),
  drift_details JSONB NOT NULL DEFAULT '[]'::jsonb,
  action_taken VARCHAR(64),
  outcome VARCHAR(32) NOT NULL DEFAULT 'PENDING'
    CHECK (outcome IN ('PENDING','NO_DRIFT','REMEDIATED','QUARANTINED','FAILED')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_edge_p7_keycloak_reconciliation_topology
  ON edge_p7_keycloak_reconciliation_runs (topology_id, started_at DESC);

-- ---------------------------------------------------------------------------
-- Provisioning history (immutable lifecycle trail)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_p7_keycloak_provisioning_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_type VARCHAR(64) NOT NULL,
  resource_id UUID NOT NULL,
  topology_id UUID,
  workflow_id UUID,
  from_status VARCHAR(32),
  to_status VARCHAR(32),
  action VARCHAR(64) NOT NULL,
  reason TEXT,
  actor_id VARCHAR(255) NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edge_p7_keycloak_history_resource
  ON edge_p7_keycloak_provisioning_history (resource_type, resource_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_edge_p7_keycloak_history_topology
  ON edge_p7_keycloak_provisioning_history (topology_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Operation evidence (proof of real operations; secrets NEVER included)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_p7_keycloak_operation_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topology_id UUID NOT NULL
    REFERENCES edge_p7_keycloak_topologies(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  workflow_id UUID,
  step_key VARCHAR(128),
  operation VARCHAR(64) NOT NULL,
  outcome VARCHAR(32) NOT NULL
    CHECK (outcome IN ('SUCCEEDED','FAILED','SKIPPED')),
  -- MUST NOT contain secrets; enforced by application-layer redaction + tests.
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_code VARCHAR(64),
  error_message TEXT,
  duration_ms INTEGER,
  performed_by VARCHAR(255),
  performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edge_p7_keycloak_evidence_topology
  ON edge_p7_keycloak_operation_evidence (topology_id, performed_at DESC);

-- ---------------------------------------------------------------------------
-- Permissions (not auto-granted to all roles)
-- ---------------------------------------------------------------------------

INSERT INTO edge_permissions (code, description) VALUES
  ('platform:keycloak:read', 'Read Keycloak providers, servers and topologies'),
  ('platform:keycloak:manage', 'Manage Keycloak providers and server registrations'),
  ('platform:keycloak:provision', 'Trigger Keycloak topology provisioning via workflow'),
  ('platform:keycloak:reconcile', 'Trigger Keycloak topology reconciliation via workflow'),
  ('platform:keycloak:deprovision', 'Authorize Keycloak topology deprovisioning'),
  ('platform:keycloak:history:read', 'Read Keycloak provisioning history and evidence'),
  ('platform:keycloak:capabilities', 'Discover and read Keycloak server capabilities')
ON CONFLICT (code) DO NOTHING;

INSERT INTO edge_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM edge_roles r
CROSS JOIN edge_permissions p
WHERE r.code = 'EDGE_PLATFORM_SUPER_ADMIN'
  AND p.code LIKE 'platform:keycloak:%'
ON CONFLICT DO NOTHING;

INSERT INTO edge_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM edge_roles r
INNER JOIN edge_permissions p ON p.code IN (
  'platform:keycloak:read',
  'platform:keycloak:reconcile',
  'platform:keycloak:history:read',
  'platform:keycloak:capabilities'
)
WHERE r.code = 'EDGE_PLATFORM_OPERATOR'
ON CONFLICT DO NOTHING;

INSERT INTO schema_migrations (version)
VALUES ('102_edge_p7_keycloak_topology_provisioning')
ON CONFLICT DO NOTHING;
