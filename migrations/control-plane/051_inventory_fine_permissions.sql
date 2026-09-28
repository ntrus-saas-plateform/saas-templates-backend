INSERT INTO permissions (resource, action, description) VALUES
  ('inventory', 'product_read', 'Read inventory products'),
  ('inventory', 'product_create', 'Create inventory products'),
  ('inventory', 'product_update', 'Update inventory products'),
  ('inventory', 'stock_read', 'Read stock balances and lots'),
  ('inventory', 'stock_adjust', 'Adjust stock'),
  ('inventory', 'receipt_create', 'Create receipts'),
  ('inventory', 'receipt_approve', 'Approve receipts'),
  ('inventory', 'transfer_create', 'Create transfers'),
  ('inventory', 'transfer_approve', 'Approve transfers'),
  ('inventory', 'transfer_dispatch', 'Dispatch transfers'),
  ('inventory', 'transfer_receive', 'Receive transfers'),
  ('inventory', 'count_create', 'Create counts'),
  ('inventory', 'count_approve', 'Approve count variances'),
  ('inventory', 'quarantine_create', 'Create quarantine'),
  ('inventory', 'quarantine_release', 'Release quarantine'),
  ('inventory', 'recall_create', 'Create recalls'),
  ('inventory', 'recall_execute', 'Execute recalls'),
  ('inventory', 'disposal_create', 'Create disposals'),
  ('inventory', 'disposal_approve', 'Approve disposals'),
  ('inventory', 'bulk', 'Run inventory bulk operations'),
  ('inventory', 'config', 'Manage inventory config and feature flags')
ON CONFLICT (resource, action) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
INNER JOIN permissions p ON p.resource = 'inventory'
  AND p.action IN (
    'product_read','product_create','product_update','stock_read','stock_adjust',
    'receipt_create','receipt_approve','transfer_create','transfer_approve',
    'transfer_dispatch','transfer_receive','count_create','count_approve',
    'quarantine_create','quarantine_release','recall_create','recall_execute',
    'disposal_create','disposal_approve','bulk','config','read','adjust','count','transfer','receive'
  )
WHERE r.name IN ('tenant-owner', 'tenant-administrator') AND r.tenant_id IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO schema_migrations (version) VALUES ('051_inventory_fine_permissions') ON CONFLICT DO NOTHING;
