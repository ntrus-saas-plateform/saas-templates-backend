-- Plans, modules, quotas + organization type + tenant plan_id

CREATE TABLE IF NOT EXISTS plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(64) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  max_organizations INTEGER NOT NULL DEFAULT 5,
  max_users INTEGER NOT NULL DEFAULT 25,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS plan_modules (
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  module_key VARCHAR(64) NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  PRIMARY KEY (plan_id, module_key)
);

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES plans(id);

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS max_organizations_override INTEGER;

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS max_users_override INTEGER;

-- Organization type (enterprise classification)
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS type VARCHAR(32) NOT NULL DEFAULT 'OTHER';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'organizations_type_check'
  ) THEN
    ALTER TABLE organizations
      ADD CONSTRAINT organizations_type_check
      CHECK (type IN (
        'BRANCH', 'STORE', 'OFFICE', 'WAREHOUSE',
        'PHARMACY', 'RESTAURANT', 'CLINIC', 'OTHER'
      ));
  END IF;
END $$;

-- Seed plans
INSERT INTO plans (code, name, max_organizations, max_users)
VALUES
  ('BASIC', 'Basic', 3, 10),
  ('STANDARD', 'Standard', 25, 100),
  ('ENTERPRISE', 'Enterprise', 500, 10000)
ON CONFLICT (code) DO NOTHING;

-- Module catalog per plan
-- identity, customer always on BASIC+
-- commerce on STANDARD+
-- pharmacy on ENTERPRISE
WITH p AS (
  SELECT id, code FROM plans
)
INSERT INTO plan_modules (plan_id, module_key, enabled)
SELECT p.id, m.module_key, m.enabled
FROM p
CROSS JOIN LATERAL (
  VALUES
    ('identity', true),
    ('customer', true),
    ('commerce', CASE WHEN p.code IN ('STANDARD', 'ENTERPRISE') THEN true ELSE false END),
    ('pharmacy', CASE WHEN p.code = 'ENTERPRISE' THEN true ELSE false END),
    ('platform', true)
) AS m(module_key, enabled)
ON CONFLICT (plan_id, module_key) DO NOTHING;

-- Backfill tenants.plan_id from plan_reference when possible
UPDATE tenants t
SET plan_id = p.id
FROM plans p
WHERE t.plan_id IS NULL
  AND t.plan_reference IS NOT NULL
  AND UPPER(t.plan_reference) = p.code;

-- Default remaining tenants to STANDARD
UPDATE tenants
SET plan_id = (SELECT id FROM plans WHERE code = 'STANDARD')
WHERE plan_id IS NULL;

COMMENT ON TABLE plans IS 'Commercial plans with default quotas';
COMMENT ON TABLE plan_modules IS 'Which product modules are enabled for a plan';
COMMENT ON COLUMN tenants.plan_id IS 'FK to plans; supersedes free-text plan_reference when set';
COMMENT ON COLUMN organizations.type IS 'Organization classification for UI and policy hints';

INSERT INTO schema_migrations (version) VALUES ('028_tenant_plans_modules')
ON CONFLICT (version) DO NOTHING;
