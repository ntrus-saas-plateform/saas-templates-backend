-- Migration 002: user-tenant membership for authorization

CREATE TABLE IF NOT EXISTS user_tenant_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'SUSPENDED', 'REVOKED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_user_tenant_memberships_user ON user_tenant_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_user_tenant_memberships_tenant ON user_tenant_memberships(tenant_id);

INSERT INTO schema_migrations (version) VALUES ('002_user_tenant_memberships') ON CONFLICT DO NOTHING;
