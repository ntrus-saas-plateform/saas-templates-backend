-- Migration 006: Membership roles + organization extended fields

ALTER TABLE user_organization_memberships
  ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS roles JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS permissions JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_organization_memberships_status_check'
  ) THEN
    ALTER TABLE user_organization_memberships
      ADD CONSTRAINT user_organization_memberships_status_check
      CHECK (status IN ('ACTIVE', 'SUSPENDED', 'REVOKED'));
  END IF;
END $$;

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS timezone VARCHAR(50),
  ADD COLUMN IF NOT EXISTS locale VARCHAR(10),
  ADD COLUMN IF NOT EXISTS address JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS contact JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}';

INSERT INTO schema_migrations (version) VALUES ('006_membership_roles') ON CONFLICT DO NOTHING;
