-- Phase 3 user account: login history, personal API tokens, activity feed, push enrollment

CREATE TABLE IF NOT EXISTS user_login_history (
  id UUID PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  event_type VARCHAR(32) NOT NULL DEFAULT 'login',
  success BOOLEAN NOT NULL DEFAULT TRUE,
  ip VARCHAR(64) NULL,
  user_agent TEXT NULL,
  browser VARCHAR(64) NULL,
  os VARCHAR(64) NULL,
  device VARCHAR(64) NULL,
  session_id VARCHAR(255) NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_login_history_user_created
  ON user_login_history (user_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_login_history_session_login
  ON user_login_history (user_id, session_id, event_type)
  WHERE session_id IS NOT NULL AND event_type = 'login' AND success = TRUE;

CREATE TABLE IF NOT EXISTS user_api_tokens (
  id UUID PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  name VARCHAR(120) NOT NULL,
  token_prefix VARCHAR(16) NOT NULL,
  token_hash VARCHAR(64) NOT NULL,
  scopes JSONB NOT NULL DEFAULT '[]',
  last_used_at TIMESTAMPTZ NULL,
  expires_at TIMESTAMPTZ NULL,
  revoked_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_api_tokens_hash
  ON user_api_tokens (token_hash);

CREATE INDEX IF NOT EXISTS idx_user_api_tokens_user_created
  ON user_api_tokens (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS user_activity_events (
  id UUID PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  organization_id UUID NULL,
  category VARCHAR(64) NOT NULL DEFAULT 'general',
  title VARCHAR(255) NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  href VARCHAR(500) NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_activity_events_user_created
  ON user_activity_events (user_id, created_at DESC);

ALTER TABLE user_devices
  ADD COLUMN IF NOT EXISTS push_platform VARCHAR(32) NULL,
  ADD COLUMN IF NOT EXISTS push_enrolled_at TIMESTAMPTZ NULL;

INSERT INTO schema_migrations (version) VALUES ('012_user_account_phase3') ON CONFLICT DO NOTHING;
