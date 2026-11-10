-- Migration 086: P4 completion — saved views, export audit, idempotency, visibility scopes
-- Closes application gaps for hierarchy/roles/questionnaires/amendments already in 081–085.

-- ---------------------------------------------------------------------------
-- Saved views (personal / team / managerial)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_sales_saved_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(64),
  name VARCHAR(255) NOT NULL,
  scope VARCHAR(32) NOT NULL DEFAULT 'PERSONAL'
    CHECK (scope IN ('PERSONAL','TEAM','MANAGERIAL','GLOBAL')),
  entity_type VARCHAR(64) NOT NULL
    CHECK (entity_type IN (
      'ACCOUNT','CONTACT','LEAD','OPPORTUNITY','QUOTE','CONTRACT','ORDER','ACTIVITY','APPROVAL'
    )),
  owner_administrator_id UUID REFERENCES edge_administrators(id) ON DELETE CASCADE,
  team_id UUID REFERENCES edge_sales_teams(id) ON DELETE CASCADE,
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  columns JSONB NOT NULL DEFAULT '[]'::jsonb,
  sort_spec JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (scope = 'PERSONAL' AND owner_administrator_id IS NOT NULL)
    OR (scope = 'TEAM' AND team_id IS NOT NULL)
    OR (scope IN ('MANAGERIAL','GLOBAL'))
  )
);

CREATE INDEX IF NOT EXISTS idx_edge_sales_saved_views_owner
  ON edge_sales_saved_views (owner_administrator_id, entity_type)
  WHERE owner_administrator_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Controlled exports
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_sales_export_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'COMPLETED'
    CHECK (status IN ('PENDING','COMPLETED','FAILED','DENIED')),
  requested_by UUID NOT NULL,
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  row_count INT NOT NULL DEFAULT 0,
  format VARCHAR(16) NOT NULL DEFAULT 'JSON'
    CHECK (format IN ('JSON','CSV')),
  payload JSONB NOT NULL DEFAULT '[]'::jsonb,
  denial_reason TEXT,
  correlation_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edge_sales_export_jobs_actor
  ON edge_sales_export_jobs (requested_by, created_at DESC);

-- ---------------------------------------------------------------------------
-- Mutation idempotency (sales)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_sales_idempotency_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key VARCHAR(128) NOT NULL,
  route_key VARCHAR(128) NOT NULL,
  actor_id UUID,
  response_status INT NOT NULL DEFAULT 200,
  response_body JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (idempotency_key, route_key)
);

-- ---------------------------------------------------------------------------
-- Visibility scopes (row-level beyond RBAC codes)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_sales_visibility_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_type VARCHAR(64) NOT NULL
    CHECK (subject_type IN ('ACCOUNT','OPPORTUNITY','QUOTE','CONTRACT','ORDER')),
  subject_id UUID NOT NULL,
  grantee_administrator_id UUID REFERENCES edge_administrators(id) ON DELETE CASCADE,
  grantee_team_id UUID REFERENCES edge_sales_teams(id) ON DELETE CASCADE,
  access_level VARCHAR(32) NOT NULL DEFAULT 'READ'
    CHECK (access_level IN ('READ','WRITE','APPROVE')),
  granted_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    grantee_administrator_id IS NOT NULL OR grantee_team_id IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_edge_sales_visibility_subject
  ON edge_sales_visibility_grants (subject_type, subject_id);

-- ---------------------------------------------------------------------------
-- Calendar sync intent log (adapter-backed; no fake sync)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_sales_calendar_sync_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID NOT NULL REFERENCES edge_sales_activities(id) ON DELETE CASCADE,
  provider VARCHAR(64) NOT NULL,
  outcome VARCHAR(32) NOT NULL
    CHECK (outcome IN ('REQUESTED','SYNCED','UNAVAILABLE','FAILED')),
  external_ref VARCHAR(255),
  failure_message TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Operator: assessments already granted; ensure quotes approve stays super-admin-ish
-- Add read for forecasts already present.

INSERT INTO edge_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM edge_roles r
INNER JOIN edge_permissions p ON p.code IN (
  'platform:sales:quotes:approve',
  'platform:sales:assessments:manage',
  'platform:sales:forecast:read'
)
WHERE r.code = 'EDGE_PLATFORM_OPERATOR'
ON CONFLICT DO NOTHING;

INSERT INTO schema_migrations (version) VALUES ('086_edge_sales_platform_completion')
ON CONFLICT DO NOTHING;
