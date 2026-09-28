INSERT INTO permissions (resource, action, description) VALUES
  ('orchestration', 'read', 'View sagas, processes, reconciliation'),
  ('orchestration', 'manage', 'Retry/replay/compensate sagas'),
  ('orchestration', 'ops', 'Ops center dead-letter and manual intervention'),
  ('orchestration', 'shift_close', 'POS shift close'),
  ('purchasing', 'three_way', 'Three-way match PO/GR/Invoice')
ON CONFLICT (resource, action) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
INNER JOIN permissions p ON (
  (p.resource = 'orchestration' AND p.action IN ('read', 'manage', 'ops', 'shift_close'))
  OR (p.resource = 'purchasing' AND p.action = 'three_way')
)
WHERE r.name IN ('tenant-owner', 'tenant-administrator') AND r.tenant_id IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO schema_migrations (version) VALUES ('052_orchestration_permissions') ON CONFLICT DO NOTHING;
