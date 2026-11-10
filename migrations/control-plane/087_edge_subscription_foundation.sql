-- Migration 087: P5 — Subscription foundation (aggregate, items, periods, audit)
-- Entitlement snapshots and coordination land in 088–089.
-- Handoff creates subscription drafts; activation gated in domain (not fake tenant state).

-- ---------------------------------------------------------------------------
-- Subscriptions (aggregate root)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_number VARCHAR(32) NOT NULL,
  account_id UUID NOT NULL REFERENCES edge_sales_commercial_accounts(id) ON DELETE RESTRICT,
  contract_id UUID REFERENCES edge_sales_contracts(id) ON DELETE SET NULL,
  sales_order_id UUID REFERENCES edge_sales_orders(id) ON DELETE SET NULL,
  handoff_id UUID REFERENCES edge_sales_handoffs(id) ON DELETE SET NULL,
  product_id UUID NOT NULL REFERENCES edge_products(id) ON DELETE RESTRICT,
  vertical_id UUID REFERENCES edge_verticals(id) ON DELETE SET NULL,
  market_id UUID REFERENCES edge_commercial_markets(id) ON DELETE SET NULL,
  package_id UUID REFERENCES edge_solution_packages(id) ON DELETE SET NULL,
  plan_id UUID REFERENCES edge_commercial_plans(id) ON DELETE SET NULL,
  plan_version INT,
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN (
      'DRAFT','PENDING_APPROVAL','PENDING_ACTIVATION','PENDING_PROVISIONING',
      'TRIALING','ACTIVE','PAST_DUE','SUSPENDED','PENDING_CANCELLATION',
      'CANCELLED','EXPIRED','TERMINATED','FAILED_ACTIVATION'
    )),
  subscription_type VARCHAR(64) NOT NULL DEFAULT 'STANDARD',
  billing_frequency VARCHAR(32),
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  renewal_at TIMESTAMPTZ,
  trial_start_at TIMESTAMPTZ,
  trial_end_at TIMESTAMPTZ,
  billing_reference VARCHAR(255),
  correlation_id UUID,
  commercial_validated BOOLEAN NOT NULL DEFAULT FALSE,
  provisioning_required BOOLEAN NOT NULL DEFAULT TRUE,
  provisioning_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  billing_required BOOLEAN NOT NULL DEFAULT FALSE,
  billing_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  enterprise_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  commercial_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_subscriptions_number_key UNIQUE (subscription_number),
  CONSTRAINT edge_subscriptions_correlation_key UNIQUE (correlation_id)
);

CREATE SEQUENCE IF NOT EXISTS edge_subscription_number_seq START 1000;

CREATE INDEX IF NOT EXISTS idx_edge_subscriptions_account
  ON edge_subscriptions (account_id, status);

CREATE INDEX IF NOT EXISTS idx_edge_subscriptions_product
  ON edge_subscriptions (product_id, status);

CREATE INDEX IF NOT EXISTS idx_edge_subscriptions_handoff
  ON edge_subscriptions (handoff_id)
  WHERE handoff_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_edge_subscriptions_sales_order
  ON edge_subscriptions (sales_order_id)
  WHERE sales_order_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Subscription line items (plan / package / add-on composition)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_subscription_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES edge_subscriptions(id) ON DELETE CASCADE,
  item_type VARCHAR(32) NOT NULL
    CHECK (item_type IN ('PLAN','PACKAGE','ADDON','ENTITLEMENT','OTHER')),
  product_id UUID REFERENCES edge_products(id) ON DELETE SET NULL,
  offer_ref VARCHAR(255),
  version INT,
  quantity NUMERIC(19,4) NOT NULL DEFAULT 1,
  unit VARCHAR(32),
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('PENDING','ACTIVE','SUSPENDED','REMOVED','CANCELLED')),
  pricing_ref VARCHAR(255),
  entitlement_ref VARCHAR(255),
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edge_subscription_items_subscription
  ON edge_subscription_items (subscription_id, status);

-- ---------------------------------------------------------------------------
-- Service / billing periods
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_subscription_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES edge_subscriptions(id) ON DELETE CASCADE,
  period_number INT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN','CLOSED','BILLED','WAIVED')),
  billing_frequency VARCHAR(32),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (subscription_id, period_number)
);

CREATE INDEX IF NOT EXISTS idx_edge_subscription_periods_subscription
  ON edge_subscription_periods (subscription_id, starts_at DESC);

-- ---------------------------------------------------------------------------
-- Status history (append-only)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_subscription_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES edge_subscriptions(id) ON DELETE CASCADE,
  from_status VARCHAR(32),
  to_status VARCHAR(32) NOT NULL,
  reason TEXT,
  actor_id UUID,
  correlation_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edge_subscription_status_history_sub
  ON edge_subscription_status_history (subscription_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Lifecycle domain events (append-only audit)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_subscription_lifecycle_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES edge_subscriptions(id) ON DELETE CASCADE,
  event_type VARCHAR(64) NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  actor_id UUID,
  correlation_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edge_subscription_lifecycle_events_sub
  ON edge_subscription_lifecycle_events (subscription_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_edge_subscription_lifecycle_events_type
  ON edge_subscription_lifecycle_events (event_type, created_at DESC);

-- ---------------------------------------------------------------------------
-- Permissions (platform:subscriptions:* — Edge RBAC convention)
-- ---------------------------------------------------------------------------

INSERT INTO edge_permissions (code, description)
VALUES
  ('platform:subscriptions:read', 'Read subscriptions'),
  ('platform:subscriptions:create', 'Create subscription drafts'),
  ('platform:subscriptions:update', 'Update subscription drafts and metadata'),
  ('platform:subscriptions:approve', 'Approve subscriptions and governed changes'),
  ('platform:subscriptions:activate', 'Activate subscriptions after gates'),
  ('platform:subscriptions:suspend', 'Suspend subscriptions'),
  ('platform:subscriptions:reactivate', 'Reactivate suspended subscriptions'),
  ('platform:subscriptions:cancel', 'Cancel subscriptions'),
  ('platform:subscriptions:terminate', 'Terminate subscriptions'),
  ('platform:subscriptions:renew', 'Initiate and confirm renewals'),
  ('platform:subscriptions:change_plan', 'Request and execute plan changes'),
  ('platform:subscriptions:manage_addons', 'Manage subscription add-ons'),
  ('platform:subscriptions:manage_trials', 'Manage subscription trials'),
  ('platform:subscriptions:read_enterprise', 'Read enterprise subscription overlays'),
  ('platform:subscriptions:manage_enterprise', 'Manage enterprise subscription rules'),
  ('platform:subscriptions:read_entitlements', 'Read entitlement snapshots'),
  ('platform:subscriptions:publish_entitlements', 'Publish entitlement snapshots'),
  ('platform:subscriptions:reconcile_entitlements', 'Reconcile entitlement read models'),
  ('platform:subscriptions:manage_policies', 'Manage subscription activation policies'),
  ('platform:subscriptions:read_analytics', 'Read subscription analytics'),
  ('platform:subscriptions:manage_approvals', 'Manage subscription approval queues'),
  ('platform:subscriptions:manage_integrations', 'Manage subscription integration adapters')
ON CONFLICT (code) DO NOTHING;

INSERT INTO edge_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM edge_roles r
CROSS JOIN edge_permissions p
WHERE r.code = 'EDGE_PLATFORM_SUPER_ADMIN'
  AND p.code LIKE 'platform:subscriptions:%'
ON CONFLICT DO NOTHING;

INSERT INTO edge_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM edge_roles r
INNER JOIN edge_permissions p ON p.code IN (
  'platform:subscriptions:read',
  'platform:subscriptions:create',
  'platform:subscriptions:update',
  'platform:subscriptions:activate',
  'platform:subscriptions:suspend',
  'platform:subscriptions:reactivate',
  'platform:subscriptions:cancel',
  'platform:subscriptions:renew',
  'platform:subscriptions:change_plan',
  'platform:subscriptions:manage_addons',
  'platform:subscriptions:manage_trials',
  'platform:subscriptions:read_entitlements',
  'platform:subscriptions:read_analytics',
  'platform:subscriptions:manage_approvals'
)
WHERE r.code = 'EDGE_PLATFORM_OPERATOR'
ON CONFLICT DO NOTHING;

INSERT INTO edge_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM edge_roles r
INNER JOIN edge_permissions p ON p.code IN (
  'platform:subscriptions:read',
  'platform:subscriptions:read_entitlements',
  'platform:subscriptions:read_analytics'
)
WHERE r.code IN ('VERTICAL_OWNER', 'VERTICAL_ADMIN')
ON CONFLICT DO NOTHING;

INSERT INTO schema_migrations (version) VALUES ('087_edge_subscription_foundation')
ON CONFLICT DO NOTHING;
