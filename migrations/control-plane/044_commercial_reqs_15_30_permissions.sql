-- Migration 044: Permissions for reqs 15-30 commercial features

INSERT INTO permissions (resource, action, description) VALUES
  ('catalog', 'substitute', 'Configure and approve product substitutions'),
  ('catalog', 'kits', 'Manage kits and bundles'),
  ('channels', 'read', 'Read sales channels'),
  ('channels', 'create', 'Create sales channels'),
  ('channels', 'update', 'Update sales channels'),
  ('promotions', 'read', 'Read promotions'),
  ('promotions', 'create', 'Create promotions'),
  ('promotions', 'update', 'Update promotions'),
  ('promotions', 'publish', 'Publish promotions'),
  ('tax', 'read', 'Read tax profiles and rates'),
  ('tax', 'create', 'Create tax profiles and rates'),
  ('tax', 'update', 'Update tax configuration'),
  ('fulfillment', 'pack', 'Create packing packages'),
  ('fulfillment', 'wave', 'Manage pick waves'),
  ('sales', 'discount_approve', 'Approve discounts above role limits')
ON CONFLICT (resource, action) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
INNER JOIN permissions p ON p.resource IN (
  'catalog', 'channels', 'promotions', 'tax', 'fulfillment', 'sales'
)
WHERE r.name = 'tenant-owner' AND r.tenant_id IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
INNER JOIN permissions p ON (
  (p.resource = 'channels')
  OR (p.resource = 'promotions')
  OR (p.resource = 'tax')
  OR (p.resource = 'catalog' AND p.action IN ('read', 'substitute', 'kits', 'create', 'update'))
  OR (p.resource = 'fulfillment')
  OR (p.resource = 'sales' AND p.action IN ('discount', 'discount_approve', 'read', 'create', 'update', 'confirm'))
)
WHERE r.name IN ('tenant-administrator', 'organization-administrator', 'manager')
  AND r.tenant_id IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO schema_migrations (version) VALUES ('044_commercial_reqs_15_30_permissions') ON CONFLICT DO NOTHING;
