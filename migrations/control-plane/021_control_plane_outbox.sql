-- Migration 021: Control-plane transactional outbox (customer domain co-location)

CREATE TABLE IF NOT EXISTS control_plane_outbox_events (
  id UUID PRIMARY KEY,
  event_type VARCHAR(255) NOT NULL,
  payload JSONB NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'PROCESSING', 'PUBLISHED', 'FAILED', 'DEAD_LETTER')),
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  organization_id UUID,
  correlation_id VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  last_error TEXT
);

CREATE INDEX IF NOT EXISTS idx_cp_outbox_tenant_status_created
  ON control_plane_outbox_events(tenant_id, status, created_at)
  WHERE status IN ('PENDING', 'PROCESSING');

INSERT INTO schema_migrations (version) VALUES ('021_control_plane_outbox') ON CONFLICT DO NOTHING;
