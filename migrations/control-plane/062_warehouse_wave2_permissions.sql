-- Migration 062: Warehouse Wave 2 permissions

INSERT INTO permissions (resource, action, description) VALUES
  ('warehouse', 'offline_sync', 'Sync offline warehouse operations'),
  ('warehouse', 'carrier_manage', 'Manage carriers and rate shopping'),
  ('warehouse', 'returns_execute', 'Execute returns logistics'),
  ('warehouse', 'ops_manage', 'Warehouse operations center'),
  ('warehouse', 'reconciliation_manage', 'Warehouse reconciliation discrepancies'),
  ('warehouse', 'cold_chain_manage', 'Cold-chain excursion handling')
ON CONFLICT (resource, action) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
INNER JOIN permissions p ON p.resource = 'warehouse'
  AND p.action IN (
    'offline_sync', 'carrier_manage', 'returns_execute',
    'ops_manage', 'cold_chain_manage', 'reconciliation_manage'
  )
WHERE r.name IN ('tenant-owner', 'tenant-administrator') AND r.tenant_id IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
INNER JOIN permissions p ON p.resource = 'warehouse'
  AND p.action IN ('offline_sync', 'returns_execute', 'ops_manage', 'carrier_manage')
WHERE r.name IN ('organization-administrator', 'manager') AND r.tenant_id IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO schema_migrations (version) VALUES ('062_warehouse_wave2_permissions')
ON CONFLICT DO NOTHING;
