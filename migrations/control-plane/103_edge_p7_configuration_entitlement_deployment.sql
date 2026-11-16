-- Migration 103: P7.8 — Configuration & Entitlement Deployment
-- Versioned configuration registry, schema validation, entitlement deployment
-- from P5 canonical snapshots, durable deployment history and evidence.
-- P5 remains the commercial authority; P7.8 NEVER expands granted rights.
-- Mutative deployments go through P7.4 workflows with P7.1 authorization.
-- Secrets referenced by vault refs only — never plaintext in configs/events.

-- ---------------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------------

INSERT INTO edge_permissions (code, description) VALUES
  ('platform:configuration:read', 'Read configuration registry, schemas, bundles, tenant assignments'),
  ('platform:configuration:manage', 'Create/update configuration schemas, templates and bundles'),
  ('platform:configuration:deploy', 'Deploy configuration/entitlement bundles to tenants via workflow'),
  ('platform:configuration:rollback', 'Request controlled rollback of a configuration deployment'),
  ('platform:configuration:history:read', 'Read configuration deployment history and evidence'),
  ('platform:entitlement:read', 'Read entitlement deployment records and drift status'),
  ('platform:entitlement:reconcile', 'Trigger entitlement reconciliation against P5 snapshots')
ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Configuration schemas (immutable versions)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_p7_configuration_schemas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(128) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  product_id UUID,
  schema_version INTEGER NOT NULL DEFAULT 1 CHECK (schema_version >= 1),
  json_schema JSONB NOT NULL,
  checksum CHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('DRAFT','ACTIVE','DEPRECATED','RETIRED')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_p7_configuration_schemas_code_version UNIQUE (code, schema_version)
);

CREATE INDEX IF NOT EXISTS idx_edge_p7_configuration_schemas_status
  ON edge_p7_configuration_schemas (status, code);

-- ---------------------------------------------------------------------------
-- Configuration templates (draftable; published versions immutable)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_p7_configuration_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(128) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  product_id UUID,
  schema_id UUID NOT NULL
    REFERENCES edge_p7_configuration_schemas(id) ON DELETE RESTRICT,
  runtime_profile_code VARCHAR(128),
  deployment_profile_code VARCHAR(128),
  template_status VARCHAR(32) NOT NULL DEFAULT 'DRAFT'
    CHECK (template_status IN ('DRAFT','VALIDATED','PUBLISHED','DEPRECATED','RETIRED')),
  latest_version INTEGER NOT NULL DEFAULT 0 CHECK (latest_version >= 0),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by VARCHAR(255) NOT NULL,
  updated_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  CONSTRAINT edge_p7_configuration_templates_code UNIQUE (code)
);

CREATE TABLE IF NOT EXISTS edge_p7_configuration_template_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL
    REFERENCES edge_p7_configuration_templates(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL CHECK (version_number >= 1),
  payload JSONB NOT NULL,
  checksum CHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT','VALIDATED','PUBLISHED','SUPERSEDED')),
  published_at TIMESTAMPTZ,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_p7_configuration_template_versions_uniq UNIQUE (template_id, version_number)
);

-- ---------------------------------------------------------------------------
-- Configuration bundles (immutable published versions)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_p7_configuration_bundles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(128) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  product_id UUID,
  bundle_status VARCHAR(32) NOT NULL DEFAULT 'DRAFT'
    CHECK (bundle_status IN ('DRAFT','VALIDATED','PUBLISHED','DEPRECATED','RETIRED')),
  latest_version INTEGER NOT NULL DEFAULT 0 CHECK (latest_version >= 0),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by VARCHAR(255) NOT NULL,
  updated_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  CONSTRAINT edge_p7_configuration_bundles_code UNIQUE (code)
);

CREATE TABLE IF NOT EXISTS edge_p7_configuration_bundle_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_id UUID NOT NULL
    REFERENCES edge_p7_configuration_bundles(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL CHECK (version_number >= 1),
  template_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  dependency_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  checksum CHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT','VALIDATED','PUBLISHED','SUPERSEDED')),
  rollout_policy JSONB NOT NULL DEFAULT '{"strategy":"ATOMIC"}'::jsonb,
  published_at TIMESTAMPTZ,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_p7_configuration_bundle_versions_uniq UNIQUE (bundle_id, version_number)
);

-- ---------------------------------------------------------------------------
-- Tenant configuration assignments + entitlement deployments
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_p7_tenant_configuration_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  product_id UUID NOT NULL,
  subscription_id UUID,
  account_id UUID,
  bundle_id UUID NOT NULL
    REFERENCES edge_p7_configuration_bundles(id) ON DELETE RESTRICT,
  bundle_version INTEGER NOT NULL CHECK (bundle_version >= 1),
  bundle_checksum CHAR(64) NOT NULL,
  assignment_status VARCHAR(32) NOT NULL DEFAULT 'ASSIGNED'
    CHECK (assignment_status IN (
      'ASSIGNED','DEPLOYING','DEPLOYED','FAILED','ROLLBACK_PENDING','ROLLED_BACK','SUPERSEDED'
    )),
  desired_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  applied_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  applied_checksum CHAR(64),
  entitlement_snapshot_ref VARCHAR(255),
  entitlement_version VARCHAR(64),
  authorization_row_id UUID,
  authorization_version INTEGER,
  provisioning_request_id UUID,
  workflow_id UUID,
  deployment_strategy VARCHAR(32) NOT NULL DEFAULT 'ATOMIC'
    CHECK (deployment_strategy IN ('ATOMIC','ROLLING','CANARY','BLUE_GREEN','STAGED')),
  drift_status VARCHAR(32) NOT NULL DEFAULT 'NONE'
    CHECK (drift_status IN ('NONE','DETECTED','REMEDIATING','RESOLVED','UNKNOWN')),
  last_deployed_at TIMESTAMPTZ,
  last_reconciled_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by VARCHAR(255) NOT NULL,
  updated_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_edge_p7_tenant_config_active
  ON edge_p7_tenant_configuration_assignments (tenant_id, product_id)
  WHERE assignment_status IN ('ASSIGNED','DEPLOYING','DEPLOYED','ROLLBACK_PENDING');

CREATE INDEX IF NOT EXISTS idx_edge_p7_tenant_config_tenant
  ON edge_p7_tenant_configuration_assignments (tenant_id, assignment_status);

CREATE TABLE IF NOT EXISTS edge_p7_entitlement_deployments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL
    REFERENCES edge_p7_tenant_configuration_assignments(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  product_id UUID NOT NULL,
  subscription_id UUID,
  entitlement_snapshot_ref VARCHAR(255) NOT NULL,
  entitlement_version VARCHAR(64) NOT NULL,
  payload_digest CHAR(64) NOT NULL,
  capabilities JSONB NOT NULL DEFAULT '{}'::jsonb,
  feature_flags JSONB NOT NULL DEFAULT '{}'::jsonb,
  quotas JSONB NOT NULL DEFAULT '{}'::jsonb,
  limits JSONB NOT NULL DEFAULT '{}'::jsonb,
  deployment_status VARCHAR(32) NOT NULL DEFAULT 'PENDING'
    CHECK (deployment_status IN (
      'PENDING','VALIDATING','DEPLOYING','DEPLOYED','SUSPENDED','REVOKED','FAILED','SUPERSEDED'
    )),
  source VARCHAR(32) NOT NULL DEFAULT 'P5_SNAPSHOT'
    CHECK (source IN ('P5_SNAPSHOT','RECONCILIATION','MANUAL_ADMIN')),
  workflow_id UUID,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  deployed_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1)
);

CREATE INDEX IF NOT EXISTS idx_edge_p7_entitlement_deploy_tenant
  ON edge_p7_entitlement_deployments (tenant_id, deployment_status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_edge_p7_entitlement_deploy_digest
  ON edge_p7_entitlement_deployments (tenant_id, product_id, payload_digest)
  WHERE deployment_status IN ('PENDING','VALIDATING','DEPLOYING','DEPLOYED');

-- ---------------------------------------------------------------------------
-- Deployment runs, history, evidence
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_p7_configuration_deployment_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL
    REFERENCES edge_p7_tenant_configuration_assignments(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  product_id UUID NOT NULL,
  operation VARCHAR(64) NOT NULL
    CHECK (operation IN (
      'DEPLOY','ROLLBACK','RECONCILE','SUSPEND_ENTITLEMENT','REVOKE_ENTITLEMENT','VALIDATE'
    )),
  strategy VARCHAR(32) NOT NULL DEFAULT 'ATOMIC',
  workflow_id UUID,
  from_bundle_version INTEGER,
  to_bundle_version INTEGER,
  outcome VARCHAR(32) NOT NULL DEFAULT 'PENDING'
    CHECK (outcome IN ('PENDING','SUCCEEDED','FAILED','PARTIAL','ROLLED_BACK','SKIPPED')),
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

CREATE INDEX IF NOT EXISTS idx_edge_p7_config_deploy_runs_assignment
  ON edge_p7_configuration_deployment_runs (assignment_id, started_at DESC);

CREATE TABLE IF NOT EXISTS edge_p7_configuration_history (
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

CREATE INDEX IF NOT EXISTS idx_edge_p7_configuration_history_resource
  ON edge_p7_configuration_history (resource_type, resource_id, created_at DESC);

CREATE TABLE IF NOT EXISTS edge_p7_configuration_evidence (
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

CREATE INDEX IF NOT EXISTS idx_edge_p7_configuration_evidence_assignment
  ON edge_p7_configuration_evidence (assignment_id, created_at DESC);
