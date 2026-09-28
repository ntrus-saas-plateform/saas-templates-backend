-- Migration 046: Permissions for commercial reqs 47-70

INSERT INTO permissions (resource, action, description) VALUES
  ('commissions', 'read', 'Read commissions'),
  ('commissions', 'create', 'Create commission rules/agents/periods'),
  ('commissions', 'approve', 'Approve commission periods'),
  ('contracts', 'read', 'Read commercial contracts'),
  ('contracts', 'create', 'Create commercial contracts'),
  ('contracts', 'approve', 'Approve commercial contracts'),
  ('loyalty', 'read', 'Read loyalty accounts'),
  ('loyalty', 'manage', 'Manage loyalty points and rewards'),
  ('vouchers', 'read', 'Read gift vouchers'),
  ('vouchers', 'issue', 'Issue gift vouchers'),
  ('vouchers', 'redeem', 'Redeem gift vouchers'),
  ('vouchers', 'cancel', 'Cancel gift vouchers'),
  ('workflow', 'read', 'Read commercial workflows'),
  ('workflow', 'manage', 'Manage workflow definitions'),
  ('workflow', 'approve', 'Decide approval tasks'),
  ('policies', 'read', 'Read commercial policies'),
  ('policies', 'publish', 'Publish commercial policies'),
  ('search', 'commercial', 'Global commercial search'),
  ('reports', 'read', 'Read commercial reports'),
  ('dashboards', 'read', 'Read commercial dashboards'),
  ('analytics', 'read', 'Read commercial analytics KPIs'),
  ('bulk', 'execute', 'Execute commercial bulk operations'),
  ('import', 'manage', 'Manage commercial import/export pipeline'),
  ('inventory', 'transfer', 'Transfer stock between warehouses'),
  ('inventory', 'adjust', 'Adjust stock quantities'),
  ('sales', 'confirm', 'Confirm sales orders'),
  ('sales', 'cancel', 'Cancel sales orders'),
  ('sales', 'approve', 'Approve sales documents'),
  ('sales', 'discount', 'Apply discounts'),
  ('sales', 'override_price', 'Override prices'),
  ('sales', 'refund', 'Refund sales'),
  ('orders', 'allocate', 'Allocate orders'),
  ('orders', 'fulfill', 'Fulfill orders'),
  ('pricing', 'publish', 'Publish price lists'),
  ('pricing', 'override', 'Override pricing'),
  ('credit', 'override', 'Override customer credit holds')
ON CONFLICT (resource, action) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
INNER JOIN permissions p ON p.resource IN (
  'commissions', 'contracts', 'loyalty', 'vouchers', 'workflow', 'policies',
  'search', 'reports', 'dashboards', 'analytics', 'bulk', 'import',
  'inventory', 'sales', 'orders', 'pricing', 'credit'
)
WHERE r.name IN ('tenant-owner', 'tenant-administrator') AND r.tenant_id IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
INNER JOIN permissions p ON (
  (p.resource = 'commissions' AND p.action IN ('read', 'create', 'approve'))
  OR (p.resource = 'contracts' AND p.action IN ('read', 'create', 'approve'))
  OR (p.resource = 'loyalty')
  OR (p.resource = 'vouchers')
  OR (p.resource = 'workflow')
  OR (p.resource = 'policies')
  OR (p.resource = 'search')
  OR (p.resource = 'reports')
  OR (p.resource = 'dashboards')
  OR (p.resource = 'analytics')
  OR (p.resource = 'bulk')
  OR (p.resource = 'import')
  OR (p.resource = 'inventory' AND p.action IN ('transfer', 'adjust', 'read', 'create'))
  OR (p.resource = 'sales' AND p.action IN ('read', 'create', 'confirm', 'cancel', 'approve', 'discount'))
  OR (p.resource = 'orders')
  OR (p.resource = 'pricing')
)
WHERE r.name IN ('organization-administrator', 'manager') AND r.tenant_id IS NULL
ON CONFLICT DO NOTHING;

WITH p AS (SELECT id, code FROM plans)
INSERT INTO plan_modules (plan_id, module_key, enabled)
SELECT p.id, m.module_key, m.enabled
FROM p
CROSS JOIN LATERAL (
  VALUES
    ('loyalty', CASE WHEN p.code IN ('STANDARD', 'ENTERPRISE', 'STARTER') THEN true ELSE false END),
    ('vouchers', CASE WHEN p.code IN ('STANDARD', 'ENTERPRISE', 'STARTER') THEN true ELSE false END),
    ('commissions', CASE WHEN p.code IN ('STANDARD', 'ENTERPRISE') THEN true ELSE false END),
    ('contracts', CASE WHEN p.code IN ('STANDARD', 'ENTERPRISE', 'STARTER') THEN true ELSE false END),
    ('workflow', CASE WHEN p.code IN ('STANDARD', 'ENTERPRISE') THEN true ELSE false END),
    ('analytics', CASE WHEN p.code IN ('STANDARD', 'ENTERPRISE') THEN true ELSE false END)
) AS m(module_key, enabled)
ON CONFLICT (plan_id, module_key) DO UPDATE SET enabled = EXCLUDED.enabled;

INSERT INTO schema_migrations (version) VALUES ('046_commercial_reqs_47_70_permissions') ON CONFLICT DO NOTHING;
