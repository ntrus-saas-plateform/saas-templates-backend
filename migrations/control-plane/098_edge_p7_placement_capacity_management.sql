-- Migration 098: P7.3 — Placement & Capacity Management
-- Durable placement requests/decisions, capacity inventory/reservations, policies.
-- No tenant infrastructure, Keycloak, Business Backend, or workflow side effects.

-- ---------------------------------------------------------------------------
-- Placement policies (deterministic scoring + hard gates)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_p7_placement_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  policy_version INTEGER NOT NULL DEFAULT 1 CHECK (policy_version >= 1),
  scope JSONB NOT NULL DEFAULT '{}'::jsonb,
  hard_constraints JSONB NOT NULL DEFAULT '{}'::jsonb,
  scoring_weights JSONB NOT NULL DEFAULT '{}'::jsonb,
  algorithm_version VARCHAR(32) NOT NULL DEFAULT '1.0.0',
  policy_status VARCHAR(32) NOT NULL DEFAULT 'DRAFT'
    CHECK (policy_status IN ('DRAFT','ACTIVE','DEPRECATED','RETIRED')),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_by VARCHAR(255),
  updated_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_p7_placement_policies_code_key UNIQUE (code)
);

CREATE INDEX IF NOT EXISTS idx_edge_p7_placement_policies_status
  ON edge_p7_placement_policies (policy_status, policy_version);

-- ---------------------------------------------------------------------------
-- Placement requests
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_p7_placement_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key VARCHAR(255) NOT NULL,
  correlation_id UUID NOT NULL,
  causation_id UUID,
  provisioning_request_id UUID NOT NULL
    REFERENCES edge_p7_provisioning_requests(id) ON DELETE RESTRICT,
  authorization_row_id UUID NOT NULL
    REFERENCES edge_provisioning_authorizations(id) ON DELETE RESTRICT,
  authorization_id UUID NOT NULL,
  authorization_version INTEGER NOT NULL CHECK (authorization_version >= 1),
  account_id UUID NOT NULL,
  subscription_id UUID NOT NULL,
  product_id UUID NOT NULL,
  product_tenant_id UUID,
  product_registry_id UUID NOT NULL
    REFERENCES edge_p7_product_registry(id) ON DELETE RESTRICT,
  technical_version_id UUID NOT NULL
    REFERENCES edge_p7_product_technical_versions(id) ON DELETE RESTRICT,
  platform_id UUID
    REFERENCES edge_p7_product_platforms(id) ON DELETE RESTRICT,
  contract_id UUID NOT NULL
    REFERENCES edge_p7_product_control_contracts(id) ON DELETE RESTRICT,
  deployment_profile_id UUID NOT NULL
    REFERENCES edge_p7_deployment_profiles(id) ON DELETE RESTRICT,
  requested_environment_type VARCHAR(32) NOT NULL
    CHECK (requested_environment_type IN (
      'DEVELOPMENT','TEST','STAGING','PRODUCTION'
    )),
  requested_deployment_model VARCHAR(64) NOT NULL,
  requested_region VARCHAR(64),
  data_residency_constraints JSONB NOT NULL DEFAULT '{}'::jsonb,
  security_classification VARCHAR(64),
  availability_requirements JSONB NOT NULL DEFAULT '{}'::jsonb,
  recovery_requirements JSONB NOT NULL DEFAULT '{}'::jsonb,
  capacity_requirements JSONB NOT NULL DEFAULT '{}'::jsonb,
  request_status VARCHAR(32) NOT NULL DEFAULT 'PENDING'
    CHECK (request_status IN (
      'PENDING','EVALUATING','PLACED','REQUIRES_REVIEW','NO_CAPACITY',
      'NO_COMPATIBLE_TARGET','REJECTED','EXPIRED','CANCELLED','SUPERSEDED'
    )),
  actor_id VARCHAR(255),
  created_by VARCHAR(255),
  updated_by VARCHAR(255),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_p7_placement_requests_idempotency_key UNIQUE (idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_edge_p7_placement_requests_status
  ON edge_p7_placement_requests (request_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_edge_p7_placement_requests_prov_req
  ON edge_p7_placement_requests (provisioning_request_id);
CREATE INDEX IF NOT EXISTS idx_edge_p7_placement_requests_corr
  ON edge_p7_placement_requests (correlation_id);
CREATE INDEX IF NOT EXISTS idx_edge_p7_placement_requests_account
  ON edge_p7_placement_requests (account_id, product_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Capacity inventory (per environment + resource type)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_p7_capacity_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_id UUID NOT NULL
    REFERENCES edge_p7_product_platforms(id) ON DELETE RESTRICT,
  environment_id UUID NOT NULL
    REFERENCES edge_p7_runtime_environments(id) ON DELETE RESTRICT,
  resource_type VARCHAR(32) NOT NULL
    CHECK (resource_type IN (
      'CPU','MEMORY','STORAGE','DATABASE','CONNECTION',
      'TENANT_SLOT','RUNTIME_INSTANCE','BANDWIDTH'
    )),
  unit VARCHAR(32) NOT NULL,
  total_capacity NUMERIC(20,6) NOT NULL CHECK (total_capacity >= 0),
  unavailable_capacity NUMERIC(20,6) NOT NULL DEFAULT 0 CHECK (unavailable_capacity >= 0),
  reserved_capacity NUMERIC(20,6) NOT NULL DEFAULT 0 CHECK (reserved_capacity >= 0),
  allocated_capacity NUMERIC(20,6) NOT NULL DEFAULT 0 CHECK (allocated_capacity >= 0),
  available_capacity NUMERIC(20,6) GENERATED ALWAYS AS (
    total_capacity - unavailable_capacity - reserved_capacity - allocated_capacity
  ) STORED,
  measurement_source VARCHAR(16) NOT NULL
    CHECK (measurement_source IN ('DECLARED','OBSERVED')),
  measured_at TIMESTAMPTZ NOT NULL,
  valid_until TIMESTAMPTZ NOT NULL,
  capacity_status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE'
    CHECK (capacity_status IN ('ACTIVE','STALE','SUSPENDED','RETIRED')),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by VARCHAR(255),
  updated_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_p7_capacity_inventory_env_type_source_key
    UNIQUE (environment_id, resource_type, measurement_source),
  CONSTRAINT edge_p7_capacity_inventory_available_nonneg_chk CHECK (
    total_capacity - unavailable_capacity - reserved_capacity - allocated_capacity >= 0
  )
);

CREATE INDEX IF NOT EXISTS idx_edge_p7_capacity_inventory_platform_env
  ON edge_p7_capacity_inventory (platform_id, environment_id);
CREATE INDEX IF NOT EXISTS idx_edge_p7_capacity_inventory_status
  ON edge_p7_capacity_inventory (capacity_status, valid_until);

-- ---------------------------------------------------------------------------
-- Placement decisions
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_p7_placement_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  placement_request_id UUID NOT NULL
    REFERENCES edge_p7_placement_requests(id) ON DELETE RESTRICT,
  decision_status VARCHAR(32) NOT NULL
    CHECK (decision_status IN (
      'PENDING','EVALUATING','PLACED','REQUIRES_REVIEW','NO_CAPACITY',
      'NO_COMPATIBLE_TARGET','REJECTED','EXPIRED','CANCELLED','SUPERSEDED'
    )),
  selected_platform_id UUID
    REFERENCES edge_p7_product_platforms(id) ON DELETE RESTRICT,
  selected_environment_id UUID
    REFERENCES edge_p7_runtime_environments(id) ON DELETE RESTRICT,
  selected_profile_id UUID
    REFERENCES edge_p7_deployment_profiles(id) ON DELETE RESTRICT,
  selected_region VARCHAR(64),
  selected_technical_version_id UUID
    REFERENCES edge_p7_product_technical_versions(id) ON DELETE RESTRICT,
  selected_contract_id UUID
    REFERENCES edge_p7_product_control_contracts(id) ON DELETE RESTRICT,
  selected_contract_version VARCHAR(64),
  capacity_reservation_id UUID,
  algorithm_name VARCHAR(128) NOT NULL DEFAULT 'edge.p7.placement.v1',
  algorithm_version VARCHAR(32) NOT NULL DEFAULT '1.0.0',
  policy_id UUID
    REFERENCES edge_p7_placement_policies(id) ON DELETE RESTRICT,
  policy_version INTEGER CHECK (policy_version IS NULL OR policy_version >= 1),
  evaluation_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  scoring_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
  policy_evaluation_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  rejection_summary TEXT,
  decided_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  actor_id VARCHAR(255),
  correlation_id UUID NOT NULL,
  idempotency_key VARCHAR(255),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_p7_placement_decisions_idempotency_key UNIQUE (idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_edge_p7_placement_decisions_request
  ON edge_p7_placement_decisions (placement_request_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_edge_p7_placement_decisions_status
  ON edge_p7_placement_decisions (decision_status, decided_at DESC);

-- ---------------------------------------------------------------------------
-- Capacity reservations
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_p7_capacity_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  placement_request_id UUID NOT NULL
    REFERENCES edge_p7_placement_requests(id) ON DELETE RESTRICT,
  placement_decision_id UUID
    REFERENCES edge_p7_placement_decisions(id) ON DELETE RESTRICT,
  platform_id UUID NOT NULL
    REFERENCES edge_p7_product_platforms(id) ON DELETE RESTRICT,
  environment_id UUID NOT NULL
    REFERENCES edge_p7_runtime_environments(id) ON DELETE RESTRICT,
  resource_quantities JSONB NOT NULL,
  reservation_status VARCHAR(32) NOT NULL DEFAULT 'HELD'
    CHECK (reservation_status IN (
      'HELD','COMMITTED','RELEASED','EXPIRED','CANCELLED','FAILED'
    )),
  idempotency_key VARCHAR(255) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  released_at TIMESTAMPTZ,
  release_reason TEXT,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by VARCHAR(255),
  CONSTRAINT edge_p7_capacity_reservations_idempotency_key UNIQUE (idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_edge_p7_capacity_reservations_status
  ON edge_p7_capacity_reservations (reservation_status, expires_at);
CREATE INDEX IF NOT EXISTS idx_edge_p7_capacity_reservations_env
  ON edge_p7_capacity_reservations (environment_id, reservation_status);
CREATE INDEX IF NOT EXISTS idx_edge_p7_capacity_reservations_request
  ON edge_p7_capacity_reservations (placement_request_id);

-- Circular FK: decision → reservation (nullable, after reservations exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'edge_p7_placement_decisions_reservation_fk'
  ) THEN
    ALTER TABLE edge_p7_placement_decisions
      ADD CONSTRAINT edge_p7_placement_decisions_reservation_fk
      FOREIGN KEY (capacity_reservation_id)
      REFERENCES edge_p7_capacity_reservations(id) ON DELETE RESTRICT;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Candidate evaluations (audit trail of scored candidates)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_p7_placement_candidate_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id UUID NOT NULL
    REFERENCES edge_p7_placement_decisions(id) ON DELETE CASCADE,
  placement_request_id UUID NOT NULL
    REFERENCES edge_p7_placement_requests(id) ON DELETE RESTRICT,
  platform_id UUID NOT NULL
    REFERENCES edge_p7_product_platforms(id) ON DELETE RESTRICT,
  environment_id UUID NOT NULL
    REFERENCES edge_p7_runtime_environments(id) ON DELETE RESTRICT,
  profile_id UUID NOT NULL
    REFERENCES edge_p7_deployment_profiles(id) ON DELETE RESTRICT,
  rank INTEGER CHECK (rank IS NULL OR rank >= 1),
  passed_hard_constraints BOOLEAN NOT NULL DEFAULT FALSE,
  hard_constraint_failures JSONB NOT NULL DEFAULT '[]'::jsonb,
  compatibility_result VARCHAR(32)
    CHECK (compatibility_result IS NULL OR compatibility_result IN (
      'COMPATIBLE','INCOMPATIBLE','REQUIRES_REVIEW'
    )),
  score NUMERIC(12,4),
  scoring_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
  capacity_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  excluded BOOLEAN NOT NULL DEFAULT FALSE,
  exclusion_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edge_p7_placement_candidates_decision
  ON edge_p7_placement_candidate_evaluations (decision_id, rank ASC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_edge_p7_placement_candidates_request
  ON edge_p7_placement_candidate_evaluations (placement_request_id);

-- ---------------------------------------------------------------------------
-- Placement history (append-only)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_p7_placement_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_type VARCHAR(64) NOT NULL
    CHECK (resource_type IN (
      'PLACEMENT_REQUEST','PLACEMENT_DECISION','CAPACITY_INVENTORY',
      'CAPACITY_RESERVATION','PLACEMENT_POLICY','CANDIDATE_EVALUATION'
    )),
  resource_id UUID NOT NULL,
  from_status VARCHAR(64),
  to_status VARCHAR(64),
  action VARCHAR(128) NOT NULL,
  reason TEXT,
  actor_id VARCHAR(255) NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edge_p7_placement_history_resource
  ON edge_p7_placement_history (resource_type, resource_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------------

INSERT INTO edge_permissions (code, description) VALUES
  ('platform:placement:read', 'Read placement requests and decisions'),
  ('platform:placement:request', 'Create placement requests'),
  ('platform:placement:evaluate', 'Evaluate placement for a request'),
  ('platform:placement:confirm', 'Confirm a placed decision'),
  ('platform:placement:cancel', 'Cancel a placement request or decision'),
  ('platform:capacity:read', 'Read capacity inventory and reservations'),
  ('platform:capacity:manage', 'Create/update capacity inventory'),
  ('platform:capacity:reserve', 'Reserve capacity against inventory'),
  ('platform:capacity:release', 'Release or expire capacity reservations'),
  ('platform:placement_policy:read', 'Read placement policies'),
  ('platform:placement_policy:manage', 'Create/update placement policies')
ON CONFLICT (code) DO NOTHING;

INSERT INTO edge_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM edge_roles r
CROSS JOIN edge_permissions p
WHERE r.code = 'EDGE_PLATFORM_SUPER_ADMIN'
  AND (
    p.code LIKE 'platform:placement:%'
    OR p.code LIKE 'platform:capacity:%'
    OR p.code LIKE 'platform:placement_policy:%'
  )
ON CONFLICT DO NOTHING;

INSERT INTO edge_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM edge_roles r
INNER JOIN edge_permissions p ON p.code IN (
  'platform:placement:read',
  'platform:placement:request',
  'platform:placement:evaluate',
  'platform:placement:confirm',
  'platform:placement:cancel',
  'platform:capacity:read',
  'platform:capacity:manage',
  'platform:capacity:reserve',
  'platform:capacity:release',
  'platform:placement_policy:read'
)
WHERE r.code = 'EDGE_PLATFORM_OPERATOR'
ON CONFLICT DO NOTHING;

INSERT INTO schema_migrations (version) VALUES ('098_edge_p7_placement_capacity_management')
ON CONFLICT DO NOTHING;
