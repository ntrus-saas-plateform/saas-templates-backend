-- Migration 013: Platform admin + role delete permissions

INSERT INTO permissions (resource, action, description) VALUES
  ('tenants', 'create', 'Provision new tenants (platform admin)'),
  ('tenants', 'admin', 'Cross-tenant tenant administration'),
  ('roles', 'delete', 'Delete custom roles')
ON CONFLICT (resource, action) DO NOTHING;

INSERT INTO schema_migrations (version) VALUES ('013_platform_admin_permissions') ON CONFLICT DO NOTHING;
