-- Vague 2 permissions for business-config lifecycle
INSERT INTO permissions (resource, action, description) VALUES
  ('business-config', 'activate', 'Activate a DRAFT business configuration'),
  ('business-config', 'rollback', 'Rollback to a previous configuration version'),
  ('business-config', 'migrate', 'Create/approve/apply profile migration plans')
ON CONFLICT (resource, action) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
INNER JOIN permissions p ON (
  p.resource = 'business-config' AND p.action IN ('activate', 'rollback', 'migrate')
)
WHERE r.name IN ('tenant-owner', 'tenant-administrator') AND r.tenant_id IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO schema_migrations (version) VALUES ('054_business_config_lifecycle_permissions') ON CONFLICT DO NOTHING;
