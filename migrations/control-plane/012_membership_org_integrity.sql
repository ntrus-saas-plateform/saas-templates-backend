-- Migration 012: Membership tenant ↔ organization integrity

CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_id_tenant
  ON organizations(id, tenant_id);

ALTER TABLE user_organization_memberships
  DROP CONSTRAINT IF EXISTS fk_membership_org_tenant;

ALTER TABLE user_organization_memberships
  ADD CONSTRAINT fk_membership_org_tenant
  FOREIGN KEY (organization_id, tenant_id)
  REFERENCES organizations(id, tenant_id);

INSERT INTO schema_migrations (version) VALUES ('012_membership_org_integrity') ON CONFLICT DO NOTHING;
