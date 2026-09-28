-- Migration 016: Manager role permission seed

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
INNER JOIN permissions p ON (
  (p.resource IN ('organizations', 'memberships', 'users') AND p.action = 'read')
  OR (p.resource = 'memberships' AND p.action IN ('create', 'update'))
  OR (p.resource = 'users' AND p.action = 'invite')
)
WHERE r.name = 'manager' AND r.tenant_id IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO schema_migrations (version) VALUES ('016_manager_role_seed') ON CONFLICT DO NOTHING;
