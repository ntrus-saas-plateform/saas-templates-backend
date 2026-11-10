-- Migration 099: P7.4 — Durable Workflow & Saga Engine
-- Orchestration state, leases, fencing, compensation, human tasks, workers.
-- No live BB / infra / Keycloak provisioning side effects.

-- ---------------------------------------------------------------------------
-- Definitions
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_p7_workflow_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(128) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  domain VARCHAR(64) NOT NULL DEFAULT 'provisioning',
  definition_status VARCHAR(32) NOT NULL DEFAULT 'DRAFT'
    CHECK (definition_status IN ('DRAFT','VALIDATED','PUBLISHED','DEPRECATED','RETIRED')),
  security_classification VARCHAR(64),
  created_by VARCHAR(255),
  approved_by VARCHAR(255),
  published_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_p7_workflow_definitions_code_key UNIQUE (code)
);

CREATE INDEX IF NOT EXISTS idx_edge_p7_workflow_definitions_status
  ON edge_p7_workflow_definitions (definition_status, updated_at DESC);

CREATE TABLE IF NOT EXISTS edge_p7_workflow_definition_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  definition_id UUID NOT NULL
    REFERENCES edge_p7_workflow_definitions(id) ON DELETE RESTRICT,
  version_number INTEGER NOT NULL CHECK (version_number >= 1),
  snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT','VALIDATED','PUBLISHED','DEPRECATED','RETIRED')),
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_p7_workflow_definition_versions_uniq
    UNIQUE (definition_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_edge_p7_workflow_definition_versions_def
  ON edge_p7_workflow_definition_versions (definition_id, version_number DESC);

-- ---------------------------------------------------------------------------
-- Instances
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_p7_workflow_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  definition_id UUID NOT NULL
    REFERENCES edge_p7_workflow_definitions(id) ON DELETE RESTRICT,
  definition_version INTEGER NOT NULL CHECK (definition_version >= 1),
  definition_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  workflow_type VARCHAR(128) NOT NULL,
  business_reference VARCHAR(255),
  provisioning_request_id UUID,
  placement_decision_id UUID,
  authorization_row_id UUID,
  authorization_id UUID,
  authorization_version INTEGER,
  account_id UUID,
  product_id UUID,
  subscription_id UUID,
  correlation_id UUID NOT NULL,
  causation_id UUID,
  idempotency_key VARCHAR(255) NOT NULL,
  input_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  state VARCHAR(32) NOT NULL DEFAULT 'CREATED'
    CHECK (state IN (
      'CREATED','READY','RUNNING','WAITING','WAITING_APPROVAL','COMPENSATING',
      'COMPENSATION_FAILED','RETRY_PENDING','PAUSED','SUCCEEDED','FAILED',
      'CANCEL_REQUESTED','CANCELLED','TIMED_OUT','REQUIRES_INTERVENTION'
    )),
  current_step_key VARCHAR(128),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  deadline_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  failure_details JSONB NOT NULL DEFAULT '{}'::jsonb,
  initiating_actor VARCHAR(255),
  execution_context JSONB NOT NULL DEFAULT '{}'::jsonb,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_p7_workflow_instances_idempotency_key UNIQUE (idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_edge_p7_workflow_instances_state
  ON edge_p7_workflow_instances (state, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_edge_p7_workflow_instances_corr
  ON edge_p7_workflow_instances (correlation_id);
CREATE INDEX IF NOT EXISTS idx_edge_p7_workflow_instances_prov
  ON edge_p7_workflow_instances (provisioning_request_id)
  WHERE provisioning_request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_edge_p7_workflow_instances_deadline
  ON edge_p7_workflow_instances (deadline_at)
  WHERE deadline_at IS NOT NULL AND state NOT IN ('SUCCEEDED','FAILED','CANCELLED','TIMED_OUT');

-- ---------------------------------------------------------------------------
-- Steps
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_p7_workflow_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL
    REFERENCES edge_p7_workflow_instances(id) ON DELETE RESTRICT,
  step_key VARCHAR(128) NOT NULL,
  step_type VARCHAR(64) NOT NULL DEFAULT 'HANDLER',
  handler_key VARCHAR(128) NOT NULL,
  depends_on JSONB NOT NULL DEFAULT '[]'::jsonb,
  input_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  output_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(32) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN (
      'PENDING','READY','CLAIMED','RUNNING','WAITING','WAITING_APPROVAL',
      'SUCCEEDED','FAILED','RETRY_PENDING','COMPENSATION_PENDING','COMPENSATING',
      'COMPENSATED','SKIPPED','CANCELLED','TIMED_OUT'
    )),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  max_attempts INTEGER NOT NULL DEFAULT 3 CHECK (max_attempts >= 1),
  idempotency_key VARCHAR(255) NOT NULL,
  owner_worker_id VARCHAR(255),
  lease_expires_at TIMESTAMPTZ,
  fencing_token BIGINT NOT NULL DEFAULT 0 CHECK (fencing_token >= 0),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  timeout_at TIMESTAMPTZ,
  error_class VARCHAR(64),
  next_retry_at TIMESTAMPTZ,
  compensation_handler_key VARCHAR(128),
  execution_order INTEGER NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_p7_workflow_steps_uniq UNIQUE (workflow_id, step_key),
  CONSTRAINT edge_p7_workflow_steps_idempotency_key UNIQUE (idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_edge_p7_workflow_steps_claim
  ON edge_p7_workflow_steps (status, next_retry_at, lease_expires_at)
  WHERE status IN ('READY','RETRY_PENDING','CLAIMED','RUNNING');
CREATE INDEX IF NOT EXISTS idx_edge_p7_workflow_steps_workflow
  ON edge_p7_workflow_steps (workflow_id, execution_order);

-- ---------------------------------------------------------------------------
-- Attempts (append-only)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_p7_workflow_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  step_id UUID NOT NULL
    REFERENCES edge_p7_workflow_steps(id) ON DELETE RESTRICT,
  attempt_number INTEGER NOT NULL CHECK (attempt_number >= 1),
  worker_id VARCHAR(255) NOT NULL,
  fencing_token BIGINT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  result VARCHAR(64),
  error_class VARCHAR(64),
  retry_classification VARCHAR(64),
  duration_ms INTEGER,
  correlation_id UUID,
  diagnostics JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_p7_workflow_attempts_uniq UNIQUE (step_id, attempt_number)
);

CREATE INDEX IF NOT EXISTS idx_edge_p7_workflow_attempts_step
  ON edge_p7_workflow_attempts (step_id, attempt_number DESC);

-- ---------------------------------------------------------------------------
-- Checkpoints
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_p7_workflow_checkpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL
    REFERENCES edge_p7_workflow_instances(id) ON DELETE RESTRICT,
  step_id UUID
    REFERENCES edge_p7_workflow_steps(id) ON DELETE RESTRICT,
  sequence INTEGER NOT NULL CHECK (sequence >= 1),
  definition_version INTEGER NOT NULL,
  state_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  output_ref TEXT,
  integrity_hash VARCHAR(128),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_p7_workflow_checkpoints_uniq UNIQUE (workflow_id, sequence)
);

CREATE INDEX IF NOT EXISTS idx_edge_p7_workflow_checkpoints_wf
  ON edge_p7_workflow_checkpoints (workflow_id, sequence DESC);

-- ---------------------------------------------------------------------------
-- Compensations
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_p7_workflow_compensations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  step_id UUID NOT NULL
    REFERENCES edge_p7_workflow_steps(id) ON DELETE RESTRICT,
  workflow_id UUID NOT NULL
    REFERENCES edge_p7_workflow_instances(id) ON DELETE RESTRICT,
  handler_key VARCHAR(128) NOT NULL,
  input JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(32) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN (
      'PENDING','READY','RUNNING','SUCCEEDED','FAILED','SKIPPED','CANCELLED'
    )),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  timeout_at TIMESTAMPTZ,
  result JSONB NOT NULL DEFAULT '{}'::jsonb,
  failure_details JSONB NOT NULL DEFAULT '{}'::jsonb,
  execution_order INTEGER NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_p7_workflow_compensations_step_uniq UNIQUE (step_id)
);

CREATE INDEX IF NOT EXISTS idx_edge_p7_workflow_compensations_wf
  ON edge_p7_workflow_compensations (workflow_id, execution_order);

-- ---------------------------------------------------------------------------
-- Human tasks
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_p7_workflow_human_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL
    REFERENCES edge_p7_workflow_instances(id) ON DELETE RESTRICT,
  step_id UUID
    REFERENCES edge_p7_workflow_steps(id) ON DELETE RESTRICT,
  task_type VARCHAR(64) NOT NULL
    CHECK (task_type IN (
      'APPROVAL','REVIEW','MANUAL_ACTION','EXCEPTION_RESOLUTION','COMPENSATION_INTERVENTION'
    )),
  required_permission VARCHAR(128) NOT NULL DEFAULT 'platform:workflow_task:approve',
  assignee VARCHAR(255),
  due_at TIMESTAMPTZ,
  context_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  instructions TEXT,
  decision VARCHAR(64),
  decision_reason TEXT,
  actor_id VARCHAR(255),
  status VARCHAR(32) NOT NULL DEFAULT 'OPEN'
    CHECK (status IN (
      'OPEN','ASSIGNED','IN_PROGRESS','APPROVED','REJECTED','COMPLETED','EXPIRED','CANCELLED'
    )),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edge_p7_workflow_human_tasks_status
  ON edge_p7_workflow_human_tasks (status, due_at);
CREATE INDEX IF NOT EXISTS idx_edge_p7_workflow_human_tasks_wf
  ON edge_p7_workflow_human_tasks (workflow_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- History / DLQ / workers
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_p7_workflow_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_type VARCHAR(64) NOT NULL
    CHECK (resource_type IN (
      'WORKFLOW_DEFINITION','WORKFLOW_INSTANCE','WORKFLOW_STEP','WORKFLOW_TASK',
      'WORKFLOW_COMPENSATION','WORKFLOW_WORKER'
    )),
  resource_id UUID NOT NULL,
  workflow_id UUID,
  from_status VARCHAR(64),
  to_status VARCHAR(64),
  action VARCHAR(128) NOT NULL,
  reason TEXT,
  actor_id VARCHAR(255) NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edge_p7_workflow_history_resource
  ON edge_p7_workflow_history (resource_type, resource_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_edge_p7_workflow_history_wf
  ON edge_p7_workflow_history (workflow_id, created_at DESC)
  WHERE workflow_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS edge_p7_workflow_dead_letters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL
    REFERENCES edge_p7_workflow_instances(id) ON DELETE RESTRICT,
  step_id UUID
    REFERENCES edge_p7_workflow_steps(id) ON DELETE RESTRICT,
  reason TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(32) NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN','RESOLVED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by VARCHAR(255)
);

CREATE INDEX IF NOT EXISTS idx_edge_p7_workflow_dead_letters_open
  ON edge_p7_workflow_dead_letters (status, created_at DESC);

CREATE TABLE IF NOT EXISTS edge_p7_workflow_worker_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id VARCHAR(255) NOT NULL,
  identity VARCHAR(255) NOT NULL,
  worker_version VARCHAR(64) NOT NULL DEFAULT '1.0.0',
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE','DRAINING','OFFLINE','REVOKED')),
  last_heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_p7_workflow_worker_registry_worker_id UNIQUE (worker_id)
);

CREATE INDEX IF NOT EXISTS idx_edge_p7_workflow_worker_heartbeat
  ON edge_p7_workflow_worker_registry (status, last_heartbeat_at);

-- ---------------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------------

INSERT INTO edge_permissions (code, description) VALUES
  ('platform:workflow:read', 'Read workflow instances, steps, attempts, history'),
  ('platform:workflow:manage', 'Create and manage workflow instances'),
  ('platform:workflow:pause', 'Pause workflow instances'),
  ('platform:workflow:resume', 'Resume workflow instances'),
  ('platform:workflow:cancel', 'Cancel workflow instances'),
  ('platform:workflow:retry', 'Retry workflow steps or instances'),
  ('platform:workflow:reconcile', 'Reconcile workflow state'),
  ('platform:workflow_definition:read', 'Read workflow definitions'),
  ('platform:workflow_definition:manage', 'Create and edit workflow definitions'),
  ('platform:workflow_definition:publish', 'Validate, publish, deprecate definitions'),
  ('platform:workflow_task:read', 'Read human workflow tasks'),
  ('platform:workflow_task:assign', 'Assign human workflow tasks'),
  ('platform:workflow_task:approve', 'Approve human workflow tasks'),
  ('platform:workflow_task:reject', 'Reject human workflow tasks'),
  ('platform:workflow:worker', 'Machine worker claim/lease/complete operations')
ON CONFLICT (code) DO NOTHING;

INSERT INTO edge_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM edge_roles r
CROSS JOIN edge_permissions p
WHERE r.code = 'EDGE_PLATFORM_SUPER_ADMIN'
  AND (
    p.code LIKE 'platform:workflow:%'
    OR p.code LIKE 'platform:workflow_definition:%'
    OR p.code LIKE 'platform:workflow_task:%'
  )
ON CONFLICT DO NOTHING;

INSERT INTO edge_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM edge_roles r
INNER JOIN edge_permissions p ON p.code IN (
  'platform:workflow:read',
  'platform:workflow:pause',
  'platform:workflow:resume',
  'platform:workflow:cancel',
  'platform:workflow:retry',
  'platform:workflow_definition:read',
  'platform:workflow_task:read',
  'platform:workflow_task:assign',
  'platform:workflow_task:approve',
  'platform:workflow_task:reject'
)
WHERE r.code = 'EDGE_PLATFORM_OPERATOR'
ON CONFLICT DO NOTHING;

INSERT INTO schema_migrations (version)
VALUES ('099_edge_p7_durable_workflow_engine')
ON CONFLICT DO NOTHING;
