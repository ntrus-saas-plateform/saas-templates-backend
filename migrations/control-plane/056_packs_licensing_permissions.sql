-- Vague 4 permissions + org types HOSPITAL/HOTEL
INSERT INTO permissions (resource, action, description) VALUES
  ('licensing-pack', 'read', 'Browse marketplace licensing packs'),
  ('licensing-pack', 'install', 'Install / subscribe to a licensing pack'),
  ('licensing-pack', 'uninstall', 'Cancel a pack subscription'),
  ('warehouse-capability', 'read', 'Read warehouse capability overrides'),
  ('warehouse-capability', 'update', 'Upsert warehouse capability overrides')
ON CONFLICT (resource, action) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
INNER JOIN permissions p ON (
  (p.resource = 'licensing-pack' AND p.action IN ('read', 'install', 'uninstall'))
  OR (p.resource = 'warehouse-capability' AND p.action IN ('read', 'update'))
)
WHERE r.name IN ('tenant-owner', 'tenant-administrator') AND r.tenant_id IS NULL
ON CONFLICT DO NOTHING;

-- Expand organization types (control-plane)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'organizations_type_check') THEN
    ALTER TABLE organizations DROP CONSTRAINT organizations_type_check;
  END IF;
  ALTER TABLE organizations
    ADD CONSTRAINT organizations_type_check
    CHECK (type IN (
      'BRANCH', 'STORE', 'OFFICE', 'WAREHOUSE',
      'PHARMACY', 'RESTAURANT', 'CLINIC', 'HOSPITAL', 'HOTEL', 'OTHER'
    ));
EXCEPTION WHEN others THEN
  -- tenant DBs may not have organizations; ignore
  NULL;
END $$;

INSERT INTO schema_migrations (version) VALUES ('056_packs_licensing_permissions') ON CONFLICT DO NOTHING;
