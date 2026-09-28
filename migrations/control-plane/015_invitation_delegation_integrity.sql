-- Migration 015: Invitation and delegation org+tenant composite FK integrity

ALTER TABLE invitations
  DROP CONSTRAINT IF EXISTS fk_invitations_org_tenant;

ALTER TABLE invitations
  ADD CONSTRAINT fk_invitations_org_tenant
  FOREIGN KEY (organization_id, tenant_id)
  REFERENCES organizations(id, tenant_id);

ALTER TABLE delegations
  DROP CONSTRAINT IF EXISTS fk_delegations_org_tenant;

ALTER TABLE delegations
  ADD CONSTRAINT fk_delegations_org_tenant
  FOREIGN KEY (organization_id, tenant_id)
  REFERENCES organizations(id, tenant_id);

INSERT INTO schema_migrations (version) VALUES ('015_invitation_delegation_integrity') ON CONFLICT DO NOTHING;
