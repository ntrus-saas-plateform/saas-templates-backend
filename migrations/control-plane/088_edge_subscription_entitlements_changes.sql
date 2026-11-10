-- Migration 088: P5 — Entitlement snapshots, publications, changes, renewals, trials, suspend/cancel
-- Snapshots are insert-only in application semantics; corrections use new version + publication.

-- ---------------------------------------------------------------------------
-- Entitlement snapshots (immutable versions)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_entitlement_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES edge_subscriptions(id) ON DELETE CASCADE,
  version INT NOT NULL,
  period_id UUID REFERENCES edge_subscription_periods(id) ON DELETE SET NULL,
  entitlements JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_offer_versions JSONB NOT NULL DEFAULT '{}'::jsonb,
  calculation_version VARCHAR(64),
  reason TEXT,
  correlation_id UUID,
  valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (subscription_id, version)
);

COMMENT ON TABLE edge_entitlement_snapshots IS
  'Insert-only entitlement payloads; application must never UPDATE rows — publish new version instead.';

CREATE INDEX IF NOT EXISTS idx_edge_entitlement_snapshots_subscription
  ON edge_entitlement_snapshots (subscription_id, version DESC);

-- ---------------------------------------------------------------------------
-- Entitlement publications (downstream publish / reconcile)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_entitlement_publications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES edge_subscriptions(id) ON DELETE CASCADE,
  snapshot_id UUID NOT NULL REFERENCES edge_entitlement_snapshots(id) ON DELETE RESTRICT,
  status VARCHAR(32) NOT NULL DEFAULT 'REQUESTED'
    CHECK (status IN ('REQUESTED','PUBLISHED','FAILED','RECONCILED')),
  external_ack VARCHAR(255),
  failure_message TEXT,
  correlation_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_edge_entitlement_publications_subscription
  ON edge_entitlement_publications (subscription_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_edge_entitlement_publications_snapshot
  ON edge_entitlement_publications (snapshot_id);

-- ---------------------------------------------------------------------------
-- Governed change requests
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_subscription_change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES edge_subscriptions(id) ON DELETE CASCADE,
  change_type VARCHAR(64) NOT NULL
    CHECK (change_type IN (
      'PLAN_CHANGE','ADDON_ADD','ADDON_REMOVE','QUANTITY_CHANGE',
      'BILLING_FREQUENCY','ENTERPRISE_OVERLAY','OTHER'
    )),
  current_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  proposed_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  requested_effective_at TIMESTAMPTZ,
  requested_by UUID,
  reason TEXT,
  approval_status VARCHAR(32) NOT NULL DEFAULT 'PENDING'
    CHECK (approval_status IN ('PENDING','APPROVED','REJECTED','WITHDRAWN','NOT_REQUIRED')),
  pricing_impact JSONB NOT NULL DEFAULT '{}'::jsonb,
  entitlement_impact JSONB NOT NULL DEFAULT '{}'::jsonb,
  billing_impact_ref VARCHAR(255),
  provisioning_impact JSONB NOT NULL DEFAULT '{}'::jsonb,
  execution_status VARCHAR(32) NOT NULL DEFAULT 'PENDING'
    CHECK (execution_status IN (
      'PENDING','SCHEDULED','IN_PROGRESS','COMPLETED','FAILED','CANCELLED'
    )),
  correlation_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edge_subscription_change_requests_sub
  ON edge_subscription_change_requests (subscription_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_edge_subscription_change_requests_approval
  ON edge_subscription_change_requests (approval_status, execution_status);

-- ---------------------------------------------------------------------------
-- Scheduled execution of approved changes
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_subscription_scheduled_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  change_request_id UUID NOT NULL REFERENCES edge_subscription_change_requests(id) ON DELETE CASCADE,
  execute_at TIMESTAMPTZ NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'SCHEDULED'
    CHECK (status IN ('SCHEDULED','EXECUTED','FAILED','CANCELLED')),
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edge_subscription_scheduled_changes_execute
  ON edge_subscription_scheduled_changes (status, execute_at)
  WHERE status = 'SCHEDULED';

-- ---------------------------------------------------------------------------
-- Renewals
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_subscription_renewals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES edge_subscriptions(id) ON DELETE CASCADE,
  renewal_status VARCHAR(32) NOT NULL DEFAULT 'OFFERED'
    CHECK (renewal_status IN (
      'OFFERED','ACCEPTED','DECLINED','IN_PROGRESS','COMPLETED','FAILED','EXPIRED'
    )),
  offered_at TIMESTAMPTZ,
  due_at TIMESTAMPTZ,
  renewed_period_start TIMESTAMPTZ,
  renewed_period_end TIMESTAMPTZ,
  failure_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edge_subscription_renewals_subscription
  ON edge_subscription_renewals (subscription_id, offered_at DESC);

-- ---------------------------------------------------------------------------
-- Trials (standalone or attached)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_subscription_trials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID REFERENCES edge_subscriptions(id) ON DELETE SET NULL,
  account_id UUID NOT NULL REFERENCES edge_sales_commercial_accounts(id) ON DELETE RESTRICT,
  product_id UUID NOT NULL REFERENCES edge_products(id) ON DELETE RESTRICT,
  package_id UUID REFERENCES edge_solution_packages(id) ON DELETE SET NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING','ACTIVE','EXPIRED','CONVERTED','CANCELLED')),
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  duration_days INT,
  trial_entitlements JSONB NOT NULL DEFAULT '{}'::jsonb,
  restrictions JSONB NOT NULL DEFAULT '{}'::jsonb,
  conversion_subscription_id UUID REFERENCES edge_subscriptions(id) ON DELETE SET NULL,
  owner_administrator_id UUID REFERENCES edge_administrators(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edge_subscription_trials_account
  ON edge_subscription_trials (account_id, status);

CREATE INDEX IF NOT EXISTS idx_edge_subscription_trials_subscription
  ON edge_subscription_trials (subscription_id)
  WHERE subscription_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Suspensions
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_subscription_suspensions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES edge_subscriptions(id) ON DELETE CASCADE,
  reason VARCHAR(64) NOT NULL,
  reason_detail TEXT,
  requested_by UUID,
  approved_by UUID,
  effective_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  lifted_at TIMESTAMPTZ,
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('PENDING','ACTIVE','LIFTED','CANCELLED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edge_subscription_suspensions_subscription
  ON edge_subscription_suspensions (subscription_id, effective_at DESC);

-- ---------------------------------------------------------------------------
-- Cancellations
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_subscription_cancellations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES edge_subscriptions(id) ON DELETE CASCADE,
  reason VARCHAR(64) NOT NULL,
  notice_days INT,
  effective_at TIMESTAMPTZ,
  requested_by UUID,
  approved_by UUID,
  status VARCHAR(32) NOT NULL DEFAULT 'REQUESTED'
    CHECK (status IN ('REQUESTED','APPROVED','EFFECTIVE','WITHDRAWN')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edge_subscription_cancellations_subscription
  ON edge_subscription_cancellations (subscription_id, created_at DESC);

INSERT INTO schema_migrations (version) VALUES ('088_edge_subscription_entitlements_changes')
ON CONFLICT DO NOTHING;
