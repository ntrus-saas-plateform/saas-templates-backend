-- Migration 118: P9 audit P1 remediation (notifications, releases, probes, recovery evidence)
-- Numbered 118 because 117_edge_p10_acquisition_foundation already exists.
-- Honest observation only — no fabricated provider SUCCESS / DELIVERED without evidence.

INSERT INTO edge_permissions (code, description) VALUES
  ('platform:operations:notifications:read', 'Read notification delivery records'),
  ('platform:operations:notifications:manage', 'Record/update notification delivery status'),
  ('platform:operations:releases:read', 'Read release registry records'),
  ('platform:operations:releases:manage', 'Create/transition release records')
ON CONFLICT (code) DO NOTHING;

INSERT INTO edge_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM edge_roles r
INNER JOIN edge_permissions p ON p.code IN (
  'platform:operations:notifications:read',
  'platform:operations:notifications:manage',
  'platform:operations:releases:read',
  'platform:operations:releases:manage'
)
WHERE r.code = 'EDGE_PLATFORM_SUPER_ADMIN'
ON CONFLICT DO NOTHING;

-- Notification delivery tracking (queue → provider → result). DELIVERED requires provider_ref.
CREATE TABLE IF NOT EXISTS edge_p9_notification_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(64) NOT NULL,
  channel VARCHAR(64) NOT NULL,
  destination VARCHAR(512) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'QUEUED'
    CHECK (status IN (
      'QUEUED','SUBMITTED','ACCEPTED','FAILED','DELIVERED','ACKNOWLEDGED','EXPIRED'
    )),
  provider_ref TEXT,
  related_incident_id UUID REFERENCES edge_p9_incidents(id) ON DELETE SET NULL,
  related_rotation_id UUID REFERENCES edge_p9_oncall_rotations(id) ON DELETE SET NULL,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_edge_p9_notif_delivered_provider_ref CHECK (
    status NOT IN ('DELIVERED', 'ACKNOWLEDGED')
    OR (provider_ref IS NOT NULL AND length(btrim(provider_ref)) >= 1)
  )
);
CREATE INDEX IF NOT EXISTS idx_edge_p9_notif_status
  ON edge_p9_notification_deliveries (status, created_at DESC);

-- Release registry (replaces alias-only releases surface). DEPLOYED needs digest or evidence.
CREATE TABLE IF NOT EXISTS edge_p9_releases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  release_number VARCHAR(64) NOT NULL UNIQUE,
  version VARCHAR(128) NOT NULL,
  build_ref VARCHAR(255),
  artifact_digest TEXT,
  external_evidence_ref TEXT,
  service_id UUID REFERENCES edge_p9_services(id) ON DELETE SET NULL,
  environment VARCHAR(32),
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN (
      'DRAFT','SCHEDULED','PROMOTING','DEPLOYED','FAILED','ROLLED_BACK','CANCELLED'
    )),
  change_id UUID REFERENCES edge_p9_changes(id) ON DELETE SET NULL,
  health_gate_status VARCHAR(32) NOT NULL DEFAULT 'UNKNOWN'
    CHECK (health_gate_status IN ('UNKNOWN','PENDING','PASSED','FAILED')),
  deployed_at TIMESTAMPTZ,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_edge_p9_release_deployed_evidence CHECK (
    status <> 'DEPLOYED'
    OR (
      (artifact_digest IS NOT NULL AND length(btrim(artifact_digest)) >= 1)
      OR (external_evidence_ref IS NOT NULL AND length(btrim(external_evidence_ref)) >= 1)
    )
  )
);
CREATE INDEX IF NOT EXISTS idx_edge_p9_releases_status
  ON edge_p9_releases (status, created_at DESC);

-- Monitoring probe results — CONNECTED requires successful UP probe (app layer).
CREATE TABLE IF NOT EXISTS edge_p9_monitoring_probe_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES edge_p9_monitoring_sources(id) ON DELETE RESTRICT,
  probe_type VARCHAR(64) NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL,
  outcome VARCHAR(32) NOT NULL
    CHECK (outcome IN ('UP','DOWN','DEGRADED','UNKNOWN','ERROR')),
  latency_ms INTEGER CHECK (latency_ms IS NULL OR latency_ms >= 0),
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_edge_p9_probe_source
  ON edge_p9_monitoring_probe_results (source_id, observed_at DESC);

-- Strengthen recovery evidence classification (MANUAL_OVERRIDE justification enforced in app).
ALTER TABLE edge_p9_recovery_operations
  ADD COLUMN IF NOT EXISTS evidence_kind VARCHAR(32)
    CHECK (
      evidence_kind IS NULL
      OR evidence_kind IN ('PROVIDER_TICKET','BACKUP_JOB_ID','DR_EXERCISE_REF','MANUAL_OVERRIDE')
    );

ALTER TABLE edge_p9_recovery_operations
  ADD COLUMN IF NOT EXISTS evidence_justification TEXT;

INSERT INTO schema_migrations (version)
VALUES ('118_edge_p9_remediation_ops')
ON CONFLICT DO NOTHING;
