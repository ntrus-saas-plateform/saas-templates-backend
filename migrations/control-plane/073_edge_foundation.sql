-- Migration 073: Okapi Edge foundation (admins, verticals, memberships, RBAC, sessions)

CREATE TABLE IF NOT EXISTS edge_administrators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_identity_id VARCHAR(255) NOT NULL,
  email VARCHAR(320) NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  preferred_language VARCHAR(16) NOT NULL DEFAULT 'en',
  timezone VARCHAR(64) NOT NULL DEFAULT 'UTC',
  profile_picture_ref TEXT,
  status VARCHAR(32) NOT NULL
    CHECK (status IN (
      'INVITED',
      'INVITATION_PENDING',
      'ACTIVE',
      'SUSPENDED',
      'DEACTIVATION_PENDING',
      'DEACTIVATED'
    )),
  email_verified BOOLEAN NOT NULL DEFAULT false,
  mfa_enrolled BOOLEAN NOT NULL DEFAULT false,
  last_successful_access_at TIMESTAMPTZ,
  suspended_at TIMESTAMPTZ,
  deactivated_at TIMESTAMPTZ,
  suspension_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  CONSTRAINT edge_administrators_external_identity_id_key UNIQUE (external_identity_id),
  CONSTRAINT edge_administrators_email_key UNIQUE (email)
);

CREATE TABLE IF NOT EXISTS edge_verticals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(64) NOT NULL,
  slug VARCHAR(128) NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(32) NOT NULL
    CHECK (status IN (
      'DRAFT',
      'CONFIGURING',
      'READY_FOR_ACTIVATION',
      'ACTIVE',
      'SUSPENDED',
      'DEACTIVATION_PENDING',
      'DEACTIVATED'
    )),
  icon_ref TEXT,
  visual_identity_ref TEXT,
  keycloak_organization_id VARCHAR(255),
  configuration_version INTEGER NOT NULL DEFAULT 0,
  activated_at TIMESTAMPTZ,
  suspended_at TIMESTAMPTZ,
  deactivated_at TIMESTAMPTZ,
  suspension_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  CONSTRAINT edge_verticals_code_key UNIQUE (code),
  CONSTRAINT edge_verticals_slug_key UNIQUE (slug)
);

CREATE TABLE IF NOT EXISTS edge_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  administrator_id UUID NOT NULL REFERENCES edge_administrators(id) ON DELETE CASCADE,
  vertical_id UUID NOT NULL REFERENCES edge_verticals(id) ON DELETE CASCADE,
  status VARCHAR(32) NOT NULL
    CHECK (status IN ('INVITED', 'ACTIVE', 'SUSPENDED', 'REVOKED')),
  invitation_id UUID,
  invited_by UUID,
  activated_at TIMESTAMPTZ,
  suspended_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_memberships_admin_vertical_key UNIQUE (administrator_id, vertical_id)
);

CREATE TABLE IF NOT EXISTS edge_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(320) NOT NULL,
  invited_by UUID NOT NULL,
  token_hash VARCHAR(128) NOT NULL,
  status VARCHAR(32) NOT NULL
    CHECK (status IN ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED', 'CANCELLED')),
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  vertical_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  role_codes JSONB NOT NULL DEFAULT '[]'::jsonb,
  workflow_state VARCHAR(64),
  delivery_status VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_invitations_token_hash_key UNIQUE (token_hash)
);

CREATE TABLE IF NOT EXISTS edge_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(128) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_permissions_code_key UNIQUE (code)
);

CREATE TABLE IF NOT EXISTS edge_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(128) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  scope VARCHAR(16) NOT NULL CHECK (scope IN ('GLOBAL', 'VERTICAL')),
  is_system BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_roles_code_key UNIQUE (code)
);

CREATE TABLE IF NOT EXISTS edge_role_permissions (
  role_id UUID NOT NULL REFERENCES edge_roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES edge_permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS edge_role_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  membership_id UUID REFERENCES edge_memberships(id) ON DELETE CASCADE,
  administrator_id UUID NOT NULL REFERENCES edge_administrators(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES edge_roles(id) ON DELETE CASCADE,
  scope_vertical_id UUID REFERENCES edge_verticals(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  assigned_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One active assignment per (administrator, role, membership scope).
-- membership_id NULL = global assignment; COALESCE collapses NULL for uniqueness.
CREATE UNIQUE INDEX IF NOT EXISTS idx_edge_role_assignments_active_unique
  ON edge_role_assignments (
    administrator_id,
    role_id,
    COALESCE(membership_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS edge_workspace_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  administrator_id UUID NOT NULL REFERENCES edge_administrators(id) ON DELETE CASCADE,
  membership_id UUID NOT NULL REFERENCES edge_memberships(id) ON DELETE CASCADE,
  vertical_id UUID NOT NULL REFERENCES edge_verticals(id) ON DELETE CASCADE,
  token_hash VARCHAR(128) NOT NULL,
  status VARCHAR(16) NOT NULL
    CHECK (status IN ('ACTIVE', 'REVOKED', 'EXPIRED')),
  expires_at TIMESTAMPTZ NOT NULL,
  last_renewed_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  revocation_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_workspace_sessions_token_hash_key UNIQUE (token_hash)
);

CREATE TABLE IF NOT EXISTS edge_delegations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grantor_id UUID NOT NULL REFERENCES edge_administrators(id) ON DELETE CASCADE,
  grantee_id UUID NOT NULL REFERENCES edge_administrators(id) ON DELETE CASCADE,
  scope JSONB NOT NULL DEFAULT '{}'::jsonb,
  permitted_operations JSONB NOT NULL DEFAULT '[]'::jsonb,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  justification TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS edge_emergency_access_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES edge_administrators(id) ON DELETE CASCADE,
  approver_id UUID REFERENCES edge_administrators(id) ON DELETE SET NULL,
  scope JSONB NOT NULL DEFAULT '{}'::jsonb,
  justification TEXT NOT NULL,
  status VARCHAR(16) NOT NULL
    CHECK (status IN ('REQUESTED', 'APPROVED', 'ACTIVE', 'REVOKED', 'EXPIRED')),
  starts_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS edge_configuration_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vertical_id UUID NOT NULL REFERENCES edge_verticals(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(16) NOT NULL
    CHECK (status IN ('DRAFT', 'VALIDATED', 'ACTIVE', 'ROLLED_BACK')),
  editor_id UUID,
  change_reason TEXT,
  activated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_configuration_versions_vertical_version_key UNIQUE (vertical_id, version)
);

CREATE TABLE IF NOT EXISTS edge_external_identity_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type VARCHAR(64) NOT NULL,
  entity_id UUID NOT NULL,
  external_system VARCHAR(64) NOT NULL,
  external_id VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_external_identity_mappings_key UNIQUE (entity_type, entity_id, external_system)
);

CREATE TABLE IF NOT EXISTS edge_sync_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_type VARCHAR(64) NOT NULL,
  entity_type VARCHAR(64) NOT NULL,
  entity_id UUID NOT NULL,
  status VARCHAR(32) NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS edge_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(128) NOT NULL,
  actor_id UUID,
  subject_type VARCHAR(64),
  subject_id UUID,
  vertical_id UUID,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edge_administrators_external_identity
  ON edge_administrators (external_identity_id);
CREATE INDEX IF NOT EXISTS idx_edge_administrators_status
  ON edge_administrators (status);
CREATE INDEX IF NOT EXISTS idx_edge_verticals_status
  ON edge_verticals (status);
CREATE INDEX IF NOT EXISTS idx_edge_memberships_admin
  ON edge_memberships (administrator_id);
CREATE INDEX IF NOT EXISTS idx_edge_memberships_vertical
  ON edge_memberships (vertical_id);
CREATE INDEX IF NOT EXISTS idx_edge_memberships_status
  ON edge_memberships (status);
CREATE INDEX IF NOT EXISTS idx_edge_invitations_email
  ON edge_invitations (email);
CREATE INDEX IF NOT EXISTS idx_edge_invitations_token_hash
  ON edge_invitations (token_hash);
CREATE INDEX IF NOT EXISTS idx_edge_invitations_status
  ON edge_invitations (status);
CREATE INDEX IF NOT EXISTS idx_edge_role_assignments_admin
  ON edge_role_assignments (administrator_id);
CREATE INDEX IF NOT EXISTS idx_edge_role_assignments_membership
  ON edge_role_assignments (membership_id);
CREATE INDEX IF NOT EXISTS idx_edge_workspace_sessions_token_hash
  ON edge_workspace_sessions (token_hash);
CREATE INDEX IF NOT EXISTS idx_edge_workspace_sessions_admin
  ON edge_workspace_sessions (administrator_id);
CREATE INDEX IF NOT EXISTS idx_edge_workspace_sessions_status
  ON edge_workspace_sessions (status);
CREATE INDEX IF NOT EXISTS idx_edge_delegations_grantor
  ON edge_delegations (grantor_id);
CREATE INDEX IF NOT EXISTS idx_edge_delegations_grantee
  ON edge_delegations (grantee_id);
CREATE INDEX IF NOT EXISTS idx_edge_emergency_requester
  ON edge_emergency_access_grants (requester_id);
CREATE INDEX IF NOT EXISTS idx_edge_configuration_vertical
  ON edge_configuration_versions (vertical_id);
CREATE INDEX IF NOT EXISTS idx_edge_external_identity_lookup
  ON edge_external_identity_mappings (external_system, external_id);
CREATE INDEX IF NOT EXISTS idx_edge_sync_records_entity
  ON edge_sync_records (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_edge_audit_events_created
  ON edge_audit_events (created_at DESC);

INSERT INTO edge_permissions (code, description) VALUES
  ('platform:overview:read', 'Read Edge platform overview'),
  ('platform:verticals:read', 'List and read verticals'),
  ('platform:verticals:create', 'Create verticals'),
  ('platform:verticals:update', 'Update verticals'),
  ('platform:verticals:activate', 'Activate verticals'),
  ('platform:verticals:suspend', 'Suspend verticals'),
  ('platform:administrators:read', 'Read Edge administrators'),
  ('platform:administrators:invite', 'Invite Edge administrators'),
  ('platform:administrators:update', 'Update Edge administrators'),
  ('platform:administrators:suspend', 'Suspend Edge administrators'),
  ('platform:administrators:deactivate', 'Deactivate Edge administrators'),
  ('workspace:read', 'Read workspace context'),
  ('workspace:switch', 'Switch active workspace'),
  ('workspace:configuration:read', 'Read workspace configuration'),
  ('workspace:configuration:update', 'Update workspace configuration'),
  ('membership:read', 'Read memberships'),
  ('membership:invite', 'Invite members to a vertical'),
  ('membership:activate', 'Activate memberships'),
  ('membership:suspend', 'Suspend memberships'),
  ('membership:reinstate', 'Reinstate memberships'),
  ('membership:revoke', 'Revoke memberships'),
  ('authorization:roles:read', 'Read Edge roles'),
  ('authorization:roles:create', 'Create custom Edge roles'),
  ('authorization:roles:update', 'Update custom Edge roles'),
  ('authorization:roles:assign', 'Assign Edge roles'),
  ('authorization:roles:revoke', 'Revoke Edge role assignments'),
  ('security:sessions:read', 'Read workspace sessions'),
  ('security:sessions:revoke', 'Revoke workspace sessions'),
  ('security:policies:read', 'Read Edge security policies'),
  ('security:policies:update', 'Update Edge security policies'),
  ('audit:read', 'Read Edge audit events'),
  ('audit:export', 'Export Edge audit events'),
  ('delegation:read', 'Read Edge delegations'),
  ('delegation:create', 'Create Edge delegations'),
  ('delegation:revoke', 'Revoke Edge delegations'),
  ('emergency-access:request', 'Request emergency access'),
  ('emergency-access:approve', 'Approve emergency access'),
  ('emergency-access:revoke', 'Revoke emergency access')
ON CONFLICT (code) DO NOTHING;

INSERT INTO edge_roles (code, name, description, scope, is_system, is_active, version) VALUES
  ('EDGE_PLATFORM_SUPER_ADMIN', 'Edge Platform Super Admin', 'Full Edge platform control', 'GLOBAL', true, true, 1),
  ('EDGE_SECURITY_ADMIN', 'Edge Security Admin', 'Security and break-glass administration', 'GLOBAL', true, true, 1),
  ('EDGE_AUDIT_ADMIN', 'Edge Audit Admin', 'Audit read and export', 'GLOBAL', true, true, 1),
  ('EDGE_PLATFORM_OPERATOR', 'Edge Platform Operator', 'Day-to-day platform operations', 'GLOBAL', true, true, 1),
  ('VERTICAL_OWNER', 'Vertical Owner', 'Full control within a vertical', 'VERTICAL', true, true, 1),
  ('VERTICAL_ADMIN', 'Vertical Admin', 'Administer vertical members and config', 'VERTICAL', true, true, 1),
  ('VERTICAL_SECURITY_ADMIN', 'Vertical Security Admin', 'Vertical security operations', 'VERTICAL', true, true, 1),
  ('VERTICAL_OPERATOR', 'Vertical Operator', 'Operate vertical workspace configuration', 'VERTICAL', true, true, 1),
  ('VERTICAL_ANALYST', 'Vertical Analyst', 'Analyze vertical data and audit', 'VERTICAL', true, true, 1),
  ('VERTICAL_VIEWER', 'Vertical Viewer', 'Read-only vertical access', 'VERTICAL', true, true, 1)
ON CONFLICT (code) DO NOTHING;

-- SUPER ADMIN: all permissions
INSERT INTO edge_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM edge_roles r
CROSS JOIN edge_permissions p
WHERE r.code = 'EDGE_PLATFORM_SUPER_ADMIN'
ON CONFLICT DO NOTHING;

-- SECURITY ADMIN
INSERT INTO edge_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM edge_roles r
INNER JOIN edge_permissions p ON p.code IN (
  'platform:overview:read',
  'platform:verticals:read',
  'platform:administrators:read',
  'platform:administrators:suspend',
  'platform:administrators:deactivate',
  'workspace:read',
  'membership:read',
  'membership:suspend',
  'membership:reinstate',
  'membership:revoke',
  'authorization:roles:read',
  'authorization:roles:assign',
  'authorization:roles:revoke',
  'security:sessions:read',
  'security:sessions:revoke',
  'security:policies:read',
  'security:policies:update',
  'audit:read',
  'audit:export',
  'delegation:read',
  'delegation:create',
  'delegation:revoke',
  'emergency-access:request',
  'emergency-access:approve',
  'emergency-access:revoke'
)
WHERE r.code = 'EDGE_SECURITY_ADMIN'
ON CONFLICT DO NOTHING;

-- AUDIT ADMIN
INSERT INTO edge_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM edge_roles r
INNER JOIN edge_permissions p ON p.code IN (
  'platform:overview:read',
  'platform:verticals:read',
  'platform:administrators:read',
  'workspace:read',
  'membership:read',
  'authorization:roles:read',
  'security:sessions:read',
  'security:policies:read',
  'audit:read',
  'audit:export',
  'delegation:read'
)
WHERE r.code = 'EDGE_AUDIT_ADMIN'
ON CONFLICT DO NOTHING;

-- PLATFORM OPERATOR
INSERT INTO edge_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM edge_roles r
INNER JOIN edge_permissions p ON p.code IN (
  'platform:overview:read',
  'platform:verticals:read',
  'platform:verticals:create',
  'platform:verticals:update',
  'platform:verticals:activate',
  'platform:verticals:suspend',
  'platform:administrators:read',
  'platform:administrators:invite',
  'platform:administrators:update',
  'workspace:read',
  'workspace:switch',
  'workspace:configuration:read',
  'workspace:configuration:update',
  'membership:read',
  'membership:invite',
  'membership:activate',
  'authorization:roles:read',
  'audit:read'
)
WHERE r.code = 'EDGE_PLATFORM_OPERATOR'
ON CONFLICT DO NOTHING;

-- VERTICAL_OWNER: broad vertical set
INSERT INTO edge_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM edge_roles r
INNER JOIN edge_permissions p ON p.code IN (
  'workspace:read',
  'workspace:switch',
  'workspace:configuration:read',
  'workspace:configuration:update',
  'membership:read',
  'membership:invite',
  'membership:activate',
  'membership:suspend',
  'membership:reinstate',
  'membership:revoke',
  'authorization:roles:read',
  'authorization:roles:assign',
  'authorization:roles:revoke',
  'security:sessions:read',
  'security:sessions:revoke',
  'audit:read',
  'delegation:read',
  'delegation:create',
  'delegation:revoke',
  'emergency-access:request'
)
WHERE r.code = 'VERTICAL_OWNER'
ON CONFLICT DO NOTHING;

-- VERTICAL_ADMIN
INSERT INTO edge_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM edge_roles r
INNER JOIN edge_permissions p ON p.code IN (
  'workspace:read',
  'workspace:switch',
  'workspace:configuration:read',
  'workspace:configuration:update',
  'membership:read',
  'membership:invite',
  'membership:activate',
  'membership:suspend',
  'membership:reinstate',
  'authorization:roles:read',
  'authorization:roles:assign',
  'security:sessions:read',
  'audit:read'
)
WHERE r.code = 'VERTICAL_ADMIN'
ON CONFLICT DO NOTHING;

-- VERTICAL_SECURITY_ADMIN
INSERT INTO edge_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM edge_roles r
INNER JOIN edge_permissions p ON p.code IN (
  'workspace:read',
  'membership:read',
  'membership:suspend',
  'membership:reinstate',
  'membership:revoke',
  'authorization:roles:read',
  'security:sessions:read',
  'security:sessions:revoke',
  'security:policies:read',
  'audit:read',
  'emergency-access:request',
  'emergency-access:approve',
  'emergency-access:revoke'
)
WHERE r.code = 'VERTICAL_SECURITY_ADMIN'
ON CONFLICT DO NOTHING;

-- VERTICAL_OPERATOR
INSERT INTO edge_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM edge_roles r
INNER JOIN edge_permissions p ON p.code IN (
  'workspace:read',
  'workspace:switch',
  'workspace:configuration:read',
  'workspace:configuration:update',
  'membership:read',
  'audit:read'
)
WHERE r.code = 'VERTICAL_OPERATOR'
ON CONFLICT DO NOTHING;

-- VERTICAL_ANALYST
INSERT INTO edge_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM edge_roles r
INNER JOIN edge_permissions p ON p.code IN (
  'workspace:read',
  'workspace:configuration:read',
  'membership:read',
  'authorization:roles:read',
  'audit:read',
  'audit:export'
)
WHERE r.code = 'VERTICAL_ANALYST'
ON CONFLICT DO NOTHING;

-- VERTICAL_VIEWER
INSERT INTO edge_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM edge_roles r
INNER JOIN edge_permissions p ON p.code IN (
  'workspace:read',
  'workspace:configuration:read',
  'membership:read',
  'audit:read'
)
WHERE r.code = 'VERTICAL_VIEWER'
ON CONFLICT DO NOTHING;

INSERT INTO schema_migrations (version) VALUES ('073_edge_foundation') ON CONFLICT DO NOTHING;
