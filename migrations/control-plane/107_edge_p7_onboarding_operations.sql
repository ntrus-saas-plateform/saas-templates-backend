-- Migration 107: P7.12 — Onboarding Operations
-- Post-activation operational onboarding journeys (templates, steps, human tasks).
-- NOT a CRM / commercial SoT. Business user invites/memberships remain Business Backend.
-- Mutative start/advance/approve/close via P7.4 with P7.1 fail-closed. Requires P7.10 ACTIVE.

INSERT INTO edge_permissions (code, description) VALUES
  ('platform:onboarding:read', 'Read onboarding templates and journeys'),
  ('platform:onboarding:start', 'Start onboarding journeys via workflow'),
  ('platform:onboarding:advance', 'Advance or retry onboarding steps via workflow'),
  ('platform:onboarding:approve', 'Approve onboarding human tasks'),
  ('platform:onboarding:reject', 'Reject onboarding human tasks'),
  ('platform:onboarding:close', 'Close completed onboarding journeys'),
  ('platform:onboarding:history:read', 'Read onboarding runs and evidence')
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS edge_p7_onboarding_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(128) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  product_id UUID,
  deployment_profile_code VARCHAR(128),
  template_status VARCHAR(32) NOT NULL DEFAULT 'DRAFT'
    CHECK (template_status IN ('DRAFT','VALIDATED','PUBLISHED','DEPRECATED','RETIRED')),
  step_plan JSONB NOT NULL DEFAULT '[]'::jsonb,
  sla_policy JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by VARCHAR(255) NOT NULL,
  updated_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  CONSTRAINT edge_p7_onboarding_templates_code UNIQUE (code)
);

CREATE TABLE IF NOT EXISTS edge_p7_onboarding_journeys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  product_id UUID NOT NULL,
  subscription_id UUID,
  account_id UUID,
  template_id UUID
    REFERENCES edge_p7_onboarding_templates(id) ON DELETE RESTRICT,
  activation_record_id UUID NOT NULL
    REFERENCES edge_p7_activation_records(id) ON DELETE RESTRICT,
  provisioning_request_id UUID NOT NULL,
  authorization_row_id UUID NOT NULL,
  authorization_version INTEGER NOT NULL,
  journey_status VARCHAR(32) NOT NULL DEFAULT 'PENDING'
    CHECK (journey_status IN (
      'PENDING','STARTING','IN_PROGRESS','WAITING_APPROVAL','BLOCKED',
      'FAILED','CLOSING','CLOSED','CANCELLED','SUPERSEDED'
    )),
  current_step_key VARCHAR(128),
  workflow_id UUID,
  started_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  handover_evidence_ref VARCHAR(128),
  failure_code VARCHAR(64),
  failure_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by VARCHAR(255) NOT NULL,
  updated_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_edge_p7_onboarding_journey_active
  ON edge_p7_onboarding_journeys (tenant_id, product_id)
  WHERE journey_status NOT IN ('CLOSED','CANCELLED','SUPERSEDED');

CREATE INDEX IF NOT EXISTS idx_edge_p7_onboarding_journey_status
  ON edge_p7_onboarding_journeys (journey_status, tenant_id);

CREATE TABLE IF NOT EXISTS edge_p7_onboarding_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id UUID NOT NULL
    REFERENCES edge_p7_onboarding_journeys(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  step_key VARCHAR(128) NOT NULL,
  step_order INTEGER NOT NULL CHECK (step_order >= 1),
  step_kind VARCHAR(64) NOT NULL DEFAULT 'SYSTEM'
    CHECK (step_kind IN ('SYSTEM','HUMAN','COORDINATION','VERIFY','HANDOVER')),
  step_status VARCHAR(32) NOT NULL DEFAULT 'PENDING'
    CHECK (step_status IN (
      'PENDING','READY','RUNNING','WAITING_APPROVAL','PASSED','FAILED','SKIPPED','BLOCKED'
    )),
  required BOOLEAN NOT NULL DEFAULT TRUE,
  depends_on JSONB NOT NULL DEFAULT '[]'::jsonb,
  message TEXT,
  evidence_ref VARCHAR(255),
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_p7_onboarding_steps_uniq UNIQUE (journey_id, step_key)
);

CREATE INDEX IF NOT EXISTS idx_edge_p7_onboarding_steps_journey
  ON edge_p7_onboarding_steps (journey_id, step_order);

CREATE TABLE IF NOT EXISTS edge_p7_onboarding_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id UUID NOT NULL
    REFERENCES edge_p7_onboarding_journeys(id) ON DELETE CASCADE,
  step_id UUID
    REFERENCES edge_p7_onboarding_steps(id) ON DELETE SET NULL,
  tenant_id UUID NOT NULL,
  task_code VARCHAR(128) NOT NULL,
  task_status VARCHAR(32) NOT NULL DEFAULT 'OPEN'
    CHECK (task_status IN ('OPEN','APPROVED','REJECTED','CANCELLED','EXPIRED')),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  assignee_ref VARCHAR(255),
  decision_reason TEXT,
  decided_by VARCHAR(255),
  decided_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edge_p7_onboarding_tasks_journey
  ON edge_p7_onboarding_tasks (journey_id, task_status);

CREATE TABLE IF NOT EXISTS edge_p7_onboarding_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id UUID NOT NULL
    REFERENCES edge_p7_onboarding_journeys(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  product_id UUID NOT NULL,
  operation VARCHAR(64) NOT NULL
    CHECK (operation IN ('START','ADVANCE','APPROVE','REJECT','CLOSE','VERIFY')),
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

CREATE INDEX IF NOT EXISTS idx_edge_p7_onboarding_runs_journey
  ON edge_p7_onboarding_runs (journey_id, started_at DESC);

CREATE TABLE IF NOT EXISTS edge_p7_onboarding_history (
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

CREATE INDEX IF NOT EXISTS idx_edge_p7_onboarding_history_resource
  ON edge_p7_onboarding_history (resource_type, resource_id, created_at DESC);

CREATE TABLE IF NOT EXISTS edge_p7_onboarding_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id UUID,
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

CREATE INDEX IF NOT EXISTS idx_edge_p7_onboarding_evidence_journey
  ON edge_p7_onboarding_evidence (journey_id, created_at DESC);

INSERT INTO edge_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM edge_roles r
CROSS JOIN edge_permissions p
WHERE r.code = 'EDGE_PLATFORM_SUPER_ADMIN'
  AND p.code LIKE 'platform:onboarding:%'
ON CONFLICT DO NOTHING;

INSERT INTO edge_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM edge_roles r
INNER JOIN edge_permissions p ON p.code IN (
  'platform:onboarding:read',
  'platform:onboarding:history:read',
  'platform:onboarding:approve'
)
WHERE r.code = 'EDGE_PLATFORM_OPERATOR'
ON CONFLICT DO NOTHING;

INSERT INTO schema_migrations (version)
VALUES ('107_edge_p7_onboarding_operations')
ON CONFLICT DO NOTHING;
