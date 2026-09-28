-- Tenant domain / subdomain registry

CREATE TABLE IF NOT EXISTS tenant_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  hostname VARCHAR(255) NOT NULL,
  type VARCHAR(32) NOT NULL DEFAULT 'SUBDOMAIN'
    CHECK (type IN ('SUBDOMAIN', 'CUSTOM')),
  is_primary BOOLEAN NOT NULL DEFAULT false,
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'PENDING', 'DISABLED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_tenant_domains_hostname UNIQUE (hostname)
);

CREATE INDEX IF NOT EXISTS idx_tenant_domains_tenant_id ON tenant_domains (tenant_id);

COMMENT ON TABLE tenant_domains IS
  'Maps hostname/subdomain to tenantId. Runtime: Host → tenant; JWT.tenant_id must match when Host resolves.';

INSERT INTO schema_migrations (version) VALUES ('027_tenant_domains')
ON CONFLICT (version) DO NOTHING;
