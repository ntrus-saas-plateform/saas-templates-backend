-- Migration 008: RBAC catalog + tenant owners

CREATE TABLE IF NOT EXISTS permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource VARCHAR(100) NOT NULL,
  action VARCHAR(100) NOT NULL,
  description TEXT,
  UNIQUE (resource, action)
);

CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  scope VARCHAR(20) NOT NULL CHECK (scope IN ('platform', 'tenant', 'organization')),
  name VARCHAR(100) NOT NULL,
  is_system BOOLEAN NOT NULL DEFAULT false,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE NULLS NOT DISTINCT (tenant_id, scope, name)
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS tenant_owners (
  tenant_id UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  identity_id VARCHAR(255) NOT NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- System permissions
INSERT INTO permissions (resource, action, description) VALUES
  ('tenant', 'read', 'Read tenant profile'),
  ('tenant', 'update', 'Update tenant profile'),
  ('tenant', 'ownership_transfer', 'Transfer tenant ownership'),
  ('organizations', 'read', 'List and read organizations'),
  ('organizations', 'create', 'Create organizations'),
  ('organizations', 'update', 'Update organizations'),
  ('organizations', 'suspend', 'Suspend organizations'),
  ('users', 'read', 'Read users'),
  ('users', 'invite', 'Invite users'),
  ('users', 'update', 'Update users'),
  ('users', 'suspend', 'Suspend users'),
  ('memberships', 'read', 'Read memberships'),
  ('memberships', 'create', 'Grant memberships'),
  ('memberships', 'update', 'Update membership roles'),
  ('memberships', 'revoke', 'Revoke memberships'),
  ('roles', 'read', 'Read roles'),
  ('roles', 'create', 'Create custom roles'),
  ('roles', 'update', 'Update roles'),
  ('permissions', 'read', 'Read permission catalog'),
  ('settings', 'read', 'Read settings'),
  ('settings', 'update', 'Update settings'),
  ('security', 'read', 'Read security policies'),
  ('security', 'update', 'Update security policies'),
  ('platform', 'read', 'Read platform context'),
  ('platform', 'organizations:read', 'Read platform organizations')
ON CONFLICT (resource, action) DO NOTHING;

-- Platform system roles (tenant_id NULL)
INSERT INTO roles (tenant_id, scope, name, is_system, description) VALUES
  (NULL, 'tenant', 'tenant-owner', true, 'Tenant owner with full control'),
  (NULL, 'tenant', 'tenant-administrator', true, 'Tenant administrator'),
  (NULL, 'organization', 'organization-administrator', true, 'Organization administrator'),
  (NULL, 'organization', 'manager', true, 'Organization manager'),
  (NULL, 'organization', 'viewer', true, 'Read-only viewer')
ON CONFLICT DO NOTHING;

INSERT INTO schema_migrations (version) VALUES ('008_rbac_catalog') ON CONFLICT DO NOTHING;
