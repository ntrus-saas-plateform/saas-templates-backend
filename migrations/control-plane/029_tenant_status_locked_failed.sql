-- Migration 029: Add FAILED and LOCKED to tenant status CHECK constraint
-- Previous constraint (004) only covered PROVISIONING, ACTIVE, SUSPENDED, READ_ONLY,
-- DEACTIVATING, ARCHIVED, DELETED — FAILED and LOCKED were introduced in the domain but
-- never added to the DB constraint. This migration closes that gap.

ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_status_check;
ALTER TABLE tenants ADD CONSTRAINT tenants_status_check
  CHECK (status IN (
    'PROVISIONING', 'ACTIVE', 'SUSPENDED', 'READ_ONLY',
    'DEACTIVATING', 'ARCHIVED', 'DELETED',
    'FAILED', 'LOCKED'
  ));

INSERT INTO schema_migrations (version) VALUES ('029_tenant_status_locked_failed') ON CONFLICT DO NOTHING;
