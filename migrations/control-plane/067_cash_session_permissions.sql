-- Migration 067: Cash & Sales Session permissions

INSERT INTO permissions (resource, action, description) VALUES
  ('cash-session', 'read', 'View POS sales sessions and cash ledgers'),
  ('cash-session', 'open', 'Open / validate a cash sales session'),
  ('cash-session', 'operate', 'Sell and record payments within an open session'),
  ('cash-session', 'movement', 'Record cash-in/out, safe drop, pickup, transfers'),
  ('cash-session', 'close', 'Begin close, count, and reconcile a session'),
  ('cash-session', 'approve_variance', 'Approve session cash / tender variances'),
  ('cash-session', 'lock', 'Lock a closed session and emit accounting event'),
  ('cash-session', 'cancel', 'Cancel an opening / unused session'),
  ('cash-session', 'assign', 'Assign operators to registers / terminals')
ON CONFLICT (resource, action) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
INNER JOIN permissions p ON p.resource = 'cash-session'
WHERE r.name IN ('tenant-owner', 'tenant-administrator') AND r.tenant_id IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
INNER JOIN permissions p ON p.resource = 'cash-session'
  AND p.action IN ('read', 'open', 'operate', 'movement', 'close', 'assign')
WHERE r.name IN ('organization-administrator', 'manager') AND r.tenant_id IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
INNER JOIN permissions p ON p.resource = 'cash-session'
  AND p.action IN ('read', 'open', 'operate', 'movement', 'close')
WHERE r.name IN ('cashier', 'pos-operator') AND r.tenant_id IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
INNER JOIN permissions p ON p.resource = 'cash-session'
  AND p.action IN ('approve_variance', 'lock', 'cancel')
WHERE r.name IN ('organization-administrator', 'manager') AND r.tenant_id IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO schema_migrations (version) VALUES ('067_cash_session_permissions')
ON CONFLICT DO NOTHING;
