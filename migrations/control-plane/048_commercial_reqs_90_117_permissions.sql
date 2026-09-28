-- Migration 048: Permissions for commercial reqs 90-117 (AI/copilot/config)

INSERT INTO permissions (resource, action, description) VALUES
  ('ai', 'read', 'Read AI readiness commercial insights (non-transactional)'),
  ('ai', 'forecast', 'Write demand/sales forecast inputs for AI pipelines'),
  ('copilot', 'query', 'Query commercial copilot read services'),
  ('config', 'commercial_read', 'Read commercial org configuration'),
  ('config', 'commercial_write', 'Update commercial org configuration'),
  ('priority', 'manage', 'Manage commercial priority rules'),
  ('availability_policy', 'manage', 'Manage commercial availability policies'),
  ('explain', 'read', 'Read commercial reconstruction explanations')
ON CONFLICT (resource, action) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
INNER JOIN permissions p ON p.resource IN (
  'ai', 'copilot', 'config', 'priority', 'availability_policy', 'explain'
)
WHERE r.name IN ('tenant-owner', 'tenant-administrator') AND r.tenant_id IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
INNER JOIN permissions p ON (
  (p.resource = 'ai' AND p.action IN ('read', 'forecast'))
  OR (p.resource = 'copilot')
  OR (p.resource = 'config')
  OR (p.resource = 'priority')
  OR (p.resource = 'availability_policy')
  OR (p.resource = 'explain')
)
WHERE r.name IN ('organization-administrator', 'manager') AND r.tenant_id IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO schema_migrations (version) VALUES ('048_commercial_reqs_90_117_permissions') ON CONFLICT DO NOTHING;
