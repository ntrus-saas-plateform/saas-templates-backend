-- Migration 109: P7.13 — Reconciliation & Operational Governance
-- Generic drift detection, remediation plans, waivers/exceptions, evidence.
-- Remediations ONLY via P7.4. Timeout/unreachable ⇒ UNKNOWN (never treat as deleted).
-- Auto-remediate only when deterministic/safe; else quarantine or human approval.
-- Note: 108 is reserved by P8 advanced tenant management — P7.13 uses 109.

INSERT INTO edge_permissions (code, description) VALUES
  ('platform:reconciliation:read', 'Read reconciliation runs, drifts and policies'),
  ('platform:reconciliation:run', 'Launch reconciliation observation workflows'),
  ('platform:reconciliation:remediate', 'Launch controlled remediation workflows'),
  ('platform:reconciliation:approve', 'Approve remediation or waive drifts'),
  ('platform:reconciliation:quarantine', 'Quarantine uncertain resources'),
  ('platform:reconciliation:history:read', 'Read reconciliation evidence and history')
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS edge_p7_reconciliation_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(128) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  scope VARCHAR(64) NOT NULL DEFAULT 'TENANT_PRODUCT'
    CHECK (scope IN ('GLOBAL','TENANT','PRODUCT','TENANT_PRODUCT','PROVIDER')),
  auto_remediate BOOLEAN NOT NULL DEFAULT FALSE,
  require_approval BOOLEAN NOT NULL DEFAULT TRUE,
  policy_status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE'
    CHECK (policy_status IN ('DRAFT','ACTIVE','DISABLED','DEPRECATED')),
  rules JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by VARCHAR(255) NOT NULL,
  updated_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  CONSTRAINT edge_p7_reconciliation_policies_code UNIQUE (code)
);

CREATE TABLE IF NOT EXISTS edge_p7_reconciliation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  product_id UUID,
  provider_code VARCHAR(128),
  policy_id UUID
    REFERENCES edge_p7_reconciliation_policies(id) ON DELETE SET NULL,
  trigger_kind VARCHAR(32) NOT NULL DEFAULT 'MANUAL'
    CHECK (trigger_kind IN ('MANUAL','SCHEDULED','EVENT','EMERGENCY','PARTIAL')),
  run_status VARCHAR(32) NOT NULL DEFAULT 'PENDING'
    CHECK (run_status IN (
      'PENDING','RUNNING','SUCCEEDED','FAILED','PARTIAL','CANCELLED','WAITING_APPROVAL'
    )),
  provisioning_request_id UUID,
  authorization_row_id UUID,
  authorization_version INTEGER,
  workflow_id UUID,
  desired_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  observed_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  drift_count INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  performed_by VARCHAR(255),
  correlation_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edge_p7_recon_runs_tenant
  ON edge_p7_reconciliation_runs (tenant_id, started_at DESC);

CREATE TABLE IF NOT EXISTS edge_p7_reconciliation_findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL
    REFERENCES edge_p7_reconciliation_runs(id) ON DELETE CASCADE,
  tenant_id UUID,
  product_id UUID,
  finding_code VARCHAR(128) NOT NULL,
  resource_type VARCHAR(64) NOT NULL,
  resource_ref VARCHAR(255),
  severity VARCHAR(32) NOT NULL DEFAULT 'MEDIUM'
    CHECK (severity IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  finding_status VARCHAR(32) NOT NULL DEFAULT 'OPEN'
    CHECK (finding_status IN (
      'OPEN','REMEDIATING','REMEDIATED','QUARANTINED','WAIVED','FALSE_POSITIVE','EXPIRED'
    )),
  observation_class VARCHAR(32) NOT NULL DEFAULT 'DRIFT'
    CHECK (observation_class IN ('DRIFT','MISSING','UNEXPECTED','UNKNOWN','CONFLICT')),
  desired_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  observed_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_known_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  auto_remediate_eligible BOOLEAN NOT NULL DEFAULT FALSE,
  message TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edge_p7_recon_findings_run
  ON edge_p7_reconciliation_findings (run_id, finding_status);

CREATE TABLE IF NOT EXISTS edge_p7_reconciliation_remediations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  finding_id UUID NOT NULL
    REFERENCES edge_p7_reconciliation_findings(id) ON DELETE CASCADE,
  run_id UUID NOT NULL
    REFERENCES edge_p7_reconciliation_runs(id) ON DELETE CASCADE,
  tenant_id UUID,
  remediation_status VARCHAR(32) NOT NULL DEFAULT 'PENDING'
    CHECK (remediation_status IN (
      'PENDING','APPROVED','RUNNING','SUCCEEDED','FAILED','REJECTED','CANCELLED','WAITING_APPROVAL'
    )),
  plan JSONB NOT NULL DEFAULT '{}'::jsonb,
  workflow_id UUID,
  reversible BOOLEAN NOT NULL DEFAULT TRUE,
  approved_by VARCHAR(255),
  approved_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_code VARCHAR(64),
  error_message TEXT,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS edge_p7_reconciliation_waivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  finding_id UUID
    REFERENCES edge_p7_reconciliation_findings(id) ON DELETE SET NULL,
  tenant_id UUID,
  product_id UUID,
  waiver_code VARCHAR(128) NOT NULL,
  reason TEXT NOT NULL,
  waiver_status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE'
    CHECK (waiver_status IN ('ACTIVE','EXPIRED','REVOKED')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_by VARCHAR(255) NOT NULL,
  revoked_by VARCHAR(255),
  revoked_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edge_p7_recon_waivers_expiry
  ON edge_p7_reconciliation_waivers (waiver_status, expires_at);

CREATE TABLE IF NOT EXISTS edge_p7_reconciliation_history (
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

CREATE TABLE IF NOT EXISTS edge_p7_reconciliation_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID,
  finding_id UUID,
  remediation_id UUID,
  tenant_id UUID,
  workflow_id UUID,
  step_key VARCHAR(128),
  operation VARCHAR(128) NOT NULL,
  outcome VARCHAR(32) NOT NULL
    CHECK (outcome IN ('SUCCEEDED','FAILED','SKIPPED','PARTIAL','WAITING_APPROVAL','UNKNOWN')),
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_code VARCHAR(64),
  error_message TEXT,
  duration_ms INTEGER,
  performed_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edge_p7_recon_evidence_run
  ON edge_p7_reconciliation_evidence (run_id, created_at DESC);

INSERT INTO edge_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM edge_roles r
CROSS JOIN edge_permissions p
WHERE r.code = 'EDGE_PLATFORM_SUPER_ADMIN'
  AND p.code LIKE 'platform:reconciliation:%'
ON CONFLICT DO NOTHING;

INSERT INTO edge_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM edge_roles r
INNER JOIN edge_permissions p ON p.code IN (
  'platform:reconciliation:read',
  'platform:reconciliation:history:read',
  'platform:reconciliation:run'
)
WHERE r.code = 'EDGE_PLATFORM_OPERATOR'
ON CONFLICT DO NOTHING;

INSERT INTO schema_migrations (version)
VALUES ('109_edge_p7_reconciliation_operational_governance')
ON CONFLICT DO NOTHING;
