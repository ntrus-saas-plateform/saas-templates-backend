-- Migration 045: Permissions for reqs 31-45 (returns, purchasing, POS sync)

INSERT INTO permissions (resource, action, description) VALUES
  ('returns', 'read', 'Read commercial returns'),
  ('returns', 'create', 'Create return requests'),
  ('returns', 'approve', 'Authorize/approve returns'),
  ('returns', 'inspect', 'Inspect returns and set quality decision'),
  ('purchasing', 'read', 'Read suppliers and purchase documents'),
  ('purchasing', 'create', 'Create PR/PO/suppliers'),
  ('purchasing', 'approve', 'Approve purchase orders'),
  ('purchasing', 'receive', 'Receive goods against PO'),
  ('pos', 'sync', 'Sync mobile POS offline operations'),
  ('pos', 'checkout', 'POS checkout'),
  ('shipping', 'update', 'Update shipment delivery/POD'),
  ('credit', 'read', 'Read customer credit'),
  ('invoices', 'credit_note', 'Issue credit notes'),
  ('invoices', 'debit_note', 'Issue debit notes')
ON CONFLICT (resource, action) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
INNER JOIN permissions p ON p.resource IN (
  'returns', 'purchasing', 'pos', 'shipping', 'credit', 'invoices', 'payments'
)
WHERE r.name IN ('tenant-owner', 'tenant-administrator') AND r.tenant_id IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
INNER JOIN permissions p ON (
  (p.resource = 'returns' AND p.action IN ('read', 'create', 'approve', 'inspect'))
  OR (p.resource = 'purchasing' AND p.action IN ('read', 'create', 'approve', 'receive'))
  OR (p.resource = 'pos')
  OR (p.resource = 'shipping')
  OR (p.resource = 'credit' AND p.action = 'read')
  OR (p.resource = 'invoices' AND p.action IN ('read', 'create', 'post', 'credit_note', 'debit_note'))
)
WHERE r.name IN ('organization-administrator', 'manager') AND r.tenant_id IS NULL
ON CONFLICT DO NOTHING;

WITH p AS (SELECT id, code FROM plans)
INSERT INTO plan_modules (plan_id, module_key, enabled)
SELECT p.id, m.module_key, m.enabled
FROM p
CROSS JOIN LATERAL (
  VALUES
    ('purchasing', CASE WHEN p.code IN ('STANDARD', 'ENTERPRISE', 'STARTER') THEN true ELSE false END),
    ('pos', CASE WHEN p.code IN ('STANDARD', 'ENTERPRISE', 'STARTER') THEN true ELSE false END)
) AS m(module_key, enabled)
ON CONFLICT (plan_id, module_key) DO UPDATE SET enabled = EXCLUDED.enabled;

INSERT INTO schema_migrations (version) VALUES ('045_commercial_reqs_31_45_permissions') ON CONFLICT DO NOTHING;
