-- Migration 011: Delegation and emergency access (break-glass)

CREATE TABLE IF NOT EXISTS delegations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  grantor_identity_id VARCHAR(255) NOT NULL,
  grantee_identity_id VARCHAR(255) NOT NULL,
  permissions JSONB NOT NULL DEFAULT '[]',
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  CHECK (grantor_identity_id <> grantee_identity_id)
);

CREATE INDEX IF NOT EXISTS idx_delegations_grantee_active
  ON delegations(tenant_id, grantee_identity_id)
  WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS emergency_access_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  operator_identity_id VARCHAR(255) NOT NULL,
  approved_by_identity_id VARCHAR(255) NOT NULL,
  reason TEXT NOT NULL,
  scope JSONB NOT NULL DEFAULT '{}',
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_emergency_access_active
  ON emergency_access_grants(tenant_id)
  WHERE revoked_at IS NULL;

INSERT INTO permissions (resource, action, description) VALUES
  ('delegation', 'read', 'Read delegation grants'),
  ('delegation', 'grant', 'Grant temporary delegations'),
  ('emergency_access', 'read', 'Read break-glass grants'),
  ('emergency_access', 'grant', 'Grant break-glass emergency access')
ON CONFLICT (resource, action) DO NOTHING;

INSERT INTO schema_migrations (version) VALUES ('011_delegation_emergency') ON CONFLICT DO NOTHING;
