-- Migration 095: P7.1 — Provisioning Authorization Foundation
-- Durable authorization verification + provisioning requests + history.
-- No tenant infrastructure, Keycloak, or Business Backend side effects.

-- ---------------------------------------------------------------------------
-- Verified / stored provisioning authorizations (P7 consumption view)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_provisioning_authorizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  authorization_id UUID NOT NULL,
  authorization_version INTEGER NOT NULL CHECK (authorization_version >= 1),
  schema_version VARCHAR(64) NOT NULL DEFAULT 'p5.provisioning_authorization.v1',
  authorization_type VARCHAR(32) NOT NULL
    CHECK (authorization_type IN (
      'PROVISION','SUSPEND','RESUME','DECOMMISSION','UPDATE','MIGRATE'
    )),
  operation VARCHAR(128) NOT NULL,
  account_id UUID NOT NULL,
  subscription_id UUID NOT NULL,
  product_id UUID NOT NULL,
  product_tenant_id UUID,
  correlation_id UUID NOT NULL,
  causation_id UUID,
  idempotency_key VARCHAR(255) NOT NULL,
  decision VARCHAR(16) NOT NULL CHECK (decision IN ('ALLOW','DENY')),
  authorization_status VARCHAR(32) NOT NULL
    CHECK (authorization_status IN (
      'ISSUED','ACTIVE','REVOKED','EXPIRED','SUPERSEDED'
    )),
  decision_reason_code VARCHAR(128),
  decision_timestamp TIMESTAMPTZ NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL,
  not_before TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  entitlement_snapshot_reference VARCHAR(255) NOT NULL,
  entitlement_version VARCHAR(128) NOT NULL,
  subscription_version VARCHAR(128),
  commercial_policy_version VARCHAR(128),
  contract_reference VARCHAR(255),
  billing_evaluation_reference VARCHAR(255),
  issuer VARCHAR(255) NOT NULL,
  audience VARCHAR(255) NOT NULL DEFAULT 'okapi.edge.p7'
    CHECK (audience = 'okapi.edge.p7'),
  key_id VARCHAR(128) NOT NULL,
  signature_algorithm VARCHAR(32) NOT NULL
    CHECK (signature_algorithm IN ('EdDSA','RS256','ES256','none_digest_only')),
  payload_digest VARCHAR(128) NOT NULL,
  signature_present BOOLEAN NOT NULL DEFAULT FALSE,
  issued_by_service_identity VARCHAR(255) NOT NULL,
  revocation_status VARCHAR(16) NOT NULL DEFAULT 'NOT_REVOKED'
    CHECK (revocation_status IN ('NOT_REVOKED','REVOKED')),
  revocation_version INTEGER CHECK (revocation_version IS NULL OR revocation_version >= 1),
  revoked_at TIMESTAMPTZ,
  revocation_reason_code VARCHAR(128),
  revocation_reference VARCHAR(255),
  environment_slot VARCHAR(32) NOT NULL DEFAULT 'PROD'
    CHECK (environment_slot IN ('PROD','STAGING','DR','TEMP_TEST')),
  verification_status VARCHAR(32) NOT NULL DEFAULT 'PENDING'
    CHECK (verification_status IN (
      'PENDING','VERIFIED','REJECTED','REVOKED','EXPIRED'
    )),
  verification_reason_code VARCHAR(128),
  verified_at TIMESTAMPTZ,
  payload_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_provisioning_authorizations_auth_version_key
    UNIQUE (authorization_id, authorization_version)
);

CREATE INDEX IF NOT EXISTS idx_edge_prov_auth_subscription
  ON edge_provisioning_authorizations (subscription_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_edge_prov_auth_account_product
  ON edge_provisioning_authorizations (account_id, product_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_edge_prov_auth_status
  ON edge_provisioning_authorizations (authorization_status, revocation_status);

CREATE INDEX IF NOT EXISTS idx_edge_prov_auth_idempotency
  ON edge_provisioning_authorizations (idempotency_key);

-- ---------------------------------------------------------------------------
-- Durable provisioning requests (P7.1 — not a technical workflow)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_p7_provisioning_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number VARCHAR(64) NOT NULL,
  authorization_id UUID NOT NULL,
  authorization_version INTEGER NOT NULL CHECK (authorization_version >= 1),
  authorization_row_id UUID REFERENCES edge_provisioning_authorizations(id),
  operation VARCHAR(128) NOT NULL,
  account_id UUID NOT NULL,
  product_id UUID NOT NULL,
  subscription_id UUID NOT NULL,
  product_tenant_id UUID,
  correlation_id UUID NOT NULL,
  causation_id UUID,
  request_status VARCHAR(32) NOT NULL DEFAULT 'REQUESTED'
    CHECK (request_status IN (
      'REQUESTED','ACCEPTED','REJECTED','CANCELLED','FAILED'
    )),
  environment_slot VARCHAR(32) NOT NULL DEFAULT 'PROD'
    CHECK (environment_slot IN ('PROD','STAGING','DR','TEMP_TEST')),
  idempotency_key VARCHAR(255) NOT NULL,
  deduplication_reference VARCHAR(255),
  payload_digest VARCHAR(128),
  entitlement_snapshot_reference VARCHAR(255),
  policy_version VARCHAR(128),
  rejection_reason_code VARCHAR(128),
  cancellation_reason TEXT,
  source VARCHAR(64) NOT NULL DEFAULT 'P5_COORDINATION',
  created_by VARCHAR(255),
  last_actor VARCHAR(255),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  last_transition_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_p7_prov_req_number_key UNIQUE (request_number),
  CONSTRAINT edge_p7_prov_req_auth_op_version_key
    UNIQUE (authorization_id, operation, authorization_version),
  CONSTRAINT edge_p7_prov_req_idempotency_key UNIQUE (idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_edge_p7_prov_req_status
  ON edge_p7_provisioning_requests (request_status, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_edge_p7_prov_req_subscription
  ON edge_p7_provisioning_requests (subscription_id, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_edge_p7_prov_req_account_product
  ON edge_p7_provisioning_requests (account_id, product_id, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_edge_p7_prov_req_correlation
  ON edge_p7_provisioning_requests (correlation_id);

-- ---------------------------------------------------------------------------
-- Append-only request history
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_p7_provisioning_request_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES edge_p7_provisioning_requests(id) ON DELETE RESTRICT,
  previous_status VARCHAR(32),
  new_status VARCHAR(32) NOT NULL
    CHECK (new_status IN (
      'REQUESTED','ACCEPTED','REJECTED','CANCELLED','FAILED'
    )),
  actor_type VARCHAR(32) NOT NULL DEFAULT 'SYSTEM'
    CHECK (actor_type IN ('SYSTEM','OPERATOR','SERVICE','EVENT')),
  actor_id VARCHAR(255),
  source VARCHAR(64) NOT NULL,
  reason_code VARCHAR(128),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  correlation_id UUID,
  causation_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_edge_p7_prov_req_history_request
  ON edge_p7_provisioning_request_history (request_id, occurred_at ASC);

-- ---------------------------------------------------------------------------
-- Revocation event inbox (dedup)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_p7_authorization_revocation_inbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL,
  authorization_id UUID NOT NULL,
  revocation_version INTEGER NOT NULL CHECK (revocation_version >= 1),
  event_name VARCHAR(128) NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  outcome VARCHAR(32) NOT NULL DEFAULT 'APPLIED'
    CHECK (outcome IN ('APPLIED','DUPLICATE','REJECTED','IGNORED_STALE')),
  rejection_reason VARCHAR(255),
  CONSTRAINT edge_p7_revocation_inbox_event_key UNIQUE (event_id),
  CONSTRAINT edge_p7_revocation_inbox_auth_version_key
    UNIQUE (authorization_id, revocation_version)
);

CREATE INDEX IF NOT EXISTS idx_edge_p7_revocation_inbox_auth
  ON edge_p7_authorization_revocation_inbox (authorization_id, revocation_version DESC);

-- ---------------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------------

INSERT INTO edge_permissions (code, description) VALUES
  ('platform:provisioning_requests:read', 'List and view P7 provisioning requests'),
  ('platform:provisioning_requests:read_history', 'View provisioning request history'),
  ('platform:provisioning_requests:cancel', 'Cancel eligible provisioning requests'),
  ('platform:provisioning_authorizations:read', 'View verified provisioning authorization summaries')
ON CONFLICT (code) DO NOTHING;

INSERT INTO edge_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM edge_roles r
CROSS JOIN edge_permissions p
WHERE r.code = 'EDGE_PLATFORM_SUPER_ADMIN'
  AND p.code IN (
    'platform:provisioning_requests:read',
    'platform:provisioning_requests:read_history',
    'platform:provisioning_requests:cancel',
    'platform:provisioning_authorizations:read'
  )
ON CONFLICT DO NOTHING;

INSERT INTO edge_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM edge_roles r
INNER JOIN edge_permissions p ON p.code IN (
  'platform:provisioning_requests:read',
  'platform:provisioning_requests:read_history',
  'platform:provisioning_requests:cancel',
  'platform:provisioning_authorizations:read'
)
WHERE r.code = 'EDGE_PLATFORM_OPERATOR'
ON CONFLICT DO NOTHING;

INSERT INTO schema_migrations (version) VALUES ('095_edge_p7_provisioning_authorization_foundation')
ON CONFLICT DO NOTHING;
