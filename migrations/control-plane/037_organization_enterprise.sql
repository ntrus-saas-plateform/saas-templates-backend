-- Migration 037: Organization enterprise fields + membership employment context

-- ── Organizations hierarchy / ops ───────────────────────────────────────────

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS code VARCHAR(50),
  ADD COLUMN IF NOT EXISTS is_primary BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS opening_hours JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS operational_settings JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_tenant_code
  ON organizations (tenant_id, code)
  WHERE code IS NOT NULL AND code <> '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_tenant_primary
  ON organizations (tenant_id)
  WHERE is_primary = true;

CREATE INDEX IF NOT EXISTS idx_organizations_parent
  ON organizations (tenant_id, parent_id);

-- ── Membership statuses + employment ────────────────────────────────────────

ALTER TABLE user_organization_memberships
  ADD COLUMN IF NOT EXISTS department VARCHAR(150),
  ADD COLUMN IF NOT EXISTS position VARCHAR(150),
  ADD COLUMN IF NOT EXISTS manager_user_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS resource_scopes JSONB NOT NULL DEFAULT '[]'::jsonb;

UPDATE user_organization_memberships
SET status = 'REMOVED'
WHERE status = 'REVOKED';

ALTER TABLE user_organization_memberships
  DROP CONSTRAINT IF EXISTS user_organization_memberships_status_check;

ALTER TABLE user_organization_memberships
  ADD CONSTRAINT user_organization_memberships_status_check
  CHECK (status IN ('INVITED', 'ACTIVE', 'SUSPENDED', 'REMOVED', 'EXPIRED'));

INSERT INTO schema_migrations (version) VALUES ('037_organization_enterprise')
ON CONFLICT DO NOTHING;
