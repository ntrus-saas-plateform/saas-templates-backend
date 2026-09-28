-- Processed integration events log (consumer idempotency complement)

CREATE TABLE IF NOT EXISTS integration_event_log (
  event_id VARCHAR(255) PRIMARY KEY,
  event_type VARCHAR(255) NOT NULL,
  payload JSONB NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_integration_event_log_type ON integration_event_log(event_type);

INSERT INTO schema_migrations (version) VALUES ('003_integration_event_log') ON CONFLICT DO NOTHING;
