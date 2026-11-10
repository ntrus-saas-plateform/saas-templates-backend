-- Migration 089: P5 — Billing/provisioning coordination, policies, approvals, idempotency
-- No invoice or payment tables (P6). No tenant runtime tables (P7).

-- ---------------------------------------------------------------------------
-- Billing coordination (P6 audit trail)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_subscription_billing_coordination (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES edge_subscriptions(id) ON DELETE CASCADE,
  outcome VARCHAR(32) NOT NULL DEFAULT 'REQUESTED'
    CHECK (outcome IN (
      'REQUESTED','ACCEPTED','CONFIRMED','REJECTED','FAILED','UNAVAILABLE'
    )),
  billing_account_ref VARCHAR(255),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  external_ref VARCHAR(255),
  failure_message TEXT,
  correlation_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_edge_subscription_billing_coordination_sub
  ON edge_subscription_billing_coordination (subscription_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_edge_subscription_billing_coordination_outcome
  ON edge_subscription_billing_coordination (subscription_id, outcome)
  WHERE outcome IN ('REQUESTED','ACCEPTED');

-- ---------------------------------------------------------------------------
-- Provisioning requests (P7 audit trail)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_subscription_provisioning_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES edge_subscriptions(id) ON DELETE CASCADE,
  outcome VARCHAR(32) NOT NULL DEFAULT 'REQUESTED'
    CHECK (outcome IN (
      'REQUESTED','ACCEPTED','COMPLETE','REJECTED','FAILED','UNAVAILABLE'
    )),
  tenant_ref VARCHAR(255),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  external_ref VARCHAR(255),
  failure_message TEXT,
  correlation_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  CONSTRAINT edge_subscription_provisioning_requests_correlation_key UNIQUE (correlation_id)
);

CREATE INDEX IF NOT EXISTS idx_edge_subscription_provisioning_requests_sub
  ON edge_subscription_provisioning_requests (subscription_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Activation / enterprise policy registry
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_subscription_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(64) NOT NULL,
  policy_type VARCHAR(64) NOT NULL DEFAULT 'ACTIVATION'
    CHECK (policy_type IN ('ACTIVATION','ENTERPRISE','RENEWAL','TRIAL','OTHER')),
  rules JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE','INACTIVE')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_subscription_policies_code_key UNIQUE (code)
);

-- ---------------------------------------------------------------------------
-- Approval decisions (subscription or change request)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_subscription_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID REFERENCES edge_subscriptions(id) ON DELETE CASCADE,
  change_request_id UUID REFERENCES edge_subscription_change_requests(id) ON DELETE CASCADE,
  approval_type VARCHAR(64) NOT NULL
    CHECK (approval_type IN (
      'SUBSCRIPTION_ACTIVATION','CHANGE_REQUEST','ENTERPRISE','TRIAL','OTHER'
    )),
  status VARCHAR(32) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING','APPROVED','REJECTED','WITHDRAWN')),
  requested_by UUID,
  decision_by UUID,
  decision_note TEXT,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (subscription_id IS NOT NULL OR change_request_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_edge_subscription_approvals_subscription
  ON edge_subscription_approvals (subscription_id, status)
  WHERE subscription_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_edge_subscription_approvals_change_request
  ON edge_subscription_approvals (change_request_id, status)
  WHERE change_request_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- API mutation idempotency
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_subscription_idempotency_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key VARCHAR(128) NOT NULL,
  operation VARCHAR(128) NOT NULL,
  resource_type VARCHAR(64) NOT NULL,
  resource_id UUID,
  response_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_subscription_idempotency_keys_key UNIQUE (idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_edge_subscription_idempotency_keys_resource
  ON edge_subscription_idempotency_keys (resource_type, resource_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Default activation gates policy
-- ---------------------------------------------------------------------------

INSERT INTO edge_subscription_policies (code, policy_type, rules, status)
VALUES (
  'ACTIVATION_GATES',
  'ACTIVATION',
  '{"provisioningRequired":true,"billingRequired":false}'::jsonb,
  'ACTIVE'
)
ON CONFLICT (code) DO NOTHING;

INSERT INTO schema_migrations (version) VALUES ('089_edge_subscription_coordination_governance')
ON CONFLICT DO NOTHING;
