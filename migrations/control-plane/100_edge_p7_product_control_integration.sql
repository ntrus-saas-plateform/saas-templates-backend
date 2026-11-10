-- Migration 100: P7.5 — Product Control Integration FOUNDATION
-- Durable endpoints, negotiated contracts, exchanges, callbacks, health, reconciliation.
-- Reuses P7.2 product/platform/environment registry (no second product registry).
-- Secrets: credential_ref opaque handles only — never plaintext credentials.
-- Note: P7.2 already owns edge_p7_product_control_contracts (published registry).
--       P7.5 discovery snapshots use edge_p7_product_control_negotiated_contracts.

-- ---------------------------------------------------------------------------
-- Endpoints
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_p7_product_control_endpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_registry_id UUID NOT NULL
    REFERENCES edge_p7_product_registry(id) ON DELETE RESTRICT,
  product_id UUID NOT NULL
    REFERENCES edge_products(id) ON DELETE RESTRICT,
  platform_id UUID NOT NULL
    REFERENCES edge_p7_product_platforms(id) ON DELETE RESTRICT,
  environment_id UUID
    REFERENCES edge_p7_runtime_environments(id) ON DELETE RESTRICT,
  deployment_profile_id UUID
    REFERENCES edge_p7_deployment_profiles(id) ON DELETE RESTRICT,
  -- optional link to P7.2 published registry contract
  registry_contract_id UUID
    REFERENCES edge_p7_product_control_contracts(id) ON DELETE RESTRICT,
  code VARCHAR(128) NOT NULL,
  base_url TEXT NOT NULL,
  api_version VARCHAR(64) NOT NULL DEFAULT 'v1',
  contract_version VARCHAR(64) NOT NULL,
  auth_profile VARCHAR(64) NOT NULL DEFAULT 'OAUTH2_CC'
    CHECK (auth_profile IN (
      'OAUTH2_CC','MTLS','OAUTH2_CC_MTLS','HMAC_SIGNED','CUSTOM'
    )),
  credential_ref VARCHAR(512) NOT NULL,
  allowed_scopes JSONB NOT NULL DEFAULT '[]'::jsonb,
  status VARCHAR(32) NOT NULL DEFAULT 'PENDING_VALIDATION'
    CHECK (status IN (
      'PENDING_VALIDATION','VALIDATING','ACTIVE','DEGRADED',
      'UNAVAILABLE','QUARANTINED','REVOKED'
    )),
  contract_fingerprint VARCHAR(128),
  identity_fingerprint VARCHAR(128),
  registration_source VARCHAR(64) NOT NULL DEFAULT 'MANUAL',
  last_handshake_at TIMESTAMPTZ,
  last_handshake_status VARCHAR(32),
  last_handshake_error TEXT,
  last_health_check_at TIMESTAMPTZ,
  last_health_status VARCHAR(32),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_by VARCHAR(255),
  updated_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_p7_pci_endpoints_code_key UNIQUE (code),
  CONSTRAINT edge_p7_pci_endpoints_product_platform_env_key
    UNIQUE (product_id, platform_id, environment_id, base_url)
);

CREATE INDEX IF NOT EXISTS idx_edge_p7_pci_endpoints_status
  ON edge_p7_product_control_endpoints (status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_edge_p7_pci_endpoints_product
  ON edge_p7_product_control_endpoints (product_id, platform_id);
CREATE INDEX IF NOT EXISTS idx_edge_p7_pci_endpoints_registry
  ON edge_p7_product_control_endpoints (product_registry_id);

-- ---------------------------------------------------------------------------
-- Negotiated / discovered contract snapshots (per endpoint)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_p7_product_control_negotiated_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_id UUID NOT NULL
    REFERENCES edge_p7_product_control_endpoints(id) ON DELETE RESTRICT,
  contract_version VARCHAR(64) NOT NULL,
  fingerprint VARCHAR(128) NOT NULL,
  schema_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  supported_versions JSONB NOT NULL DEFAULT '[]'::jsonb,
  status VARCHAR(32) NOT NULL DEFAULT 'DISCOVERED'
    CHECK (status IN (
      'DISCOVERED','VALIDATING','COMPATIBLE','INCOMPATIBLE',
      'DEPRECATED','REVOKED'
    )),
  discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  validated_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_p7_pci_negotiated_contract_version_key
    UNIQUE (endpoint_id, contract_version, fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_edge_p7_pci_negotiated_contracts_endpoint
  ON edge_p7_product_control_negotiated_contracts (endpoint_id, status);

-- ---------------------------------------------------------------------------
-- Declared capabilities (discovery)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_p7_product_control_capabilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_id UUID NOT NULL
    REFERENCES edge_p7_product_control_endpoints(id) ON DELETE RESTRICT,
  capability_code VARCHAR(128) NOT NULL,
  declared_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_p7_pci_capabilities_endpoint_code_key
    UNIQUE (endpoint_id, capability_code)
);

CREATE INDEX IF NOT EXISTS idx_edge_p7_pci_capabilities_code
  ON edge_p7_product_control_capabilities (capability_code);

-- ---------------------------------------------------------------------------
-- Durable control exchanges
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_p7_product_control_exchanges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL
    REFERENCES edge_products(id) ON DELETE RESTRICT,
  endpoint_id UUID NOT NULL
    REFERENCES edge_p7_product_control_endpoints(id) ON DELETE RESTRICT,
  workflow_id UUID,
  step_id UUID,
  operation_code VARCHAR(128) NOT NULL,
  contract_version VARCHAR(64) NOT NULL,
  request_id UUID NOT NULL,
  correlation_id UUID NOT NULL,
  causation_id UUID,
  idempotency_key VARCHAR(255) NOT NULL,
  request_digest VARCHAR(128),
  response_digest VARCHAR(128),
  request_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  response_timestamp TIMESTAMPTZ,
  status VARCHAR(32) NOT NULL DEFAULT 'CREATED'
    CHECK (status IN (
      'CREATED','QUEUED','SENDING','SENT','ACKNOWLEDGED','SUCCEEDED',
      'FAILED','RETRY_PENDING','UNKNOWN_OUTCOME','RECONCILIATION_REQUIRED',
      'RECONCILED','CANCELLED'
    )),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  http_status INTEGER,
  error_classification VARCHAR(64),
  duration_ms INTEGER,
  retry_eligible BOOLEAN NOT NULL DEFAULT FALSE,
  reconciliation_status VARCHAR(32) NOT NULL DEFAULT 'NONE'
    CHECK (reconciliation_status IN (
      'NONE','REQUIRED','IN_PROGRESS','RECONCILED','ABANDONED'
    )),
  request_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  response_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  diagnostics JSONB NOT NULL DEFAULT '{}'::jsonb,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_p7_pci_exchanges_idempotency_key UNIQUE (idempotency_key),
  CONSTRAINT edge_p7_pci_exchanges_request_id_key UNIQUE (request_id)
);

CREATE INDEX IF NOT EXISTS idx_edge_p7_pci_exchanges_status
  ON edge_p7_product_control_exchanges (status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_edge_p7_pci_exchanges_endpoint
  ON edge_p7_product_control_exchanges (endpoint_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_edge_p7_pci_exchanges_corr
  ON edge_p7_product_control_exchanges (correlation_id);
CREATE INDEX IF NOT EXISTS idx_edge_p7_pci_exchanges_workflow
  ON edge_p7_product_control_exchanges (workflow_id)
  WHERE workflow_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_edge_p7_pci_exchanges_reconcile
  ON edge_p7_product_control_exchanges (reconciliation_status, status)
  WHERE reconciliation_status IN ('REQUIRED','IN_PROGRESS');

-- ---------------------------------------------------------------------------
-- Exchange attempts
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_p7_product_control_exchange_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exchange_id UUID NOT NULL
    REFERENCES edge_p7_product_control_exchanges(id) ON DELETE RESTRICT,
  attempt_number INTEGER NOT NULL CHECK (attempt_number >= 1),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  outcome VARCHAR(32) NOT NULL DEFAULT 'STARTED'
    CHECK (outcome IN (
      'STARTED','SENT','ACKNOWLEDGED','SUCCEEDED','FAILED',
      'TIMEOUT','UNKNOWN_OUTCOME','CANCELLED'
    )),
  http_status INTEGER,
  error_classification VARCHAR(64),
  duration_ms INTEGER,
  request_digest VARCHAR(128),
  response_digest VARCHAR(128),
  diagnostics JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_p7_pci_exchange_attempts_uniq
    UNIQUE (exchange_id, attempt_number)
);

CREATE INDEX IF NOT EXISTS idx_edge_p7_pci_exchange_attempts_ex
  ON edge_p7_product_control_exchange_attempts (exchange_id, attempt_number DESC);

-- ---------------------------------------------------------------------------
-- Callbacks / webhook inbox
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_p7_product_control_callbacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_id UUID NOT NULL
    REFERENCES edge_p7_product_control_endpoints(id) ON DELETE RESTRICT,
  exchange_id UUID
    REFERENCES edge_p7_product_control_exchanges(id) ON DELETE SET NULL,
  callback_id VARCHAR(255) NOT NULL,
  correlation_id UUID,
  request_id UUID,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  signature_valid BOOLEAN,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(32) NOT NULL DEFAULT 'RECEIVED'
    CHECK (status IN (
      'RECEIVED','VALIDATED','REJECTED','DUPLICATE','APPLIED','EXPIRED'
    )),
  rejection_reason TEXT,
  idempotency_key VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_p7_pci_callbacks_idempotency_key UNIQUE (idempotency_key),
  CONSTRAINT edge_p7_pci_callbacks_callback_id_key UNIQUE (callback_id)
);

CREATE INDEX IF NOT EXISTS idx_edge_p7_pci_callbacks_endpoint
  ON edge_p7_product_control_callbacks (endpoint_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_edge_p7_pci_callbacks_status
  ON edge_p7_product_control_callbacks (status, received_at DESC);

-- ---------------------------------------------------------------------------
-- Health checks
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_p7_product_control_health_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_id UUID NOT NULL
    REFERENCES edge_p7_product_control_endpoints(id) ON DELETE RESTRICT,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  result VARCHAR(32) NOT NULL
    CHECK (result IN ('HEALTHY','DEGRADED','UNAVAILABLE','UNKNOWN')),
  latency_ms INTEGER,
  http_status INTEGER,
  error_classification VARCHAR(64),
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edge_p7_pci_health_endpoint
  ON edge_p7_product_control_health_checks (endpoint_id, checked_at DESC);

-- ---------------------------------------------------------------------------
-- Reconciliation records
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_p7_product_control_reconciliation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exchange_id UUID NOT NULL
    REFERENCES edge_p7_product_control_exchanges(id) ON DELETE RESTRICT,
  endpoint_id UUID NOT NULL
    REFERENCES edge_p7_product_control_endpoints(id) ON DELETE RESTRICT,
  reason VARCHAR(128) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'OPEN'
    CHECK (status IN (
      'OPEN','IN_PROGRESS','RESOLVED_SUCCESS','RESOLVED_FAILURE','ABANDONED'
    )),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by VARCHAR(255),
  resolution_notes TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edge_p7_pci_reconciliation_open
  ON edge_p7_product_control_reconciliation (status, opened_at DESC)
  WHERE status IN ('OPEN','IN_PROGRESS');
CREATE INDEX IF NOT EXISTS idx_edge_p7_pci_reconciliation_exchange
  ON edge_p7_product_control_reconciliation (exchange_id);

-- ---------------------------------------------------------------------------
-- Credential bindings (opaque refs only)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_p7_product_control_credential_bindings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_id UUID NOT NULL
    REFERENCES edge_p7_product_control_endpoints(id) ON DELETE RESTRICT,
  credential_ref VARCHAR(512) NOT NULL,
  auth_profile VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE','ROTATING','REVOKED','EXPIRED')),
  bound_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  revoked_by VARCHAR(255),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_p7_pci_cred_bindings_endpoint_ref_key
    UNIQUE (endpoint_id, credential_ref)
);

CREATE INDEX IF NOT EXISTS idx_edge_p7_pci_cred_bindings_status
  ON edge_p7_product_control_credential_bindings (status, endpoint_id);

-- ---------------------------------------------------------------------------
-- History (immutable audit trail companion)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_p7_product_control_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_type VARCHAR(64) NOT NULL
    CHECK (resource_type IN (
      'ENDPOINT','NEGOTIATED_CONTRACT','CAPABILITY','EXCHANGE',
      'CALLBACK','HEALTH_CHECK','RECONCILIATION','CREDENTIAL_BINDING'
    )),
  resource_id UUID NOT NULL,
  from_status VARCHAR(64),
  to_status VARCHAR(64),
  action VARCHAR(64) NOT NULL,
  reason TEXT,
  actor_id VARCHAR(255) NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edge_p7_pci_history_resource
  ON edge_p7_product_control_history (resource_type, resource_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------------

INSERT INTO edge_permissions (code, description) VALUES
  ('platform:product_control:read', 'Read Product Control endpoints, exchanges, health'),
  ('platform:product_control:manage', 'Create and update Product Control endpoints'),
  ('platform:product_control:validate', 'Validate endpoints and negotiated contracts'),
  ('platform:product_control:handshake', 'Execute Product Control handshake'),
  ('platform:product_control:discover', 'Discover contracts and capabilities'),
  ('platform:product_control:health', 'Run connectivity and health checks'),
  ('platform:product_control:reconcile', 'Reconcile unknown-outcome exchanges'),
  ('platform:product_control:quarantine', 'Quarantine or revoke Product Control endpoints'),
  ('platform:product_control:credentials:manage', 'Bind, rotate, revoke credential refs'),
  ('platform:product_control:history:read', 'Read Product Control history')
ON CONFLICT (code) DO NOTHING;

INSERT INTO edge_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM edge_roles r
CROSS JOIN edge_permissions p
WHERE r.code = 'EDGE_PLATFORM_SUPER_ADMIN'
  AND p.code LIKE 'platform:product_control:%'
ON CONFLICT DO NOTHING;

-- OPERATOR: read + operational non-credential actions (no manage/quarantine/credentials)
INSERT INTO edge_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM edge_roles r
INNER JOIN edge_permissions p ON p.code IN (
  'platform:product_control:read',
  'platform:product_control:handshake',
  'platform:product_control:discover',
  'platform:product_control:health',
  'platform:product_control:reconcile',
  'platform:product_control:history:read'
)
WHERE r.code = 'EDGE_PLATFORM_OPERATOR'
ON CONFLICT DO NOTHING;

INSERT INTO schema_migrations (version)
VALUES ('100_edge_p7_product_control_integration')
ON CONFLICT DO NOTHING;
