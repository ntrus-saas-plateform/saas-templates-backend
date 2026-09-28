-- Tenant data plane: settings + user preference extensions

ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS tenant_settings (
  namespace VARCHAR(100) NOT NULL,
  key VARCHAR(255) NOT NULL,
  value JSONB NOT NULL,
  sensitivity VARCHAR(20) NOT NULL DEFAULT 'normal',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (namespace, key)
);

CREATE TABLE IF NOT EXISTS organization_settings (
  organization_id UUID NOT NULL,
  namespace VARCHAR(100) NOT NULL,
  key VARCHAR(255) NOT NULL,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (organization_id, namespace, key)
);

INSERT INTO schema_migrations (version) VALUES ('008_user_profile_settings') ON CONFLICT DO NOTHING;
