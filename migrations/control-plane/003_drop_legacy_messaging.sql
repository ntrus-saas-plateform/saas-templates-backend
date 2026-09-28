-- Migration 003: remove legacy control-plane outbox/inbox (now tenant-scoped)

DROP TABLE IF EXISTS outbox_events;
DROP TABLE IF EXISTS inbox_messages;

INSERT INTO schema_migrations (version) VALUES ('003_drop_legacy_messaging') ON CONFLICT DO NOTHING;
