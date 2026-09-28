-- Migration 061: Warehouse & Logistics Wave 1 permissions

INSERT INTO permissions (resource, action, description) VALUES
  ('warehouse', 'read', 'Read warehouse execution documents'),
  ('warehouse', 'manage', 'Manage warehouse configuration / docks'),
  ('warehouse', 'receiving_execute', 'Execute receiving'),
  ('warehouse', 'putaway_execute', 'Execute putaway tasks'),
  ('warehouse', 'picking_execute', 'Execute picking tasks'),
  ('warehouse', 'packing_execute', 'Execute packing sessions'),
  ('warehouse', 'shipping_create', 'Create shipments from warehouse'),
  ('warehouse', 'shipping_dispatch', 'Dispatch shipments'),
  ('warehouse', 'delivery_confirm', 'Confirm delivery / POD'),
  ('warehouse', 'tasks_assign', 'Assign warehouse tasks'),
  ('warehouse', 'configuration_manage', 'Manage warehouse WMS configuration'),
  ('warehouse', 'reconciliation_manage', 'Manage warehouse reconciliation')
ON CONFLICT (resource, action) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
INNER JOIN permissions p ON p.resource = 'warehouse'
WHERE r.name IN ('tenant-owner', 'tenant-administrator') AND r.tenant_id IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
INNER JOIN permissions p ON (
  p.resource = 'warehouse' AND p.action IN (
    'read', 'receiving_execute', 'putaway_execute', 'picking_execute',
    'packing_execute', 'shipping_create', 'shipping_dispatch', 'tasks_assign'
  )
)
WHERE r.name IN ('organization-administrator', 'manager') AND r.tenant_id IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO schema_migrations (version) VALUES ('061_warehouse_permissions')
ON CONFLICT DO NOTHING;
