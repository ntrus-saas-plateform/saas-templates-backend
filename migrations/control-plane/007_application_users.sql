-- Migration 007: Application user profiles (control plane)

CREATE TABLE IF NOT EXISTS application_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_id VARCHAR(255) NOT NULL,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL DEFAULT 'PENDING_ACTIVATION'
    CHECK (status IN (
      'INVITED', 'PENDING_ACTIVATION', 'ACTIVE', 'SUSPENDED', 'LOCKED', 'DISABLED', 'DELETED'
    )),
  profile JSONB NOT NULL DEFAULT '{}',
  security_metadata JSONB NOT NULL DEFAULT '{}',
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, identity_id)
);

CREATE INDEX IF NOT EXISTS idx_app_users_tenant ON application_users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_app_users_identity ON application_users(identity_id);

INSERT INTO schema_migrations (version) VALUES ('007_application_users') ON CONFLICT DO NOTHING;
