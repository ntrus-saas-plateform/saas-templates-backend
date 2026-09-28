-- Control-plane permissions for inventory foundation (counts + policies)
INSERT INTO permissions (resource, action, description) VALUES
  ('inventory', 'count', 'Create and manage inventory cycle counts'),
  ('inventory', 'policy', 'Read/update inventory organization policies')
ON CONFLICT (resource, action) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
INNER JOIN permissions p ON p.resource = 'inventory' AND p.action IN ('count', 'policy')
WHERE r.name IN ('tenant-owner', 'tenant-administrator') AND r.tenant_id IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
INNER JOIN permissions p ON p.resource = 'inventory' AND p.action IN ('count', 'policy', 'read', 'adjust')
WHERE r.name IN ('organization-administrator', 'manager') AND r.tenant_id IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO schema_migrations (version) VALUES ('049_inventory_foundation_permissions') ON CONFLICT DO NOTHING;
