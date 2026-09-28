-- Tenant data plane: per-user preferences (co-located with transactional outbox)

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id VARCHAR(255) PRIMARY KEY,
  active_organization_id UUID NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO schema_migrations (version) VALUES ('002_user_preferences') ON CONFLICT DO NOTHING;
