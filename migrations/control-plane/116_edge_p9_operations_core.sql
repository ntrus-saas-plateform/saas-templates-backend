-- Migration 116: P9.2–P9.11 operations core (alerts, incidents, problems, changes,
-- maintenance, requests, tasks, on-call, SLO, capacity, recovery, runbooks, status, risk, automation)
-- Honest observation only — no fabricated provider success.

INSERT INTO edge_permissions (code, description) VALUES
  ('platform:operations:alerts:read', 'Read operational alerts'),
  ('platform:operations:alerts:manage', 'Ingest/ack/resolve operational alerts'),
  ('platform:operations:incidents:read', 'Read incidents'),
  ('platform:operations:incidents:manage', 'Create/update/assign incidents'),
  ('platform:operations:incidents:approve', 'Close major incidents / SoD approvals'),
  ('platform:operations:problems:read', 'Read problems'),
  ('platform:operations:problems:manage', 'Manage problems and RCA'),
  ('platform:operations:changes:read', 'Read change requests'),
  ('platform:operations:changes:manage', 'Draft/submit changes'),
  ('platform:operations:changes:approve', 'Approve/reject changes'),
  ('platform:operations:maintenance:read', 'Read maintenance windows'),
  ('platform:operations:maintenance:manage', 'Schedule maintenance windows'),
  ('platform:operations:requests:read', 'Read platform service requests'),
  ('platform:operations:requests:manage', 'Manage platform service requests'),
  ('platform:operations:tasks:read', 'Read operational tasks'),
  ('platform:operations:tasks:manage', 'Manage operational tasks'),
  ('platform:operations:oncall:read', 'Read on-call schedules'),
  ('platform:operations:oncall:manage', 'Manage on-call / escalations'),
  ('platform:operations:slo:read', 'Read SLI/SLO/error budgets'),
  ('platform:operations:slo:manage', 'Manage SLO definitions'),
  ('platform:operations:capacity:read', 'Read capacity measurements'),
  ('platform:operations:capacity:manage', 'Record capacity measurements/alerts'),
  ('platform:operations:recovery:read', 'Read backup/recovery records'),
  ('platform:operations:recovery:manage', 'Request/approve recovery operations'),
  ('platform:operations:runbooks:read', 'Read runbooks'),
  ('platform:operations:runbooks:manage', 'Manage runbook versions'),
  ('platform:operations:status:read', 'Read status page components'),
  ('platform:operations:status:publish', 'Publish status updates (SoD)'),
  ('platform:operations:risks:read', 'Read operational risks/exceptions'),
  ('platform:operations:risks:manage', 'Manage risks/exceptions'),
  ('platform:operations:automation:read', 'Read automation definitions/executions'),
  ('platform:operations:automation:manage', 'Manage automation definitions'),
  ('platform:operations:automation:execute', 'Execute approved automations'),
  ('platform:operations:analytics:read', 'Read operational analytics'),
  ('platform:operations:audit:read', 'Read operational audit trail')
ON CONFLICT (code) DO NOTHING;

INSERT INTO edge_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM edge_roles r
INNER JOIN edge_permissions p ON p.code LIKE 'platform:operations:%'
WHERE r.code = 'EDGE_PLATFORM_SUPER_ADMIN'
ON CONFLICT DO NOTHING;

-- Monitoring sources (provider references — unavailable until adapter configured)
CREATE TABLE IF NOT EXISTS edge_p9_monitoring_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(64) NOT NULL UNIQUE,
  display_name VARCHAR(255) NOT NULL,
  provider_type VARCHAR(64) NOT NULL
    CHECK (provider_type IN ('PROMETHEUS','ALERTMANAGER','OTEL','GRAFANA','LOKI','JAEGER','CUSTOM','UNKNOWN')),
  endpoint_ref TEXT,
  status VARCHAR(32) NOT NULL DEFAULT 'NOT_CONFIGURED'
    CHECK (status IN ('NOT_CONFIGURED','CONFIGURED','CONNECTED','DEGRADED','UNAVAILABLE','UNKNOWN')),
  last_observed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS edge_p9_service_health_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES edge_p9_services(id) ON DELETE RESTRICT,
  overall_status VARCHAR(32) NOT NULL
    CHECK (overall_status IN ('HEALTHY','DEGRADED','CRITICAL','UNAVAILABLE','UNKNOWN','STALE')),
  source_system VARCHAR(128) NOT NULL,
  indicators JSONB NOT NULL DEFAULT '{}'::jsonb,
  observed_at TIMESTAMPTZ NOT NULL,
  stale_after TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_edge_p9_health_service ON edge_p9_service_health_snapshots (service_id, observed_at DESC);

CREATE TABLE IF NOT EXISTS edge_p9_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint VARCHAR(128) NOT NULL,
  title VARCHAR(255) NOT NULL,
  severity VARCHAR(16) NOT NULL DEFAULT 'SEV3'
    CHECK (severity IN ('SEV0','SEV1','SEV2','SEV3','SEV4')),
  status VARCHAR(32) NOT NULL DEFAULT 'RECEIVED'
    CHECK (status IN ('RECEIVED','NORMALIZED','CORRELATED','ACTIVE','ACKNOWLEDGED','SUPPRESSED','RESOLVED','EXPIRED','CANCELLED')),
  service_id UUID REFERENCES edge_p9_services(id) ON DELETE SET NULL,
  source_system VARCHAR(128) NOT NULL,
  environment VARCHAR(32),
  region VARCHAR(64),
  labels JSONB NOT NULL DEFAULT '{}'::jsonb,
  annotations JSONB NOT NULL DEFAULT '{}'::jsonb,
  incident_id UUID,
  acknowledged_by VARCHAR(255),
  acknowledged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  suppression_reason TEXT,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  occurrence_count INTEGER NOT NULL DEFAULT 1 CHECK (occurrence_count >= 1),
  correlation_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  CONSTRAINT uq_edge_p9_alert_fingerprint_active UNIQUE (fingerprint)
);
CREATE INDEX IF NOT EXISTS idx_edge_p9_alerts_status ON edge_p9_alerts (status, severity);

CREATE TABLE IF NOT EXISTS edge_p9_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_number VARCHAR(32) NOT NULL UNIQUE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(64) NOT NULL DEFAULT 'AVAILABILITY',
  severity VARCHAR(16) NOT NULL DEFAULT 'SEV3'
    CHECK (severity IN ('SEV0','SEV1','SEV2','SEV3','SEV4')),
  priority VARCHAR(16) NOT NULL DEFAULT 'P3',
  status VARCHAR(32) NOT NULL DEFAULT 'DETECTED'
    CHECK (status IN ('DETECTED','TRIAGED','ACKNOWLEDGED','INVESTIGATING','MITIGATING','MONITORING','RESOLVED','CLOSED','REOPENED')),
  is_major BOOLEAN NOT NULL DEFAULT FALSE,
  service_id UUID REFERENCES edge_p9_services(id) ON DELETE SET NULL,
  environment VARCHAR(32),
  region VARCHAR(64),
  detection_source VARCHAR(128),
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acknowledged_at TIMESTAMPTZ,
  mitigated_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  reporter_id VARCHAR(255),
  commander_id VARCHAR(255),
  assigned_team VARCHAR(128),
  assigned_to VARCHAR(255),
  resolution_summary TEXT,
  root_cause_ref UUID,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by VARCHAR(255) NOT NULL,
  updated_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1)
);
CREATE INDEX IF NOT EXISTS idx_edge_p9_incidents_status ON edge_p9_incidents (status, severity, is_major);

CREATE TABLE IF NOT EXISTS edge_p9_incident_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES edge_p9_incidents(id) ON DELETE RESTRICT,
  event_type VARCHAR(64) NOT NULL,
  body TEXT NOT NULL,
  actor_id VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS edge_p9_problems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  problem_number VARCHAR(32) NOT NULL UNIQUE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(32) NOT NULL DEFAULT 'IDENTIFIED'
    CHECK (status IN ('IDENTIFIED','INVESTIGATING','ROOT_CAUSE_HYPOTHESIS','ROOT_CAUSE_CONFIRMED','KNOWN_ERROR','RESOLVING','RESOLVED','CLOSED')),
  priority VARCHAR(16) NOT NULL DEFAULT 'P3',
  owner_id VARCHAR(255),
  service_id UUID REFERENCES edge_p9_services(id) ON DELETE SET NULL,
  root_cause_summary TEXT,
  root_cause_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  root_cause_reviewer_id VARCHAR(255),
  workaround TEXT,
  due_at TIMESTAMPTZ,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS edge_p9_problem_incident_links (
  problem_id UUID NOT NULL REFERENCES edge_p9_problems(id) ON DELETE RESTRICT,
  incident_id UUID NOT NULL REFERENCES edge_p9_incidents(id) ON DELETE RESTRICT,
  PRIMARY KEY (problem_id, incident_id)
);

CREATE TABLE IF NOT EXISTS edge_p9_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  change_number VARCHAR(32) NOT NULL UNIQUE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  change_type VARCHAR(64) NOT NULL DEFAULT 'NORMAL'
    CHECK (change_type IN (
      'STANDARD','NORMAL','EMERGENCY','INFRASTRUCTURE','DATABASE','SECURITY','NETWORK',
      'CONFIGURATION','RUNTIME','DEPLOYMENT','INTEGRATION','KEYCLOAK','POLICY','OTHER'
    )),
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN (
      'DRAFT','SUBMITTED','ASSESSED','APPROVED','REJECTED','SCHEDULED','EXECUTING',
      'VALIDATING','COMPLETED','FAILED','ROLLED_BACK','CANCELLED'
    )),
  requester_id VARCHAR(255) NOT NULL,
  owner_id VARCHAR(255),
  responsible_team VARCHAR(128),
  service_id UUID REFERENCES edge_p9_services(id) ON DELETE SET NULL,
  environment VARCHAR(32),
  risk_level VARCHAR(16) NOT NULL DEFAULT 'MEDIUM'
    CHECK (risk_level IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  implementation_plan TEXT,
  validation_plan TEXT,
  rollback_plan TEXT,
  planned_start_at TIMESTAMPTZ,
  planned_end_at TIMESTAMPTZ,
  actual_start_at TIMESTAMPTZ,
  actual_end_at TIMESTAMPTZ,
  approver_id VARCHAR(255),
  approved_at TIMESTAMPTZ,
  rejected_reason TEXT,
  outcome TEXT,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS edge_p9_maintenance_windows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  maintenance_type VARCHAR(32) NOT NULL DEFAULT 'PLANNED'
    CHECK (maintenance_type IN ('PLANNED','EMERGENCY','RECURRING','PROVIDER','INFRASTRUCTURE','DATABASE')),
  status VARCHAR(32) NOT NULL DEFAULT 'SCHEDULED'
    CHECK (status IN ('DRAFT','SCHEDULED','ACTIVE','COMPLETED','CANCELLED')),
  service_id UUID REFERENCES edge_p9_services(id) ON DELETE SET NULL,
  environment VARCHAR(32),
  region VARCHAR(64),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  timezone VARCHAR(64) NOT NULL DEFAULT 'UTC',
  responsible_team VARCHAR(128),
  reason TEXT NOT NULL,
  risk_level VARCHAR(16) NOT NULL DEFAULT 'MEDIUM',
  communication_plan TEXT,
  approved_by VARCHAR(255),
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_edge_p9_maint_window CHECK (ends_at > starts_at)
);

CREATE TABLE IF NOT EXISTS edge_p9_service_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number VARCHAR(32) NOT NULL UNIQUE,
  category VARCHAR(64) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  priority VARCHAR(16) NOT NULL DEFAULT 'P3',
  status VARCHAR(32) NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN','IN_PROGRESS','WAITING','RESOLVED','CLOSED','CANCELLED')),
  requester_id VARCHAR(255) NOT NULL,
  assigned_to VARCHAR(255),
  assigned_team VARCHAR(128),
  service_id UUID REFERENCES edge_p9_services(id) ON DELETE SET NULL,
  environment VARCHAR(32),
  due_at TIMESTAMPTZ,
  resolution TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS edge_p9_operational_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN','IN_PROGRESS','BLOCKED','DONE','CANCELLED')),
  priority VARCHAR(16) NOT NULL DEFAULT 'P3',
  assigned_to VARCHAR(255),
  assigned_team VARCHAR(128),
  due_at TIMESTAMPTZ,
  related_incident_id UUID REFERENCES edge_p9_incidents(id) ON DELETE SET NULL,
  related_change_id UUID REFERENCES edge_p9_changes(id) ON DELETE SET NULL,
  related_service_id UUID REFERENCES edge_p9_services(id) ON DELETE SET NULL,
  runbook_ref VARCHAR(255),
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS edge_p9_oncall_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(64) NOT NULL UNIQUE,
  display_name VARCHAR(255) NOT NULL,
  timezone VARCHAR(64) NOT NULL DEFAULT 'UTC',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS edge_p9_oncall_rotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES edge_p9_oncall_teams(id) ON DELETE RESTRICT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  primary_responder_id VARCHAR(255) NOT NULL,
  secondary_responder_id VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_edge_p9_oncall_window CHECK (ends_at > starts_at)
);

CREATE TABLE IF NOT EXISTS edge_p9_slo_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES edge_p9_services(id) ON DELETE RESTRICT,
  name VARCHAR(128) NOT NULL,
  sli_type VARCHAR(64) NOT NULL
    CHECK (sli_type IN ('AVAILABILITY','SUCCESS_RATE','LATENCY','ERROR_RATE','QUEUE_DELAY','WORKFLOW_TIME','CUSTOM')),
  target_value NUMERIC(10,6) NOT NULL,
  window_days INTEGER NOT NULL DEFAULT 30 CHECK (window_days > 0),
  data_source_ref VARCHAR(255),
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE','PAUSED','RETIRED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (service_id, name)
);

CREATE TABLE IF NOT EXISTS edge_p9_slo_measurements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slo_id UUID NOT NULL REFERENCES edge_p9_slo_definitions(id) ON DELETE RESTRICT,
  measured_value NUMERIC(10,6) NOT NULL,
  error_budget_remaining NUMERIC(10,6),
  window_start TIMESTAMPTZ NOT NULL,
  window_end TIMESTAMPTZ NOT NULL,
  source_system VARCHAR(128) NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS edge_p9_capacity_measurements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID REFERENCES edge_p9_services(id) ON DELETE SET NULL,
  metric_name VARCHAR(128) NOT NULL,
  metric_value NUMERIC(18,6) NOT NULL,
  unit VARCHAR(32),
  threshold_warning NUMERIC(18,6),
  threshold_critical NUMERIC(18,6),
  source_system VARCHAR(128) NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS edge_p9_recovery_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_type VARCHAR(32) NOT NULL
    CHECK (operation_type IN ('BACKUP_VERIFY','RESTORE_REQUEST','RESTORE_EXEC','DR_EXERCISE','OTHER')),
  status VARCHAR(32) NOT NULL DEFAULT 'REQUESTED'
    CHECK (status IN ('REQUESTED','APPROVED','REJECTED','EXECUTING','VERIFIED','FAILED','CANCELLED')),
  service_id UUID REFERENCES edge_p9_services(id) ON DELETE SET NULL,
  requester_id VARCHAR(255) NOT NULL,
  approver_id VARCHAR(255),
  external_evidence_ref TEXT,
  outcome TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS edge_p9_runbooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(64) NOT NULL UNIQUE,
  title VARCHAR(255) NOT NULL,
  service_id UUID REFERENCES edge_p9_services(id) ON DELETE SET NULL,
  owner_id VARCHAR(255),
  current_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS edge_p9_runbook_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  runbook_id UUID NOT NULL REFERENCES edge_p9_runbooks(id) ON DELETE RESTRICT,
  version INTEGER NOT NULL,
  body TEXT NOT NULL,
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (runbook_id, version)
);

CREATE TABLE IF NOT EXISTS edge_p9_status_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(64) NOT NULL UNIQUE,
  display_name VARCHAR(255) NOT NULL,
  service_id UUID REFERENCES edge_p9_services(id) ON DELETE SET NULL,
  public_status VARCHAR(32) NOT NULL DEFAULT 'UNKNOWN'
    CHECK (public_status IN ('OPERATIONAL','DEGRADED','PARTIAL_OUTAGE','MAJOR_OUTAGE','MAINTENANCE','UNKNOWN')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS edge_p9_status_publications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  component_id UUID NOT NULL REFERENCES edge_p9_status_components(id) ON DELETE RESTRICT,
  public_status VARCHAR(32) NOT NULL,
  message TEXT NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT','PENDING_APPROVAL','PUBLISHED','REJECTED','RETRACTED')),
  author_id VARCHAR(255) NOT NULL,
  approver_id VARCHAR(255),
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS edge_p9_operational_risks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  category VARCHAR(64) NOT NULL,
  service_id UUID REFERENCES edge_p9_services(id) ON DELETE SET NULL,
  probability VARCHAR(16) NOT NULL DEFAULT 'MEDIUM',
  impact VARCHAR(16) NOT NULL DEFAULT 'MEDIUM',
  status VARCHAR(32) NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN','MITIGATING','ACCEPTED','CLOSED')),
  owner_id VARCHAR(255),
  mitigation_plan TEXT,
  due_at TIMESTAMPTZ,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS edge_p9_operational_exceptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  scope TEXT NOT NULL,
  justification TEXT NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE','EXPIRED','REVOKED','CLOSED')),
  owner_id VARCHAR(255) NOT NULL,
  approver_id VARCHAR(255),
  expires_at TIMESTAMPTZ NOT NULL,
  compensating_controls TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS edge_p9_automations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(64) NOT NULL UNIQUE,
  title VARCHAR(255) NOT NULL,
  trigger_type VARCHAR(64) NOT NULL,
  definition JSONB NOT NULL DEFAULT '{}'::jsonb,
  destructive BOOLEAN NOT NULL DEFAULT FALSE,
  requires_approval BOOLEAN NOT NULL DEFAULT TRUE,
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE','PAUSED','RETIRED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS edge_p9_automation_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id UUID NOT NULL REFERENCES edge_p9_automations(id) ON DELETE RESTRICT,
  status VARCHAR(32) NOT NULL DEFAULT 'REQUESTED'
    CHECK (status IN ('REQUESTED','APPROVED','DENIED','RUNNING','SUCCEEDED','FAILED','CANCELLED')),
  requested_by VARCHAR(255) NOT NULL,
  approved_by VARCHAR(255),
  idempotency_key VARCHAR(128) NOT NULL UNIQUE,
  result JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE edge_p9_alerts
  DROP CONSTRAINT IF EXISTS edge_p9_alerts_incident_id_fkey;
ALTER TABLE edge_p9_alerts
  ADD CONSTRAINT edge_p9_alerts_incident_id_fkey
  FOREIGN KEY (incident_id) REFERENCES edge_p9_incidents(id) ON DELETE SET NULL;

INSERT INTO schema_migrations (version)
VALUES ('116_edge_p9_operations_core')
ON CONFLICT DO NOTHING;
