-- Migration 040: Soft-retire commerce / orders / loyalty permission grants

DELETE FROM role_permissions rp
USING permissions p
WHERE rp.permission_id = p.id
  AND p.resource IN ('commerce', 'orders', 'loyalty', 'products', 'cart');

INSERT INTO schema_migrations (version) VALUES ('040_retire_commerce_permissions') ON CONFLICT DO NOTHING;
