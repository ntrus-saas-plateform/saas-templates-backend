-- Migration 114: P8 residual enterprise closure
-- - Dual-approval posture + operator object scope
-- - Deprovision authorization permission
-- - Trigram search indexes for registry scale

INSERT INTO edge_permissions (code, description) VALUES
  ('platform:tenant_management:scope:global', 'Unrestricted portfolio access across all Edge tenants'),
  ('platform:tenant_management:deprovision:authorize', 'Authorize destructive P7 deprovision flags on a tenant')
ON CONFLICT (code) DO NOTHING;

-- Backward-compatible: any role already able to search tenants keeps global scope.
INSERT INTO edge_role_permissions (role_id, permission_id)
SELECT DISTINCT r.id, p.id
FROM edge_roles r
INNER JOIN edge_role_permissions rp ON rp.role_id = r.id
INNER JOIN edge_permissions existing ON existing.id = rp.permission_id
  AND existing.code = 'platform:tenant_management:search'
INNER JOIN edge_permissions p ON p.code = 'platform:tenant_management:scope:global'
ON CONFLICT DO NOTHING;

INSERT INTO edge_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM edge_roles r
INNER JOIN edge_permissions p ON p.code = 'platform:tenant_management:scope:global'
WHERE r.code = 'EDGE_PLATFORM_SUPER_ADMIN'
ON CONFLICT DO NOTHING;

INSERT INTO edge_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM edge_roles r
INNER JOIN edge_permissions p ON p.code = 'platform:tenant_management:deprovision:authorize'
WHERE r.code = 'EDGE_PLATFORM_SUPER_ADMIN'
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS edge_p8_operator_scopes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  administrator_id UUID NOT NULL,
  region VARCHAR(64),
  account_id UUID,
  product_id UUID,
  owner_subject_id VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_edge_p8_operator_scope_nonempty CHECK (
    region IS NOT NULL
    OR account_id IS NOT NULL
    OR product_id IS NOT NULL
    OR owner_subject_id IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_edge_p8_operator_scopes_admin
  ON edge_p8_operator_scopes (administrator_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_edge_p8_operator_scopes_tuple
  ON edge_p8_operator_scopes (
    administrator_id,
    COALESCE(region, ''),
    COALESCE(account_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(product_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(owner_subject_id, '')
  );

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_edge_p8_tenants_display_name_trgm
  ON edge_p8_tenants USING gin (display_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_edge_p8_tenants_code_trgm
  ON edge_p8_tenants USING gin (tenant_code gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_edge_p8_tenants_slug_trgm
  ON edge_p8_tenants USING gin (tenant_slug gin_trgm_ops);

INSERT INTO schema_migrations (version)
VALUES ('114_edge_p8_residual_enterprise_closure')
ON CONFLICT DO NOTHING;
