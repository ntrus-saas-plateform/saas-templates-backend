-- Control plane: platform admin audit log

CREATE TABLE IF NOT EXISTS platform_admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_identity_id VARCHAR(255),
  actor_client_id VARCHAR(255),
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(100) NOT NULL,
  resource_id VARCHAR(255),
  tenant_id UUID,
  request_id VARCHAR(255),
  ip VARCHAR(45),
  user_agent TEXT,
  result VARCHAR(20) NOT NULL CHECK (result IN ('success', 'failure')),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS platform_admin_audit_log_created_at_idx
  ON platform_admin_audit_log (created_at DESC);

CREATE INDEX IF NOT EXISTS platform_admin_audit_log_actor_idx
  ON platform_admin_audit_log (actor_identity_id, actor_client_id);

CREATE INDEX IF NOT EXISTS platform_admin_audit_log_tenant_idx
  ON platform_admin_audit_log (tenant_id)
  WHERE tenant_id IS NOT NULL;

INSERT INTO schema_migrations (version) VALUES ('030_platform_admin_audit') ON CONFLICT DO NOTHING;
