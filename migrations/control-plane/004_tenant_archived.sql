-- Migration 004: Add ARCHIVED tenant lifecycle state (spec alignment)

ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_status_check;
ALTER TABLE tenants ADD CONSTRAINT tenants_status_check
  CHECK (status IN (
    'PROVISIONING', 'ACTIVE', 'SUSPENDED', 'READ_ONLY',
    'DEACTIVATING', 'ARCHIVED', 'DELETED'
  ));

INSERT INTO schema_migrations (version) VALUES ('004_tenant_archived') ON CONFLICT DO NOTHING;
