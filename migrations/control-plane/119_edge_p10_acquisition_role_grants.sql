-- Migration 119: P10 acquisition role grants for EDGE_PLATFORM_OPERATOR
-- (118 is reserved by edge_p9_remediation_ops — do not invent roles.)
-- Grants read/manage/review only when the role code already exists.

INSERT INTO edge_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM edge_roles r
INNER JOIN edge_permissions p ON p.code IN (
  'platform:acquisition:read',
  'platform:acquisition:manage',
  'platform:acquisition:review'
)
WHERE r.code = 'EDGE_PLATFORM_OPERATOR'
ON CONFLICT DO NOTHING;

-- Fallback read-only for commercial operators if present (no new roles invented).
INSERT INTO edge_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM edge_roles r
INNER JOIN edge_permissions p ON p.code = 'platform:acquisition:read'
WHERE r.code IN ('EDGE_COMMERCIAL_OPERATOR', 'EDGE_COMMERCIAL_ADMIN')
ON CONFLICT DO NOTHING;

INSERT INTO schema_migrations (version) VALUES ('119_edge_p10_acquisition_role_grants')
ON CONFLICT DO NOTHING;
