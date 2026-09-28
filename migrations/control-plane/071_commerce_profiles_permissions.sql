-- Control-plane 071: commerce phase-1 catalog / MCP permissions (reuse catalog + vertical-extension).

INSERT INTO permissions (resource, action, description) VALUES
  ('catalog', 'book.manage', 'Create/update bookstore products and ISBN metadata'),
  ('catalog', 'cosmetic.manage', 'Create/update cosmetics products and attributes')
ON CONFLICT (resource, action) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
INNER JOIN permissions p ON p.resource = 'catalog'
  AND p.action IN ('book.manage', 'cosmetic.manage', 'create', 'update', 'read')
WHERE r.name IN ('tenant-owner', 'tenant-administrator', 'organization-administrator', 'manager')
  AND r.tenant_id IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO schema_migrations (version) VALUES ('071_commerce_profiles_permissions')
ON CONFLICT DO NOTHING;
