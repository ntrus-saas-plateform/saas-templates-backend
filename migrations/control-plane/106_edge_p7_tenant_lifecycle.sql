-- Migration 106: P7.11 — Tenant Technical Lifecycle
-- Post-activation suspend / resume / deprovision / migrate / recover workflows.
-- Never silent delete. Deprovision requires flags + export evidence.
-- Does NOT manage business IAM or set commercial Subscription status alone.
-- Mutative ops via P7.4 with P7.1 fail-closed revalidation. Requires P7.10 Activation Record.

INSERT INTO edge_permissions (code, description) VALUES
  ('platform:lifecycle:read', 'Read tenant technical lifecycle records'),
  ('platform:lifecycle:suspend', 'Suspend technical tenant experience via workflow'),
  ('platform:lifecycle:resume', 'Resume technical tenant experience via workflow'),
  ('platform:lifecycle:deprovision', 'Authorize destructive technical deprovision via workflow'),
  ('platform:lifecycle:migrate', 'Migrate technical runtime bindings via workflow'),
  ('platform:lifecycle:recover', 'Recover / restore archived technical lifecycle via workflow'),
  ('platform:lifecycle:history:read', 'Read lifecycle runs and evidence')
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS edge_p7_tenant_lifecycle_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  product_id UUID NOT NULL,
  subscription_id UUID,
  account_id UUID,
  provisioning_request_id UUID NOT NULL,
  authorization_row_id UUID NOT NULL,
  authorization_version INTEGER NOT NULL,
  activation_record_id UUID NOT NULL
    REFERENCES edge_p7_activation_records(id) ON DELETE RESTRICT,
  lifecycle_status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE'
    CHECK (lifecycle_status IN (
      'ACTIVE','SUSPENDING','SUSPENDED','RESUMING',
      'MIGRATING','ARCHIVING','ARCHIVED','RESTORING',
      'DEPROVISIONING','DEPROVISIONED','DATA_PURGED','FAILED'
    )),
  workflow_id UUID,
  deletion_protection BOOLEAN NOT NULL DEFAULT TRUE,
  retention_policy_ref VARCHAR(128),
  export_evidence_ref VARCHAR(128),
  last_suspended_at TIMESTAMPTZ,
  last_resumed_at TIMESTAMPTZ,
  deprovisioned_at TIMESTAMPTZ,
  failure_code VARCHAR(64),
  failure_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by VARCHAR(255) NOT NULL,
  updated_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_edge_p7_lifecycle_active
  ON edge_p7_tenant_lifecycle_records (tenant_id, product_id)
  WHERE lifecycle_status NOT IN ('DEPROVISIONED','DATA_PURGED');

CREATE INDEX IF NOT EXISTS idx_edge_p7_lifecycle_tenant
  ON edge_p7_tenant_lifecycle_records (tenant_id, lifecycle_status);

CREATE TABLE IF NOT EXISTS edge_p7_lifecycle_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lifecycle_record_id UUID NOT NULL
    REFERENCES edge_p7_tenant_lifecycle_records(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  product_id UUID NOT NULL,
  operation VARCHAR(64) NOT NULL
    CHECK (operation IN (
      'SUSPEND','RESUME','DEPROVISION','MIGRATE','RECOVER','VERIFY','ARCHIVE'
    )),
  workflow_id UUID,
  outcome VARCHAR(32) NOT NULL DEFAULT 'PENDING'
    CHECK (outcome IN ('PENDING','SUCCEEDED','FAILED','PARTIAL','SKIPPED','WAITING_APPROVAL')),
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

CREATE INDEX IF NOT EXISTS idx_edge_p7_lifecycle_runs_record
  ON edge_p7_lifecycle_runs (lifecycle_record_id, started_at DESC);

CREATE TABLE IF NOT EXISTS edge_p7_lifecycle_history (
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

CREATE INDEX IF NOT EXISTS idx_edge_p7_lifecycle_history_resource
  ON edge_p7_lifecycle_history (resource_type, resource_id, created_at DESC);

CREATE TABLE IF NOT EXISTS edge_p7_lifecycle_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lifecycle_record_id UUID,
  tenant_id UUID,
  workflow_id UUID,
  step_key VARCHAR(128),
  operation VARCHAR(128) NOT NULL,
  outcome VARCHAR(32) NOT NULL
    CHECK (outcome IN ('SUCCEEDED','FAILED','SKIPPED','PARTIAL','WAITING_APPROVAL')),
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_code VARCHAR(64),
  error_message TEXT,
  duration_ms INTEGER,
  performed_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edge_p7_lifecycle_evidence_record
  ON edge_p7_lifecycle_evidence (lifecycle_record_id, created_at DESC);

INSERT INTO edge_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM edge_roles r
CROSS JOIN edge_permissions p
WHERE r.code = 'EDGE_PLATFORM_SUPER_ADMIN'
  AND p.code LIKE 'platform:lifecycle:%'
ON CONFLICT DO NOTHING;

INSERT INTO edge_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM edge_roles r
INNER JOIN edge_permissions p ON p.code IN (
  'platform:lifecycle:read',
  'platform:lifecycle:history:read'
)
WHERE r.code = 'EDGE_PLATFORM_OPERATOR'
ON CONFLICT DO NOTHING;

INSERT INTO schema_migrations (version)
VALUES ('106_edge_p7_tenant_lifecycle')
ON CONFLICT DO NOTHING;
