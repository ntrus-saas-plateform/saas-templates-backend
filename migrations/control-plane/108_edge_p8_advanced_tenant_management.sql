-- Migration 108: P8 — Advanced Tenant Management & Governance foundation
-- Product-tenant registry + administrative governance (NOT Identity tenants, NOT P7 execution engines).
-- Technical execution remains P7; commercial authority remains P5; billing remains P6.

INSERT INTO edge_permissions (code, description) VALUES
  ('platform:tenant_management:read', 'Read product tenant registry and 360 projections'),
  ('platform:tenant_management:search', 'Advanced search and filter product tenants'),
  ('platform:tenant_management:export', 'Export tenant registry (audited)'),
  ('platform:tenant_management:register', 'Register or sync a product tenant into the registry'),
  ('platform:tenant_management:update_metadata', 'Update administrative metadata / classification'),
  ('platform:tenant_management:assign_owner', 'Assign internal owner / operational team'),
  ('platform:tenant_management:manage_tags', 'Manage administrative tags and labels'),
  ('platform:tenant_management:lifecycle:request', 'Request administrative lifecycle actions'),
  ('platform:tenant_management:lifecycle:approve', 'Approve administrative lifecycle requests'),
  ('platform:tenant_management:restriction:manage', 'Manage administrative restrictions'),
  ('platform:tenant_management:exception:request', 'Request administrative exceptions'),
  ('platform:tenant_management:exception:approve', 'Approve administrative exceptions'),
  ('platform:tenant_management:migration:request', 'Request tenant migration governance'),
  ('platform:tenant_management:migration:approve', 'Approve tenant migration requests'),
  ('platform:tenant_management:recovery:request', 'Request tenant recovery governance'),
  ('platform:tenant_management:recovery:approve', 'Approve tenant recovery requests'),
  ('platform:tenant_management:termination:request', 'Request tenant termination governance'),
  ('platform:tenant_management:termination:approve', 'Approve tenant termination requests'),
  ('platform:tenant_management:reconciliation:execute', 'Execute tenant reconciliation runs'),
  ('platform:tenant_management:reconciliation:remediate', 'Approve controlled reconciliation remediations'),
  ('platform:tenant_management:audit:read', 'Read tenant administrative audit / activity'),
  ('platform:tenant_management:analytics:read', 'Read tenant portfolio analytics'),
  ('platform:tenant_management:sensitive_data:read', 'Read sensitive administrative fields'),
  ('platform:tenant_management:bulk:execute', 'Execute bulk administrative operations')
ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Registry aggregate root
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS edge_p8_tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_tenant_id UUID NOT NULL,
  tenant_code VARCHAR(64) NOT NULL,
  tenant_slug VARCHAR(128) NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  legal_name_ref VARCHAR(255),
  product_id UUID NOT NULL,
  product_code VARCHAR(128),
  account_id UUID,
  subscription_id UUID,
  classification VARCHAR(64) NOT NULL DEFAULT 'STANDARD'
    CHECK (classification IN (
      'STANDARD','PROFESSIONAL','ENTERPRISE','DEDICATED',
      'PRIVATE_CLOUD','ON_PREMISES','REGULATED','STRATEGIC','INTERNAL_TEST'
    )),
  segment VARCHAR(64),
  deployment_profile VARCHAR(128),
  environment_classification VARCHAR(64) NOT NULL DEFAULT 'PRODUCTION'
    CHECK (environment_classification IN (
      'PRODUCTION','STAGING','SANDBOX','DEVELOPMENT','DR','UNKNOWN'
    )),
  region VARCHAR(64),
  administrative_status VARCHAR(64) NOT NULL DEFAULT 'PENDING_REVIEW'
    CHECK (administrative_status IN (
      'PENDING_REVIEW','ACTIVE','RESTRICTED','SUSPENDED',
      'DEACTIVATION_REQUESTED','DEACTIVATED','TERMINATION_REQUESTED',
      'TERMINATED','ARCHIVED'
    )),
  technical_status VARCHAR(64) NOT NULL DEFAULT 'UNKNOWN'
    CHECK (technical_status IN (
      'NOT_PROVISIONED','PROVISIONING','PROVISIONED','CONFIGURING','DEPLOYING',
      'READINESS_PENDING','READY','ACTIVE','DEGRADED','UNAVAILABLE',
      'RECOVERING','MIGRATING','DEPROVISIONING','FAILED','UNKNOWN'
    )),
  governance_status VARCHAR(64) NOT NULL DEFAULT 'COMPLIANT'
    CHECK (governance_status IN (
      'COMPLIANT','REVIEW_REQUIRED','EXCEPTION_PENDING',
      'NON_COMPLIANT','RESTRICTED','UNDER_INVESTIGATION'
    )),
  health_status VARCHAR(32) NOT NULL DEFAULT 'UNKNOWN'
    CHECK (health_status IN (
      'HEALTHY','DEGRADED','CRITICAL','UNAVAILABLE','UNKNOWN','STALE'
    )),
  risk_level VARCHAR(32) NOT NULL DEFAULT 'UNKNOWN'
    CHECK (risk_level IN ('LOW','MEDIUM','HIGH','CRITICAL','UNKNOWN')),
  platform_tenant_ref UUID,
  provisioning_request_id UUID,
  activation_record_id UUID,
  lifecycle_record_id UUID,
  internal_owner_id VARCHAR(255),
  operational_team VARCHAR(255),
  support_classification VARCHAR(64),
  locale VARCHAR(32),
  timezone VARCHAR(64),
  default_language VARCHAR(16),
  data_residency_ref VARCHAR(128),
  retention_policy_ref VARCHAR(128),
  security_policy_ref VARCHAR(128),
  legal_hold BOOLEAN NOT NULL DEFAULT FALSE,
  deletion_protection BOOLEAN NOT NULL DEFAULT TRUE,
  last_admin_activity_at TIMESTAMPTZ,
  last_synced_at TIMESTAMPTZ,
  technical_observed_at TIMESTAMPTZ,
  health_observed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by VARCHAR(255) NOT NULL,
  updated_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  CONSTRAINT uq_edge_p8_tenants_product_tenant UNIQUE (product_tenant_id),
  CONSTRAINT uq_edge_p8_tenants_code UNIQUE (tenant_code),
  CONSTRAINT uq_edge_p8_tenants_slug UNIQUE (tenant_slug)
);

CREATE INDEX IF NOT EXISTS idx_edge_p8_tenants_product
  ON edge_p8_tenants (product_id, administrative_status);
CREATE INDEX IF NOT EXISTS idx_edge_p8_tenants_account
  ON edge_p8_tenants (account_id) WHERE account_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_edge_p8_tenants_subscription
  ON edge_p8_tenants (subscription_id) WHERE subscription_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_edge_p8_tenants_region
  ON edge_p8_tenants (region, classification);
CREATE INDEX IF NOT EXISTS idx_edge_p8_tenants_statuses
  ON edge_p8_tenants (administrative_status, technical_status, governance_status);
CREATE INDEX IF NOT EXISTS idx_edge_p8_tenants_search
  ON edge_p8_tenants (display_name, tenant_code, tenant_slug);
CREATE INDEX IF NOT EXISTS idx_edge_p8_tenants_health
  ON edge_p8_tenants (health_status, risk_level);

CREATE TABLE IF NOT EXISTS edge_p8_tenant_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_registry_id UUID NOT NULL
    REFERENCES edge_p8_tenants(id) ON DELETE CASCADE,
  tag_key VARCHAR(64) NOT NULL,
  tag_value VARCHAR(255) NOT NULL,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_edge_p8_tenant_tag UNIQUE (tenant_registry_id, tag_key, tag_value)
);

CREATE INDEX IF NOT EXISTS idx_edge_p8_tenant_tags_key
  ON edge_p8_tenant_tags (tag_key, tag_value);

CREATE TABLE IF NOT EXISTS edge_p8_tenant_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_registry_id UUID NOT NULL
    REFERENCES edge_p8_tenants(id) ON DELETE CASCADE,
  note_type VARCHAR(32) NOT NULL DEFAULT 'INTERNAL'
    CHECK (note_type IN ('INTERNAL','OPERATIONAL','COMPLIANCE')),
  body TEXT NOT NULL,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edge_p8_tenant_notes_tenant
  ON edge_p8_tenant_notes (tenant_registry_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Governance requests
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS edge_p8_lifecycle_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_registry_id UUID NOT NULL
    REFERENCES edge_p8_tenants(id) ON DELETE RESTRICT,
  product_tenant_id UUID NOT NULL,
  request_type VARCHAR(64) NOT NULL
    CHECK (request_type IN (
      'SUSPEND','RESUME','RESTRICT','UNRESTRICT','DEACTIVATE','REACTIVATE',
      'MIGRATE','RECOVER','TERMINATE','ARCHIVE'
    )),
  status VARCHAR(32) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN (
      'PENDING','APPROVED','REJECTED','IN_PROGRESS','COMPLETED',
      'FAILED','CANCELLED','WAITING_APPROVAL'
    )),
  justification TEXT NOT NULL,
  risk_assessment TEXT,
  requested_by VARCHAR(255) NOT NULL,
  approver_id VARCHAR(255),
  approved_at TIMESTAMPTZ,
  rejected_reason TEXT,
  p7_workflow_id UUID,
  p7_lifecycle_record_id UUID,
  p5_subscription_id UUID,
  correlation_id UUID,
  idempotency_key VARCHAR(128) NOT NULL,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  result JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  CONSTRAINT uq_edge_p8_lifecycle_idempotency UNIQUE (idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_edge_p8_lifecycle_req_tenant
  ON edge_p8_lifecycle_requests (tenant_registry_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS edge_p8_exceptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_registry_id UUID NOT NULL
    REFERENCES edge_p8_tenants(id) ON DELETE RESTRICT,
  product_tenant_id UUID NOT NULL,
  exception_type VARCHAR(64) NOT NULL
    CHECK (exception_type IN (
      'PROVISIONING','RESOURCE','REGION','POLICY','COMPLIANCE',
      'CAPACITY','TEMPORARY_RESTRICTION','OPERATIONAL','ENTERPRISE'
    )),
  status VARCHAR(32) NOT NULL DEFAULT 'REQUESTED'
    CHECK (status IN (
      'REQUESTED','APPROVED','REJECTED','ACTIVE','EXPIRED','REVOKED','SUPERSEDED'
    )),
  description TEXT NOT NULL,
  business_justification TEXT NOT NULL,
  risk_assessment TEXT,
  scope JSONB NOT NULL DEFAULT '{}'::jsonb,
  conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  requester_id VARCHAR(255) NOT NULL,
  approver_id VARCHAR(255),
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  approved_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  revoke_reason TEXT,
  correlation_id UUID,
  idempotency_key VARCHAR(128) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  CONSTRAINT uq_edge_p8_exception_idempotency UNIQUE (idempotency_key),
  CONSTRAINT chk_edge_p8_exception_expiry CHECK (expires_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_edge_p8_exceptions_tenant
  ON edge_p8_exceptions (tenant_registry_id, status, expires_at);

CREATE TABLE IF NOT EXISTS edge_p8_migration_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_registry_id UUID NOT NULL
    REFERENCES edge_p8_tenants(id) ON DELETE RESTRICT,
  product_tenant_id UUID NOT NULL,
  migration_type VARCHAR(64) NOT NULL
    CHECK (migration_type IN (
      'INFRASTRUCTURE','REGION','PROVIDER','DEPLOYMENT_PROFILE',
      'DATABASE','RUNTIME','PRODUCT_VERSION'
    )),
  status VARCHAR(32) NOT NULL DEFAULT 'REQUESTED'
    CHECK (status IN (
      'REQUESTED','ASSESSING','APPROVED','REJECTED','SCHEDULED',
      'IN_PROGRESS','SUCCEEDED','PARTIAL','FAILED','ROLLED_BACK','CANCELLED'
    )),
  justification TEXT NOT NULL,
  impact_assessment TEXT,
  compatibility_assessment TEXT,
  data_residency_review TEXT,
  downtime_assessment TEXT,
  target_ref JSONB NOT NULL DEFAULT '{}'::jsonb,
  schedule_at TIMESTAMPTZ,
  requested_by VARCHAR(255) NOT NULL,
  approver_id VARCHAR(255),
  approved_at TIMESTAMPTZ,
  p7_workflow_id UUID,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  result JSONB NOT NULL DEFAULT '{}'::jsonb,
  correlation_id UUID,
  idempotency_key VARCHAR(128) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT uq_edge_p8_migration_idempotency UNIQUE (idempotency_key)
);

CREATE TABLE IF NOT EXISTS edge_p8_recovery_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_registry_id UUID NOT NULL
    REFERENCES edge_p8_tenants(id) ON DELETE RESTRICT,
  product_tenant_id UUID NOT NULL,
  recovery_type VARCHAR(64) NOT NULL
    CHECK (recovery_type IN (
      'DATABASE','INFRASTRUCTURE','APPLICATION','CONFIGURATION',
      'DISASTER','PARTIAL_TENANT','FULL_TENANT'
    )),
  status VARCHAR(32) NOT NULL DEFAULT 'REQUESTED'
    CHECK (status IN (
      'REQUESTED','AUTHORIZED','REJECTED','IN_PROGRESS',
      'SUCCEEDED','FAILED','PARTIAL','CANCELLED'
    )),
  priority VARCHAR(16) NOT NULL DEFAULT 'MEDIUM'
    CHECK (priority IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  scope JSONB NOT NULL DEFAULT '{}'::jsonb,
  backup_ref VARCHAR(255),
  restore_point_ref VARCHAR(255),
  justification TEXT NOT NULL,
  rpo_assessment TEXT,
  rto_measurement TEXT,
  requested_by VARCHAR(255) NOT NULL,
  approver_id VARCHAR(255),
  approved_at TIMESTAMPTZ,
  p7_workflow_id UUID,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  result JSONB NOT NULL DEFAULT '{}'::jsonb,
  correlation_id UUID,
  idempotency_key VARCHAR(128) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT uq_edge_p8_recovery_idempotency UNIQUE (idempotency_key)
);

CREATE TABLE IF NOT EXISTS edge_p8_termination_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_registry_id UUID NOT NULL
    REFERENCES edge_p8_tenants(id) ON DELETE RESTRICT,
  product_tenant_id UUID NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'REQUESTED'
    CHECK (status IN (
      'REQUESTED','ELIGIBILITY_CHECK','WAITING_APPROVAL','APPROVED','REJECTED',
      'EXPORTING','DEACTIVATING','DEPROVISIONING','ARCHIVING',
      'COMPLETED','FAILED','CANCELLED','BLOCKED_LEGAL_HOLD'
    )),
  justification TEXT NOT NULL,
  contractual_check JSONB NOT NULL DEFAULT '{}'::jsonb,
  financial_check JSONB NOT NULL DEFAULT '{}'::jsonb,
  retention_evaluation JSONB NOT NULL DEFAULT '{}'::jsonb,
  legal_hold BOOLEAN NOT NULL DEFAULT FALSE,
  data_export_ref VARCHAR(255),
  grace_until TIMESTAMPTZ,
  requested_by VARCHAR(255) NOT NULL,
  approver_id VARCHAR(255),
  approved_at TIMESTAMPTZ,
  p7_workflow_id UUID,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  result JSONB NOT NULL DEFAULT '{}'::jsonb,
  correlation_id UUID,
  idempotency_key VARCHAR(128) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT uq_edge_p8_termination_idempotency UNIQUE (idempotency_key)
);

-- ---------------------------------------------------------------------------
-- Reconciliation / health / risk / activity
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS edge_p8_reconciliation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mode VARCHAR(32) NOT NULL DEFAULT 'ON_DEMAND'
    CHECK (mode IN ('SCHEDULED','ON_DEMAND','EVENT_DRIVEN','DRY_RUN')),
  status VARCHAR(32) NOT NULL DEFAULT 'RUNNING'
    CHECK (status IN ('RUNNING','COMPLETED','FAILED','CANCELLED')),
  scope JSONB NOT NULL DEFAULT '{}'::jsonb,
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_by VARCHAR(255) NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  correlation_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS edge_p8_reconciliation_findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL
    REFERENCES edge_p8_reconciliation_runs(id) ON DELETE CASCADE,
  tenant_registry_id UUID
    REFERENCES edge_p8_tenants(id) ON DELETE SET NULL,
  product_tenant_id UUID,
  finding_type VARCHAR(64) NOT NULL
    CHECK (finding_type IN (
      'MISSING_TENANT','ORPHAN_TENANT','DUPLICATE_REFERENCE',
      'STALE_SUBSCRIPTION_REFERENCE','UNAUTHORIZED_RESOURCE','MISSING_RESOURCE',
      'UNEXPECTED_RESOURCE','INCONSISTENT_LIFECYCLE_STATE',
      'INVALID_PRODUCT_ASSOCIATION','WRONG_DEPLOYMENT_REFERENCE',
      'STALE_HEALTH_STATE','INCONSISTENT_TECHNICAL_ACTIVATION','MISSING_EVIDENCE'
    )),
  severity VARCHAR(16) NOT NULL DEFAULT 'MEDIUM'
    CHECK (severity IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  status VARCHAR(32) NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN','ACKNOWLEDGED','REMEDIATING','RESOLVED','DISMISSED')),
  description TEXT NOT NULL,
  recommended_action TEXT,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edge_p8_recon_findings_run
  ON edge_p8_reconciliation_findings (run_id, severity, status);

CREATE TABLE IF NOT EXISTS edge_p8_health_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_registry_id UUID NOT NULL
    REFERENCES edge_p8_tenants(id) ON DELETE CASCADE,
  product_tenant_id UUID NOT NULL,
  overall_status VARCHAR(32) NOT NULL
    CHECK (overall_status IN (
      'HEALTHY','DEGRADED','CRITICAL','UNAVAILABLE','UNKNOWN','STALE'
    )),
  indicators JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_system VARCHAR(64) NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL,
  stale_after TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edge_p8_health_tenant
  ON edge_p8_health_snapshots (tenant_registry_id, observed_at DESC);

CREATE TABLE IF NOT EXISTS edge_p8_risk_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_registry_id UUID NOT NULL
    REFERENCES edge_p8_tenants(id) ON DELETE CASCADE,
  product_tenant_id UUID NOT NULL,
  risk_level VARCHAR(32) NOT NULL
    CHECK (risk_level IN ('LOW','MEDIUM','HIGH','CRITICAL','UNKNOWN')),
  score NUMERIC(8,2),
  rule_version VARCHAR(64) NOT NULL,
  inputs JSONB NOT NULL DEFAULT '{}'::jsonb,
  result JSONB NOT NULL DEFAULT '{}'::jsonb,
  evidence_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  reviewer_id VARCHAR(255),
  evaluated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS edge_p8_activity_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_registry_id UUID
    REFERENCES edge_p8_tenants(id) ON DELETE SET NULL,
  product_tenant_id UUID,
  event_type VARCHAR(128) NOT NULL,
  action VARCHAR(128) NOT NULL,
  actor_id VARCHAR(255),
  actor_type VARCHAR(64) NOT NULL DEFAULT 'ADMIN',
  source VARCHAR(64) NOT NULL,
  outcome VARCHAR(32) NOT NULL DEFAULT 'SUCCEEDED',
  reason TEXT,
  correlation_id UUID,
  causation_id UUID,
  before_ref JSONB,
  after_ref JSONB,
  evidence_ref VARCHAR(255),
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edge_p8_activity_tenant
  ON edge_p8_activity_events (tenant_registry_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_edge_p8_activity_type
  ON edge_p8_activity_events (event_type, created_at DESC);

CREATE TABLE IF NOT EXISTS edge_p8_bulk_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_type VARCHAR(64) NOT NULL
    CHECK (operation_type IN (
      'TAG','ASSIGN','CLASSIFY','EXPORT','REVIEW','RECONCILE'
    )),
  status VARCHAR(32) NOT NULL DEFAULT 'PREVIEW'
    CHECK (status IN (
      'PREVIEW','APPROVED','RUNNING','COMPLETED','FAILED','CANCELLED'
    )),
  preview_count INTEGER NOT NULL DEFAULT 0,
  filter JSONB NOT NULL DEFAULT '{}'::jsonb,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  results JSONB NOT NULL DEFAULT '[]'::jsonb,
  requested_by VARCHAR(255) NOT NULL,
  approver_id VARCHAR(255),
  correlation_id UUID,
  idempotency_key VARCHAR(128) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_edge_p8_bulk_idempotency UNIQUE (idempotency_key)
);

CREATE TABLE IF NOT EXISTS edge_p8_analytics_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_key VARCHAR(64) NOT NULL,
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edge_p8_analytics_key
  ON edge_p8_analytics_snapshots (snapshot_key, computed_at DESC);

-- RBAC bindings
INSERT INTO edge_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM edge_roles r
CROSS JOIN edge_permissions p
WHERE r.code = 'EDGE_PLATFORM_SUPER_ADMIN'
  AND p.code LIKE 'platform:tenant_management:%'
ON CONFLICT DO NOTHING;

INSERT INTO edge_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM edge_roles r
INNER JOIN edge_permissions p ON p.code IN (
  'platform:tenant_management:read',
  'platform:tenant_management:search',
  'platform:tenant_management:audit:read',
  'platform:tenant_management:analytics:read'
)
WHERE r.code = 'EDGE_PLATFORM_OPERATOR'
ON CONFLICT DO NOTHING;

INSERT INTO schema_migrations (version)
VALUES ('108_edge_p8_advanced_tenant_management')
ON CONFLICT DO NOTHING;
