-- Migration 004: Tenant-scoped customer operations (CRM timeline)

CREATE TABLE IF NOT EXISTS customer_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  organization_id UUID,
  tenant_customer_id UUID NOT NULL,
  type VARCHAR(50) NOT NULL,
  subject VARCHAR(255),
  description TEXT,
  channel VARCHAR(50),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by VARCHAR(255) NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_interactions_customer
  ON customer_interactions(tenant_id, tenant_customer_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS customer_timeline_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  tenant_customer_id UUID NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payload JSONB NOT NULL DEFAULT '{}',
  correlation_id VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_timeline_customer
  ON customer_timeline_events(tenant_id, tenant_customer_id, occurred_at DESC);

INSERT INTO schema_migrations (version) VALUES ('004_customer_operations') ON CONFLICT DO NOTHING;
