-- Migration 127: D-CARD-01 / RGOM-E7 — SubscriptionTenantAssociation (cardinality B)
-- Temporal commercial binding Subscription ↔ Product Tenant. History append-only for terminal states.

INSERT INTO edge_permissions (code, description) VALUES
  ('platform:subscriptions:read_associations', 'Read subscription–tenant associations'),
  ('platform:subscriptions:manage_associations', 'Create and transition subscription–tenant associations')
ON CONFLICT (code) DO NOTHING;

INSERT INTO edge_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM edge_roles r
CROSS JOIN edge_permissions p
WHERE r.code = 'EDGE_PLATFORM_SUPER_ADMIN'
  AND p.code IN (
    'platform:subscriptions:read_associations',
    'platform:subscriptions:manage_associations'
  )
ON CONFLICT DO NOTHING;

INSERT INTO edge_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM edge_roles r
INNER JOIN edge_permissions p ON p.code IN (
  'platform:subscriptions:read_associations',
  'platform:subscriptions:manage_associations'
)
WHERE r.code = 'EDGE_PLATFORM_OPERATOR'
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS edge_subscription_tenant_associations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL,
  product_id UUID NOT NULL REFERENCES edge_products(id) ON DELETE RESTRICT,
  product_tenant_id UUID NOT NULL,
  product_tenant_ref VARCHAR(255) NOT NULL,
  subscription_id UUID NOT NULL REFERENCES edge_subscriptions(id) ON DELETE RESTRICT,
  association_type VARCHAR(32) NOT NULL
    CHECK (association_type IN (
      'INITIAL','RENEWAL','PLAN_CHANGE','REPLACEMENT','REACTIVATION'
    )),
  association_status VARCHAR(32) NOT NULL DEFAULT 'PENDING'
    CHECK (association_status IN ('PENDING','ACTIVE','SUPERSEDED','CLOSED')),
  environment_slot VARCHAR(64) NOT NULL DEFAULT 'DEFAULT',
  effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  effective_until TIMESTAMPTZ,
  supersedes_association_id UUID REFERENCES edge_subscription_tenant_associations(id) ON DELETE SET NULL,
  source_event_id VARCHAR(128),
  correlation_id VARCHAR(128),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_sta_effective_range CHECK (
    effective_until IS NULL OR effective_until >= effective_from
  )
);

CREATE INDEX IF NOT EXISTS idx_edge_sta_subscription
  ON edge_subscription_tenant_associations (subscription_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_edge_sta_product_tenant
  ON edge_subscription_tenant_associations (product_tenant_id, environment_slot);

CREATE INDEX IF NOT EXISTS idx_edge_sta_account_product
  ON edge_subscription_tenant_associations (account_id, product_id);

-- At most one ACTIVE association per subscription
CREATE UNIQUE INDEX IF NOT EXISTS uq_edge_sta_active_subscription
  ON edge_subscription_tenant_associations (subscription_id)
  WHERE association_status = 'ACTIVE';

-- At most one ACTIVE association per product tenant + environment slot (default policy)
CREATE UNIQUE INDEX IF NOT EXISTS uq_edge_sta_active_tenant_slot
  ON edge_subscription_tenant_associations (product_tenant_id, environment_slot)
  WHERE association_status = 'ACTIVE';

INSERT INTO schema_migrations (version)
VALUES ('127_edge_subscription_tenant_association')
ON CONFLICT DO NOTHING;
