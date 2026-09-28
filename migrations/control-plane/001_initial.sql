-- Control plane schema migration 001
-- Platform Core: tenants, organizations, outbox, inbox, idempotency, audit

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(255) PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(100) NOT NULL UNIQUE,
  status VARCHAR(50) NOT NULL DEFAULT 'PROVISIONING'
    CHECK (status IN ('PROVISIONING', 'ACTIVE', 'SUSPENDED', 'READ_ONLY', 'DEACTIVATING', 'DELETED')),
  database_host VARCHAR(255) NOT NULL,
  database_port INTEGER NOT NULL DEFAULT 5432,
  database_name VARCHAR(255) NOT NULL,
  database_credentials_ref VARCHAR(255) NOT NULL,
  region VARCHAR(50) NOT NULL DEFAULT 'eu-west-1',
  environment VARCHAR(50) NOT NULL DEFAULT 'development',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  keycloak_organization_id VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'SUSPENDED', 'ARCHIVED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, slug),
  UNIQUE (tenant_id, keycloak_organization_id)
);

CREATE INDEX IF NOT EXISTS idx_organizations_tenant ON organizations(tenant_id);

CREATE TABLE IF NOT EXISTS user_organization_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, organization_id)
);

CREATE INDEX IF NOT EXISTS idx_memberships_user_tenant ON user_organization_memberships(user_id, tenant_id);

CREATE TABLE IF NOT EXISTS outbox_events (
  id UUID PRIMARY KEY,
  event_type VARCHAR(255) NOT NULL,
  payload JSONB NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'PUBLISHED', 'FAILED', 'DEAD_LETTER')),
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  tenant_id UUID NOT NULL,
  organization_id UUID,
  correlation_id VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  last_error TEXT
);

CREATE INDEX IF NOT EXISTS idx_outbox_status_created ON outbox_events(status, created_at)
  WHERE status = 'PENDING';

CREATE TABLE IF NOT EXISTS inbox_messages (
  message_id VARCHAR(255) NOT NULL,
  consumer_id VARCHAR(255) NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (message_id, consumer_id)
);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  key VARCHAR(255) NOT NULL,
  tenant_id UUID NOT NULL,
  request_hash VARCHAR(64) NOT NULL,
  status_code INTEGER NOT NULL,
  response_body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (key, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_idempotency_expires ON idempotency_keys(expires_at);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  organization_id UUID,
  actor_id VARCHAR(255) NOT NULL,
  actor_type VARCHAR(50) NOT NULL CHECK (actor_type IN ('user', 'system', 'service')),
  action VARCHAR(255) NOT NULL,
  resource VARCHAR(255) NOT NULL,
  resource_id VARCHAR(255),
  status VARCHAR(50) NOT NULL CHECK (status IN ('success', 'failure')),
  timestamp TIMESTAMPTZ NOT NULL,
  correlation_id VARCHAR(255) NOT NULL,
  request_id VARCHAR(255) NOT NULL,
  ip VARCHAR(45),
  user_agent TEXT,
  before_state JSONB,
  after_state JSONB,
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_audit_tenant_timestamp ON audit_logs(tenant_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_correlation ON audit_logs(correlation_id);

CREATE TABLE IF NOT EXISTS migration_lock (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  locked_at TIMESTAMPTZ,
  locked_by VARCHAR(255)
);

INSERT INTO schema_migrations (version) VALUES ('001_initial') ON CONFLICT DO NOTHING;
