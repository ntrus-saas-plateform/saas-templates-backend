-- Permissions for RAG context documents + regulatory/localization upsert
INSERT INTO permissions (resource, action, description) VALUES
  ('business-config', 'regulatory.update', 'Update regulatory configuration on business config'),
  ('business-config', 'localization.update', 'Update localization configuration on business config'),
  ('business-context-document', 'read', 'Read RAG/context documents'),
  ('business-context-document', 'write', 'Create/update RAG/context documents')
ON CONFLICT (resource, action) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
INNER JOIN permissions p ON (
  (p.resource = 'business-config' AND p.action IN ('regulatory.update', 'localization.update'))
  OR (p.resource = 'business-context-document' AND p.action IN ('read', 'write'))
)
WHERE r.name IN ('tenant-owner', 'tenant-administrator') AND r.tenant_id IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO schema_migrations (version) VALUES ('058_business_context_docs_permissions')
ON CONFLICT DO NOTHING;
