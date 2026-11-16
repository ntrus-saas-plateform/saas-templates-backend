-- Migration 115: P9.1 — Platform Operations service catalog & ownership
-- Canonical operational service registry. Does NOT own P5/P6/P7/P8 data.

INSERT INTO edge_permissions (code, description) VALUES
  ('platform:service_catalog:read', 'Read platform service catalog and dependencies'),
  ('platform:service_catalog:manage', 'Create and update platform services / ownership / dependencies'),
  ('platform:service_catalog:export', 'Export service catalog (audited)'),
  ('platform:operations:health:read', 'Read platform operations health overview'),
  ('platform:operations:overview:read', 'Read operations overview dashboard aggregates')
ON CONFLICT (code) DO NOTHING;

INSERT INTO edge_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM edge_roles r
INNER JOIN edge_permissions p ON p.code IN (
  'platform:service_catalog:read',
  'platform:service_catalog:manage',
  'platform:service_catalog:export',
  'platform:operations:health:read',
  'platform:operations:overview:read'
)
WHERE r.code = 'EDGE_PLATFORM_SUPER_ADMIN'
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS edge_p9_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_code VARCHAR(64) NOT NULL,
  service_slug VARCHAR(128) NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(64) NOT NULL DEFAULT 'PLATFORM'
    CHECK (category IN (
      'CONTROL_PLANE','ADMIN_CONSOLE','TENANT_REGISTRY','PROVISIONING','WORKFLOW',
      'PRODUCT_CONTROL','INFRASTRUCTURE','IDENTITY','CONFIGURATION','LIFECYCLE',
      'NOTIFICATION','BILLING','PAYMENT','AUDIT','MESSAGING','DATABASE','STORAGE',
      'NETWORK','CONNECTIVITY','EXTERNAL','OTHER','PLATFORM'
    )),
  service_type VARCHAR(64) NOT NULL DEFAULT 'INTERNAL'
    CHECK (service_type IN ('INTERNAL','EXTERNAL','SHARED','PRODUCT_CONTROL','INFRASTRUCTURE','DATA')),
  lifecycle_status VARCHAR(32) NOT NULL DEFAULT 'PLANNED'
    CHECK (lifecycle_status IN (
      'PLANNED','CONFIGURED','DISCOVERED','OBSERVED','VERIFIED','DEPRECATED','RETIRED'
    )),
  observation_status VARCHAR(32) NOT NULL DEFAULT 'UNKNOWN'
    CHECK (observation_status IN (
      'CONFIGURED','DISCOVERED','OBSERVED','VERIFIED','UNAVAILABLE','UNKNOWN'
    )),
  business_criticality VARCHAR(16) NOT NULL DEFAULT 'MEDIUM'
    CHECK (business_criticality IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  technical_criticality VARCHAR(16) NOT NULL DEFAULT 'MEDIUM'
    CHECK (technical_criticality IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  environment VARCHAR(32) NOT NULL DEFAULT 'PRODUCTION'
    CHECK (environment IN ('DEVELOPMENT','TEST','STAGING','PRODUCTION','DR','ENTERPRISE','UNKNOWN')),
  region VARCHAR(64),
  deployment_profile VARCHAR(128),
  runtime_technology VARCHAR(128),
  current_version VARCHAR(64),
  service_owner_id VARCHAR(255),
  technical_owner_id VARCHAR(255),
  operational_team VARCHAR(128),
  support_group VARCHAR(128),
  escalation_policy_ref VARCHAR(255),
  health_check_ref VARCHAR(512),
  monitoring_config_ref VARCHAR(512),
  slo_ref VARCHAR(255),
  runbook_ref VARCHAR(255),
  rpo_minutes INTEGER CHECK (rpo_minutes IS NULL OR rpo_minutes >= 0),
  rto_minutes INTEGER CHECK (rto_minutes IS NULL OR rto_minutes >= 0),
  maintenance_policy_ref VARCHAR(255),
  data_classification VARCHAR(64),
  security_classification VARCHAR(64),
  support_hours VARCHAR(128),
  documentation_url TEXT,
  p7_resource_ref UUID,
  p8_projection_note TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by VARCHAR(255) NOT NULL,
  updated_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  CONSTRAINT uq_edge_p9_services_code UNIQUE (service_code),
  CONSTRAINT uq_edge_p9_services_slug UNIQUE (service_slug)
);

CREATE INDEX IF NOT EXISTS idx_edge_p9_services_category
  ON edge_p9_services (category, lifecycle_status);
CREATE INDEX IF NOT EXISTS idx_edge_p9_services_env_region
  ON edge_p9_services (environment, region);
CREATE INDEX IF NOT EXISTS idx_edge_p9_services_observation
  ON edge_p9_services (observation_status);
CREATE INDEX IF NOT EXISTS idx_edge_p9_services_search
  ON edge_p9_services (display_name, service_code, service_slug);

CREATE TABLE IF NOT EXISTS edge_p9_service_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES edge_p9_services(id) ON DELETE RESTRICT,
  depends_on_service_id UUID NOT NULL REFERENCES edge_p9_services(id) ON DELETE RESTRICT,
  dependency_type VARCHAR(32) NOT NULL DEFAULT 'RUNTIME'
    CHECK (dependency_type IN (
      'RUNTIME','DATA','NETWORK','MESSAGING','IDENTITY','EXTERNAL','BUILD','OTHER'
    )),
  criticality VARCHAR(16) NOT NULL DEFAULT 'HIGH'
    CHECK (criticality IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  description TEXT,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_edge_p9_service_dep UNIQUE (service_id, depends_on_service_id, dependency_type),
  CONSTRAINT chk_edge_p9_service_dep_not_self CHECK (service_id <> depends_on_service_id)
);

CREATE INDEX IF NOT EXISTS idx_edge_p9_service_deps_service
  ON edge_p9_service_dependencies (service_id);
CREATE INDEX IF NOT EXISTS idx_edge_p9_service_deps_depends
  ON edge_p9_service_dependencies (depends_on_service_id);

CREATE TABLE IF NOT EXISTS edge_p9_service_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES edge_p9_services(id) ON DELETE RESTRICT,
  event_type VARCHAR(64) NOT NULL,
  action VARCHAR(64) NOT NULL,
  actor_id VARCHAR(255),
  outcome VARCHAR(32) NOT NULL DEFAULT 'SUCCESS',
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  correlation_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edge_p9_service_activity_service
  ON edge_p9_service_activity (service_id, created_at DESC);

INSERT INTO schema_migrations (version)
VALUES ('115_edge_p9_service_catalog')
ON CONFLICT DO NOTHING;
