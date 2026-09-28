-- Control-plane permissions for inventory ops depth (26–55)
INSERT INTO permissions (resource, action, description) VALUES
  ('inventory', 'freeze', 'Apply and release inventory freezes'),
  ('inventory', 'quality', 'Quality inspections and CAPA'),
  ('inventory', 'genealogy', 'Lot genealogy and traceability'),
  ('inventory', 'alerts', 'Manage inventory alerts'),
  ('inventory', 'valuation', 'Read/write stock valuation'),
  ('inventory', 'analytics', 'Inventory analytics and KPIs'),
  ('inventory', 'scanner', 'Scanner resolve API'),
  ('inventory', 'dispose', 'Dispose / destroy stock'),
  ('inventory', 'reports', 'Inventory operational/financial reports')
ON CONFLICT (resource, action) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
INNER JOIN permissions p ON p.resource = 'inventory'
  AND p.action IN (
    'freeze', 'quality', 'genealogy', 'alerts', 'valuation', 'analytics',
    'scanner', 'dispose', 'reports', 'count', 'adjust', 'recall', 'quarantine', 'read'
  )
WHERE r.name IN ('tenant-owner', 'tenant-administrator') AND r.tenant_id IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
INNER JOIN permissions p ON p.resource = 'inventory'
  AND p.action IN ('alerts', 'analytics', 'scanner', 'reports', 'read')
WHERE r.name IN ('organization-administrator', 'manager') AND r.tenant_id IS NULL
ON CONFLICT DO NOTHING;

-- Tamper-evident audit chain (req 49) — control-plane audit_logs
ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS prev_hash VARCHAR(64),
  ADD COLUMN IF NOT EXISTS row_hash VARCHAR(64),
  ADD COLUMN IF NOT EXISTS device VARCHAR(120),
  ADD COLUMN IF NOT EXISTS reason TEXT;

-- request_id already exists on control-plane audit_logs from 001

CREATE INDEX IF NOT EXISTS idx_audit_logs_row_hash ON audit_logs (row_hash)
  WHERE row_hash IS NOT NULL;

INSERT INTO schema_migrations (version) VALUES ('050_inventory_ops_depth_permissions') ON CONFLICT DO NOTHING;
