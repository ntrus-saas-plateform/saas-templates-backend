-- Migration 111: P7.15 — Production Certification & Evidence Pack
-- Final P7 gate: certification records + evidence pack assembly.
-- Does NOT claim Modes A–C / real BB / agent production without recorded evidence.
-- Mutative certify via P7.4 with P7.1 fail-closed when auth bound.

INSERT INTO edge_permissions (code, description) VALUES
  ('platform:certification:read', 'Read production certification records and evidence packs'),
  ('platform:certification:manage', 'Create certification packages and attach evidence'),
  ('platform:certification:certify', 'Launch certification workflow (fail-closed gates)'),
  ('platform:certification:revoke', 'Revoke a production certification'),
  ('platform:certification:history:read', 'Read certification runs and evidence')
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS edge_p7_certification_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(128) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  product_id UUID,
  deployment_profile_code VARCHAR(128),
  package_status VARCHAR(32) NOT NULL DEFAULT 'DRAFT'
    CHECK (package_status IN ('DRAFT','ASSEMBLING','READY','CERTIFIED','REVOKED','FAILED')),
  scope JSONB NOT NULL DEFAULT '{}'::jsonb,
  gate_results JSONB NOT NULL DEFAULT '{}'::jsonb,
  evidence_manifest JSONB NOT NULL DEFAULT '[]'::jsonb,
  certified_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  revocation_reason TEXT,
  workflow_id UUID,
  provisioning_request_id UUID,
  authorization_row_id UUID,
  authorization_version INTEGER,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by VARCHAR(255) NOT NULL,
  updated_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  CONSTRAINT edge_p7_certification_packages_code UNIQUE (code)
);

CREATE TABLE IF NOT EXISTS edge_p7_certification_evidence_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID NOT NULL
    REFERENCES edge_p7_certification_packages(id) ON DELETE CASCADE,
  evidence_key VARCHAR(128) NOT NULL,
  phase_code VARCHAR(32) NOT NULL,
  required BOOLEAN NOT NULL DEFAULT TRUE,
  item_status VARCHAR(32) NOT NULL DEFAULT 'MISSING'
    CHECK (item_status IN ('MISSING','ATTACHED','VERIFIED','FAILED','WAIVED')),
  source_ref VARCHAR(255),
  checksum CHAR(64),
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  attached_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_p7_cert_evidence_uniq UNIQUE (package_id, evidence_key)
);

CREATE TABLE IF NOT EXISTS edge_p7_certification_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID NOT NULL
    REFERENCES edge_p7_certification_packages(id) ON DELETE CASCADE,
  operation VARCHAR(64) NOT NULL
    CHECK (operation IN ('ASSEMBLE','CERTIFY','REVOKE','VERIFY')),
  workflow_id UUID,
  outcome VARCHAR(32) NOT NULL DEFAULT 'PENDING'
    CHECK (outcome IN ('PENDING','SUCCEEDED','FAILED','PARTIAL','SKIPPED','WAITING_APPROVAL')),
  error_code VARCHAR(64),
  error_message TEXT,
  observed_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  performed_by VARCHAR(255),
  correlation_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS edge_p7_certification_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_type VARCHAR(64) NOT NULL,
  resource_id UUID NOT NULL,
  from_status VARCHAR(64),
  to_status VARCHAR(64),
  action VARCHAR(64) NOT NULL,
  reason TEXT,
  actor_id VARCHAR(255) NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS edge_p7_certification_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID,
  workflow_id UUID,
  step_key VARCHAR(128),
  operation VARCHAR(128) NOT NULL,
  outcome VARCHAR(32) NOT NULL
    CHECK (outcome IN ('SUCCEEDED','FAILED','SKIPPED','PARTIAL','WAITING_APPROVAL')),
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_code VARCHAR(64),
  error_message TEXT,
  duration_ms INTEGER,
  performed_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO edge_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM edge_roles r
CROSS JOIN edge_permissions p
WHERE r.code = 'EDGE_PLATFORM_SUPER_ADMIN'
  AND p.code LIKE 'platform:certification:%'
ON CONFLICT DO NOTHING;

INSERT INTO edge_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM edge_roles r
INNER JOIN edge_permissions p ON p.code IN (
  'platform:certification:read',
  'platform:certification:history:read'
)
WHERE r.code = 'EDGE_PLATFORM_OPERATOR'
ON CONFLICT DO NOTHING;

INSERT INTO schema_migrations (version)
VALUES ('111_edge_p7_production_certification')
ON CONFLICT DO NOTHING;
