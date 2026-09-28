-- Migration 047: Permissions for commercial reqs 71-87

INSERT INTO permissions (resource, action, description) VALUES
  ('catalog', 'update', 'Update product commercial status and pharma attributes'),
  ('inventory', 'quarantine', 'Quarantine stock lots'),
  ('inventory', 'recall', 'Initiate and manage product/lot recalls'),
  ('pricing', 'history', 'Read price history'),
  ('readmodels', 'read', 'Read commercial read-model projections'),
  ('reconciliation', 'run', 'Run commercial reconciliation jobs'),
  ('reconciliation', 'read', 'Read commercial reconciliation reports'),
  ('jobs', 'run', 'Trigger commercial scheduled job handlers'),
  ('webhooks', 'manage', 'Manage commercial webhook endpoints'),
  ('webhooks', 'read', 'Read webhook delivery logs'),
  ('notifications', 'read', 'Read commercial notification outbox')
ON CONFLICT (resource, action) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
INNER JOIN permissions p ON p.resource IN (
  'catalog', 'inventory', 'pricing', 'readmodels',
  'reconciliation', 'jobs', 'webhooks', 'notifications'
)
WHERE r.name IN ('tenant-owner', 'tenant-administrator') AND r.tenant_id IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
INNER JOIN permissions p ON (
  (p.resource = 'catalog' AND p.action IN ('read', 'create', 'update'))
  OR (p.resource = 'inventory' AND p.action IN ('read', 'create', 'quarantine', 'recall', 'transfer', 'adjust'))
  OR (p.resource = 'pricing' AND p.action IN ('read', 'create', 'publish', 'history'))
  OR (p.resource = 'readmodels')
  OR (p.resource = 'reconciliation')
  OR (p.resource = 'jobs')
  OR (p.resource = 'webhooks')
  OR (p.resource = 'notifications')
)
WHERE r.name IN ('organization-administrator', 'manager') AND r.tenant_id IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO schema_migrations (version) VALUES ('047_commercial_reqs_71_87_permissions') ON CONFLICT DO NOTHING;
