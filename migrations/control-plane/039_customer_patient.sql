-- Migration 039: Patient role absorbed into Customer (global + per-tenant)

ALTER TABLE global_customers
  ADD COLUMN IF NOT EXISTS is_patient BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE tenant_customers
  ADD COLUMN IF NOT EXISTS is_patient BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS patient_status VARCHAR(20)
    CHECK (patient_status IS NULL OR patient_status IN ('ACTIVE', 'INACTIVE', 'ARCHIVED')),
  ADD COLUMN IF NOT EXISTS patient_number VARCHAR(50),
  ADD COLUMN IF NOT EXISTS patient_profile JSONB NOT NULL DEFAULT '{}';

CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_customers_patient_number
  ON tenant_customers(tenant_id, patient_number)
  WHERE patient_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tenant_customers_tenant_is_patient
  ON tenant_customers(tenant_id, is_patient)
  WHERE is_patient = true;

INSERT INTO permissions (resource, action, description) VALUES
  ('customers', 'set_patient', 'Mark tenant customer as patient and manage care profile')
ON CONFLICT (resource, action) DO NOTHING;

-- Grant set_patient to roles that previously had pharmacy patient permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
INNER JOIN permissions p ON p.resource = 'customers' AND p.action = 'set_patient'
WHERE r.name IN ('tenant-owner', 'tenant-administrator', 'organization-administrator')
  AND r.tenant_id IS NULL
ON CONFLICT DO NOTHING;

-- Soft-retire pharmacy permission grants (permissions rows kept for historical JWT/audit)
DELETE FROM role_permissions rp
USING permissions p
WHERE rp.permission_id = p.id
  AND p.resource = 'pharmacy';

INSERT INTO schema_migrations (version) VALUES ('039_customer_patient') ON CONFLICT DO NOTHING;
