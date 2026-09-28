-- Vague 2: business-config lifecycle (draft / versions / migration plans)

CREATE TABLE IF NOT EXISTS tenant_business_configuration_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  version INT NOT NULL,
  status VARCHAR(32) NOT NULL
    CHECK (status IN ('ACTIVE', 'DRAFT', 'SUPERSEDED', 'ROLLBACK_POINT')),
  snapshot JSONB NOT NULL,
  reason TEXT,
  actor_id VARCHAR(128),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, version)
);

CREATE INDEX IF NOT EXISTS idx_tbc_versions_org_created
  ON tenant_business_configuration_versions (organization_id, created_at DESC);

CREATE TABLE IF NOT EXISTS business_config_migration_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  from_profile VARCHAR(80),
  to_profile VARCHAR(80) NOT NULL,
  from_version INT,
  plan JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(32) NOT NULL DEFAULT 'PROPOSED'
    CHECK (status IN ('PROPOSED', 'APPROVED', 'APPLIED', 'REJECTED', 'CANCELLED')),
  created_by VARCHAR(128),
  approved_by VARCHAR(128),
  approved_at TIMESTAMPTZ,
  applied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_migration_plans_org_status
  ON business_config_migration_plans (organization_id, status, created_at DESC);
