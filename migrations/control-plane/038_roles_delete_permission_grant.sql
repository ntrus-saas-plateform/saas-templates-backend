-- Migration 038: Backfill roles:delete onto roles that can manage roles
-- (013 added the permission to the catalog but never granted it.)

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE p.resource = 'roles'
  AND p.action = 'delete'
  AND r.tenant_id IS NULL
  AND r.name IN ('tenant-owner', 'tenant-administrator')
ON CONFLICT DO NOTHING;

-- Any role (system or custom) that already has roles:create or roles:update
INSERT INTO role_permissions (role_id, permission_id)
SELECT DISTINCT r.id, p_del.id
FROM roles r
INNER JOIN role_permissions rp ON rp.role_id = r.id
INNER JOIN permissions p_exist ON p_exist.id = rp.permission_id
  AND p_exist.resource = 'roles'
  AND p_exist.action IN ('create', 'update')
CROSS JOIN permissions p_del
WHERE p_del.resource = 'roles'
  AND p_del.action = 'delete'
ON CONFLICT DO NOTHING;

INSERT INTO schema_migrations (version) VALUES ('038_roles_delete_permission_grant')
ON CONFLICT DO NOTHING;
