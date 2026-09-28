-- Phase 2 user account: in-app notification inbox + soft device registry

CREATE TABLE IF NOT EXISTS user_notifications (
  id UUID PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  organization_id UUID NULL,
  channel VARCHAR(32) NOT NULL DEFAULT 'in_app',
  category VARCHAR(64) NOT NULL DEFAULT 'general',
  priority VARCHAR(16) NOT NULL DEFAULT 'normal',
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  payload JSONB NOT NULL DEFAULT '{}',
  read_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_notifications_user_created
  ON user_notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_notifications_user_unread
  ON user_notifications (user_id)
  WHERE read_at IS NULL;

CREATE TABLE IF NOT EXISTS user_devices (
  id UUID PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  external_session_id VARCHAR(255) NULL,
  device_name VARCHAR(255) NULL,
  platform VARCHAR(64) NULL,
  browser VARCHAR(64) NULL,
  os VARCHAR(64) NULL,
  last_ip VARCHAR(64) NULL,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  trusted BOOLEAN NOT NULL DEFAULT FALSE,
  push_token TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_devices_user_session
  ON user_devices (user_id, external_session_id)
  WHERE external_session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_devices_user_last_seen
  ON user_devices (user_id, last_seen_at DESC);

INSERT INTO schema_migrations (version) VALUES ('011_user_account_phase2') ON CONFLICT DO NOTHING;
