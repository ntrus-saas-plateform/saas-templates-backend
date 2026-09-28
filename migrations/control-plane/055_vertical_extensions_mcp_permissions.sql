-- Vague 3 permissions: extensions, offline snapshots, MCP
INSERT INTO permissions (resource, action, description) VALUES
  ('vertical-extension', 'read', 'Read product vertical extensions'),
  ('vertical-extension', 'update', 'Upsert product vertical extensions'),
  ('offline-config', 'read', 'Read offline POS/UI config snapshots'),
  ('offline-config', 'publish', 'Publish offline config snapshots'),
  ('mcp', 'invoke', 'Invoke MCP tools (read and guarded mutations)')
ON CONFLICT (resource, action) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
INNER JOIN permissions p ON (
  (p.resource = 'vertical-extension' AND p.action IN ('read', 'update'))
  OR (p.resource = 'offline-config' AND p.action IN ('read', 'publish'))
  OR (p.resource = 'mcp' AND p.action = 'invoke')
)
WHERE r.name IN ('tenant-owner', 'tenant-administrator') AND r.tenant_id IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO schema_migrations (version) VALUES ('055_vertical_extensions_mcp_permissions') ON CONFLICT DO NOTHING;
