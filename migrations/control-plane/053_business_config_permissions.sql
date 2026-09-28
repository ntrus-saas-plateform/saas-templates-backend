INSERT INTO permissions (resource, action, description) VALUES
  ('business-config', 'read', 'View business profiles, capabilities, and context'),
  ('business-config', 'update', 'Assign profiles and update business configuration'),
  ('capability', 'enable', 'Enable a tenant capability'),
  ('capability', 'disable', 'Disable a tenant capability')
ON CONFLICT (resource, action) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
INNER JOIN permissions p ON (
  (p.resource = 'business-config' AND p.action IN ('read', 'update'))
  OR (p.resource = 'capability' AND p.action IN ('enable', 'disable'))
)
WHERE r.name IN ('tenant-owner', 'tenant-administrator') AND r.tenant_id IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO schema_migrations (version) VALUES ('053_business_config_permissions') ON CONFLICT DO NOTHING;
