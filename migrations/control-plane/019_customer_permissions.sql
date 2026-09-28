-- Migration 019: Customer RBAC permissions

INSERT INTO permissions (resource, action, description) VALUES
  ('customers', 'read', 'Read customers'),
  ('customers', 'create', 'Create customers'),
  ('customers', 'update', 'Update customers'),
  ('customers', 'delete', 'Delete or anonymize customers'),
  ('customers', 'export', 'Export customer data'),
  ('customers', 'merge', 'Merge duplicate customers'),
  ('customers', 'view_sensitive', 'View sensitive customer data'),
  ('customers', 'manage_consent', 'Manage customer consents'),
  ('customers', 'view_financial', 'View customer financial data'),
  ('customers', 'crm_read', 'Read CRM interactions'),
  ('customers', 'crm_write', 'Write CRM interactions')
ON CONFLICT (resource, action) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
INNER JOIN permissions p ON p.resource = 'customers'
WHERE r.name = 'tenant-owner' AND r.tenant_id IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
INNER JOIN permissions p ON p.resource = 'customers' AND p.action != 'merge'
WHERE r.name = 'tenant-administrator' AND r.tenant_id IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
INNER JOIN permissions p ON p.resource = 'customers' AND p.action IN ('read', 'create', 'update', 'crm_read', 'crm_write')
WHERE r.name = 'organization-administrator' AND r.tenant_id IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
INNER JOIN permissions p ON p.resource = 'customers' AND p.action IN ('read', 'create', 'update', 'crm_read')
WHERE r.name = 'manager' AND r.tenant_id IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO schema_migrations (version) VALUES ('019_customer_permissions') ON CONFLICT DO NOTHING;
