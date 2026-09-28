-- Tenant provisioning saga fields + FAILED status support

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS provisioning_step VARCHAR(64),
  ADD COLUMN IF NOT EXISTS failure_reason TEXT,
  ADD COLUMN IF NOT EXISTS failure_step VARCHAR(64),
  ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS default_organization_id UUID,
  ADD COLUMN IF NOT EXISTS provision_idempotency_key VARCHAR(255);

CREATE UNIQUE INDEX IF NOT EXISTS uq_tenants_provision_idempotency_key
  ON tenants (provision_idempotency_key)
  WHERE provision_idempotency_key IS NOT NULL;

COMMENT ON COLUMN tenants.provisioning_step IS
  'Saga step: REQUESTED|DB_CREATED|MIGRATED|IDENTITY_CONFIGURED|ORG_CONFIGURED|ADMIN_CONFIGURED|READY';
COMMENT ON COLUMN tenants.default_organization_id IS
  'Default Keycloak-backed organization created at provision time';
COMMENT ON COLUMN tenants.provision_idempotency_key IS
  'Client Idempotency-Key for POST /admin/tenants (unique when set)';

UPDATE tenants
SET provisioning_step = 'READY'
WHERE status = 'ACTIVE' AND provisioning_step IS NULL;

INSERT INTO schema_migrations (version) VALUES ('026_tenant_provisioning_saga')
ON CONFLICT (version) DO NOTHING;
