-- Migration 041: Commercial RBAC permissions + plan modules (catalog, pricing, fulfillment)

INSERT INTO permissions (resource, action, description) VALUES
  ('catalog', 'read', 'Read product catalog'),
  ('catalog', 'create', 'Create products and SKUs'),
  ('catalog', 'update', 'Update products and SKUs'),
  ('catalog', 'delete', 'Delete or discontinue products'),
  ('inventory', 'read', 'Read inventory availability and lots'),
  ('inventory', 'receive', 'Receive stock into inventory'),
  ('inventory', 'adjust', 'Adjust inventory quantities'),
  ('inventory', 'reserve', 'Reserve inventory'),
  ('inventory', 'allocate', 'Allocate inventory (FEFO)'),
  ('inventory', 'release', 'Release reservations/allocations'),
  ('pricing', 'read', 'Read price lists and quotes'),
  ('pricing', 'create', 'Create price lists and tax rules'),
  ('pricing', 'update', 'Update pricing'),
  ('pricing', 'publish', 'Publish price lists'),
  ('pricing', 'override', 'Override prices on orders'),
  ('sales', 'read', 'Read sales orders and quotations'),
  ('sales', 'create', 'Create sales orders and carts'),
  ('sales', 'update', 'Update draft sales documents'),
  ('sales', 'confirm', 'Confirm sales orders'),
  ('sales', 'cancel', 'Cancel sales orders'),
  ('sales', 'approve', 'Approve sales orders'),
  ('sales', 'discount', 'Apply discounts within policy'),
  ('sales', 'override_price', 'Override line prices'),
  ('fulfillment', 'read', 'Read pick tickets and shipments'),
  ('fulfillment', 'pick', 'Create and complete picks'),
  ('fulfillment', 'ship', 'Create shipments'),
  ('payments', 'create', 'Capture payments'),
  ('payments', 'refund', 'Refund payments'),
  ('payments', 'read', 'Read payments'),
  ('invoices', 'read', 'Read commercial invoices'),
  ('invoices', 'create', 'Create commercial invoices'),
  ('invoices', 'post', 'Post commercial invoices'),
  ('credit', 'override', 'Override customer credit holds')
ON CONFLICT (resource, action) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
INNER JOIN permissions p ON p.resource IN (
  'catalog', 'inventory', 'pricing', 'sales', 'fulfillment', 'payments', 'invoices', 'credit'
)
WHERE r.name = 'tenant-owner' AND r.tenant_id IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
INNER JOIN permissions p ON p.resource IN (
  'catalog', 'inventory', 'pricing', 'sales', 'fulfillment', 'payments', 'invoices'
)
WHERE r.name = 'tenant-administrator' AND r.tenant_id IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
INNER JOIN permissions p ON (
  (p.resource = 'catalog' AND p.action IN ('read', 'create', 'update'))
  OR (p.resource = 'inventory' AND p.action IN ('read', 'receive', 'reserve', 'allocate'))
  OR (p.resource = 'pricing' AND p.action IN ('read', 'create', 'update'))
  OR (p.resource = 'sales' AND p.action IN ('read', 'create', 'update', 'confirm', 'cancel', 'discount'))
  OR (p.resource = 'fulfillment' AND p.action IN ('read', 'pick', 'ship'))
  OR (p.resource = 'payments' AND p.action IN ('read', 'create'))
  OR (p.resource = 'invoices' AND p.action IN ('read', 'create', 'post'))
)
WHERE r.name IN ('organization-administrator', 'manager') AND r.tenant_id IS NULL
ON CONFLICT DO NOTHING;

WITH p AS (SELECT id, code FROM plans)
INSERT INTO plan_modules (plan_id, module_key, enabled)
SELECT p.id, m.module_key, m.enabled
FROM p
CROSS JOIN LATERAL (
  VALUES
    ('catalog', CASE WHEN p.code IN ('STANDARD', 'ENTERPRISE', 'STARTER') THEN true ELSE false END),
    ('pricing', CASE WHEN p.code IN ('STANDARD', 'ENTERPRISE') THEN true ELSE false END),
    ('fulfillment', CASE WHEN p.code IN ('STANDARD', 'ENTERPRISE') THEN true ELSE false END),
    ('inventory', CASE WHEN p.code IN ('STANDARD', 'ENTERPRISE', 'STARTER') THEN true ELSE false END),
    ('sales', CASE WHEN p.code IN ('STANDARD', 'ENTERPRISE', 'STARTER') THEN true ELSE false END)
) AS m(module_key, enabled)
ON CONFLICT (plan_id, module_key) DO UPDATE SET enabled = EXCLUDED.enabled;

INSERT INTO schema_migrations (version) VALUES ('041_commercial_permissions') ON CONFLICT DO NOTHING;
