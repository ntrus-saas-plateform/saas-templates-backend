-- Migration 023: orders:refund permission for commerce refunds

INSERT INTO permissions (resource, action, description) VALUES
  ('orders', 'refund', 'Refund completed orders')
ON CONFLICT (resource, action) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
INNER JOIN permissions p ON p.resource = 'orders' AND p.action = 'refund'
WHERE r.name = 'tenant-owner' AND r.tenant_id IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO schema_migrations (version) VALUES ('023_orders_refund_permission') ON CONFLICT DO NOTHING;
