-- Migration 059: Procurement Wave 1 fine-grained permissions

INSERT INTO permissions (resource, action, description) VALUES
  ('purchasing', 'supplier_manage', 'Manage supplier master lifecycle and catalog'),
  ('purchasing', 'rfq', 'Create and manage RFQs'),
  ('purchasing', 'quote', 'Submit and compare supplier quotations'),
  ('purchasing', 'match', 'Run three-way match from procurement documents'),
  ('purchasing', 'return', 'Create supplier returns and credits')
ON CONFLICT (resource, action) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
INNER JOIN permissions p ON p.resource = 'purchasing'
  AND p.action IN ('supplier_manage', 'rfq', 'quote', 'match', 'return', 'read', 'create', 'approve', 'receive', 'three_way')
WHERE r.name IN ('tenant-owner', 'tenant-administrator') AND r.tenant_id IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
INNER JOIN permissions p ON p.resource = 'purchasing'
  AND p.action IN ('supplier_manage', 'rfq', 'quote', 'match', 'return', 'read', 'create', 'approve', 'receive', 'three_way')
WHERE r.name IN ('organization-administrator', 'manager') AND r.tenant_id IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO schema_migrations (version) VALUES ('059_procurement_permissions') ON CONFLICT DO NOTHING;
