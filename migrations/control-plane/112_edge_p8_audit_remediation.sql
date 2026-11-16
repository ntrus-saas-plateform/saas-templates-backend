-- Migration 112: P8 audit remediation — legal hold management permission (AUD-P8-002)

INSERT INTO edge_permissions (code, description) VALUES
  ('platform:tenant_management:legal_hold:manage', 'Manage tenant registry legal hold (audited)')
ON CONFLICT (code) DO NOTHING;

INSERT INTO edge_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM edge_roles r
INNER JOIN edge_permissions p ON p.code = 'platform:tenant_management:legal_hold:manage'
WHERE r.code = 'EDGE_PLATFORM_SUPER_ADMIN'
ON CONFLICT DO NOTHING;

INSERT INTO schema_migrations (version)
VALUES ('112_edge_p8_audit_remediation')
ON CONFLICT DO NOTHING;