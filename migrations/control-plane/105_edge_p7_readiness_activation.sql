-- Migration 105: P7.10 — Technical Readiness & Activation Gate
-- Aggregates prior-phase evidence (P7.1 auth + P7.6–P7.9) into Activation Records.
-- Does NOT set commercial Subscription.ACTIVE alone; emits provisioning-completed signal for P5.
-- Mutative evaluate/activate go through P7.4 with P7.1 fail-closed revalidation.
-- P6 payment / commercial readiness never activate. Trust material missing ⇒ fail-closed.

INSERT INTO edge_permissions (code, description) VALUES
  ('platform:activation:read', 'Read technical readiness evaluations and activation records'),
  ('platform:activation:evaluate', 'Launch technical readiness evaluation workflows'),
  ('platform:activation:activate', 'Gate technical activation via workflow (fail-closed)'),
  ('platform:activation:history:read', 'Read activation runs and evidence')
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS edge_p7_tenant_readiness_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  product_id UUID NOT NULL,
  subscription_id UUID,
  account_id UUID,
  provisioning_request_id UUID NOT NULL,
  authorization_row_id UUID,
  authorization_version INTEGER,
  evaluation_status VARCHAR(32) NOT NULL DEFAULT 'PENDING'
    CHECK (evaluation_status IN (
      'PENDING','EVALUATING','READY','NOT_READY','BLOCKED','FAILED','SUPERSEDED','EXPIRED'
    )),
  workflow_id UUID,
  overall_score NUMERIC(5,2),
  blocking_codes JSONB NOT NULL DEFAULT '[]'::jsonb,
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  evaluated_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by VARCHAR(255) NOT NULL,
  updated_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1)
);

CREATE INDEX IF NOT EXISTS idx_edge_p7_readiness_eval_tenant
  ON edge_p7_tenant_readiness_evaluations (tenant_id, product_id, evaluation_status);

CREATE INDEX IF NOT EXISTS idx_edge_p7_readiness_eval_request
  ON edge_p7_tenant_readiness_evaluations (provisioning_request_id);

CREATE TABLE IF NOT EXISTS edge_p7_readiness_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id UUID NOT NULL
    REFERENCES edge_p7_tenant_readiness_evaluations(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  check_code VARCHAR(64) NOT NULL,
  check_phase VARCHAR(32) NOT NULL
    CHECK (check_phase IN (
      'P71_AUTH','P75_PRODUCT_CONTROL','P76_INFRA','P77_KEYCLOAK',
      'P78_CONFIGURATION','P78_ENTITLEMENTS','P79_EXPERIENCE','AGGREGATE','OTHER'
    )),
  check_status VARCHAR(32) NOT NULL DEFAULT 'PENDING'
    CHECK (check_status IN ('PENDING','PASSED','FAILED','SKIPPED','BLOCKED','ERROR')),
  required BOOLEAN NOT NULL DEFAULT TRUE,
  message TEXT,
  evidence_ref VARCHAR(255),
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_p7_readiness_checks_uniq UNIQUE (evaluation_id, check_code)
);

CREATE INDEX IF NOT EXISTS idx_edge_p7_readiness_checks_eval
  ON edge_p7_readiness_checks (evaluation_id, check_status);

CREATE TABLE IF NOT EXISTS edge_p7_activation_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  product_id UUID NOT NULL,
  subscription_id UUID,
  account_id UUID,
  provisioning_request_id UUID NOT NULL,
  authorization_row_id UUID NOT NULL,
  authorization_version INTEGER NOT NULL,
  readiness_evaluation_id UUID
    REFERENCES edge_p7_tenant_readiness_evaluations(id) ON DELETE RESTRICT,
  activation_status VARCHAR(32) NOT NULL DEFAULT 'PENDING'
    CHECK (activation_status IN (
      'PENDING','EVALUATING','READY_FOR_ACTIVATION','ACTIVATING',
      'ACTIVE','FAILED','BLOCKED','SUPERSEDED'
    )),
  workflow_id UUID,
  activated_at TIMESTAMPTZ,
  p5_signal_emitted_at TIMESTAMPTZ,
  p5_signal_event_id UUID,
  failure_code VARCHAR(64),
  failure_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by VARCHAR(255) NOT NULL,
  updated_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_edge_p7_activation_active
  ON edge_p7_activation_records (tenant_id, product_id)
  WHERE activation_status IN (
    'PENDING','EVALUATING','READY_FOR_ACTIVATION','ACTIVATING','ACTIVE'
  );

CREATE INDEX IF NOT EXISTS idx_edge_p7_activation_request
  ON edge_p7_activation_records (provisioning_request_id);

CREATE TABLE IF NOT EXISTS edge_p7_activation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activation_record_id UUID NOT NULL
    REFERENCES edge_p7_activation_records(id) ON DELETE CASCADE,
  evaluation_id UUID
    REFERENCES edge_p7_tenant_readiness_evaluations(id) ON DELETE SET NULL,
  tenant_id UUID NOT NULL,
  product_id UUID NOT NULL,
  operation VARCHAR(64) NOT NULL
    CHECK (operation IN ('EVALUATE','ACTIVATE','VERIFY','BLOCK','SUPERSEDE')),
  workflow_id UUID,
  outcome VARCHAR(32) NOT NULL DEFAULT 'PENDING'
    CHECK (outcome IN ('PENDING','SUCCEEDED','FAILED','PARTIAL','SKIPPED','BLOCKED')),
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

CREATE INDEX IF NOT EXISTS idx_edge_p7_activation_runs_record
  ON edge_p7_activation_runs (activation_record_id, started_at DESC);

CREATE TABLE IF NOT EXISTS edge_p7_activation_history (
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

CREATE INDEX IF NOT EXISTS idx_edge_p7_activation_history_resource
  ON edge_p7_activation_history (resource_type, resource_id, created_at DESC);

CREATE TABLE IF NOT EXISTS edge_p7_activation_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activation_record_id UUID,
  evaluation_id UUID,
  tenant_id UUID,
  workflow_id UUID,
  step_key VARCHAR(128),
  operation VARCHAR(128) NOT NULL,
  outcome VARCHAR(32) NOT NULL
    CHECK (outcome IN ('SUCCEEDED','FAILED','SKIPPED','PARTIAL','BLOCKED')),
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_code VARCHAR(64),
  error_message TEXT,
  duration_ms INTEGER,
  performed_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edge_p7_activation_evidence_record
  ON edge_p7_activation_evidence (activation_record_id, created_at DESC);

INSERT INTO edge_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM edge_roles r
CROSS JOIN edge_permissions p
WHERE r.code = 'EDGE_PLATFORM_SUPER_ADMIN'
  AND p.code LIKE 'platform:activation:%'
ON CONFLICT DO NOTHING;

INSERT INTO edge_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM edge_roles r
INNER JOIN edge_permissions p ON p.code IN (
  'platform:activation:read',
  'platform:activation:history:read'
)
WHERE r.code = 'EDGE_PLATFORM_OPERATOR'
ON CONFLICT DO NOTHING;

INSERT INTO schema_migrations (version)
VALUES ('105_edge_p7_readiness_activation')
ON CONFLICT DO NOTHING;
