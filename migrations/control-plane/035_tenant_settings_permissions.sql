-- Migration 035: Permissions for tenant settings resources

INSERT INTO permissions (resource, action, description) VALUES
  ('audit', 'read', 'List and view tenant audit logs'),
  ('tenant', 'api:manage', 'Manage tenant API keys, OAuth apps, and service accounts'),
  ('tenant', 'integrations:manage', 'Manage tenant third-party integrations'),
  ('tenant', 'billing:read', 'View tenant billing, plan, and invoices')
ON CONFLICT (resource, action) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.tenant_id IS NULL
  AND r.name IN ('tenant-owner', 'tenant-administrator')
  AND (
    (p.resource = 'audit' AND p.action = 'read')
    OR (p.resource = 'tenant' AND p.action IN ('api:manage', 'integrations:manage', 'billing:read'))
  )
ON CONFLICT DO NOTHING;

INSERT INTO schema_migrations (version) VALUES ('035_tenant_settings_permissions') ON CONFLICT DO NOTHING;
