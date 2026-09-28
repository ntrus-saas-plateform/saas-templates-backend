-- Migration 007: Idempotent customer timeline ingestion from integration events

ALTER TABLE customer_timeline_events
  ADD COLUMN IF NOT EXISTS source_event_id VARCHAR(255);

CREATE UNIQUE INDEX IF NOT EXISTS uq_customer_timeline_source_event
  ON customer_timeline_events(tenant_id, source_event_id);

INSERT INTO schema_migrations (version) VALUES ('007_timeline_idempotency') ON CONFLICT DO NOTHING;
