-- Migration 060: CRM Engine Wave 1 fine-grained permissions

INSERT INTO permissions (resource, action, description) VALUES
  ('crm', 'read', 'Read CRM leads/opportunities/activities'),
  ('crm', 'write', 'Create/update CRM entities'),
  ('crm', 'lead', 'Manage leads'),
  ('crm', 'opportunity', 'Manage opportunities'),
  ('crm', 'campaign', 'Manage campaigns'),
  ('crm', 'segment', 'Manage segments and scoring'),
  ('crm', 'merge', 'Merge customers (critical)'),
  ('crm', 'export', 'Export customer CRM data'),
  ('crm', 'credit', 'Update CRM credit profile')
ON CONFLICT (resource, action) DO NOTHING;

-- Align loyalty:write alias used by controllers with manage
INSERT INTO permissions (resource, action, description) VALUES
  ('loyalty', 'write', 'Write loyalty accounts/transactions (alias of manage)')
ON CONFLICT (resource, action) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
INNER JOIN permissions p ON (
  (p.resource = 'crm')
  OR (p.resource = 'loyalty' AND p.action IN ('read', 'manage', 'write'))
  OR (p.resource = 'customers' AND p.action IN (
    'read', 'create', 'update', 'delete', 'export', 'merge',
    'view_sensitive', 'view_financial', 'manage_consent', 'crm_read', 'crm_write', 'set_patient'
  ))
)
WHERE r.name IN ('tenant-owner', 'tenant-administrator') AND r.tenant_id IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
INNER JOIN permissions p ON (
  (p.resource = 'crm' AND p.action IN ('read', 'write', 'lead', 'opportunity', 'segment'))
  OR (p.resource = 'loyalty' AND p.action IN ('read', 'write', 'manage'))
  OR (p.resource = 'customers' AND p.action IN ('read', 'create', 'update', 'crm_read', 'crm_write'))
)
WHERE r.name IN ('organization-administrator', 'manager') AND r.tenant_id IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO schema_migrations (version) VALUES ('060_crm_permissions') ON CONFLICT DO NOTHING;
