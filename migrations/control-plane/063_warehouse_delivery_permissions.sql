-- Migration 063: grant delivery_confirm to org admins/managers

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
INNER JOIN permissions p ON p.resource = 'warehouse' AND p.action = 'delivery_confirm'
WHERE r.name IN ('organization-administrator', 'manager') AND r.tenant_id IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO schema_migrations (version) VALUES ('063_warehouse_delivery_permissions')
ON CONFLICT DO NOTHING;
