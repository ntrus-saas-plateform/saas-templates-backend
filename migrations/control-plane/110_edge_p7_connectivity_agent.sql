-- Migration 110: P7.14 — Connectivity Agent & Edge Agent Registry
-- Outbound-only agents for Private Cloud / On-Prem. NOT required for Shared SaaS reference.
-- Strong agent identity, signed commands, local spool, revocation. Anti-replay.
-- Mutative register/command/revoke via P7.4 with P7.1 fail-closed when auth bound.

INSERT INTO edge_permissions (code, description) VALUES
  ('platform:agents:read', 'Read Edge agent registry and command history'),
  ('platform:agents:manage', 'Register and update connectivity agents'),
  ('platform:agents:command', 'Issue verified commands to agents via workflow'),
  ('platform:agents:revoke', 'Revoke agent credentials / registration'),
  ('platform:agents:history:read', 'Read agent command runs and evidence')
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS edge_p7_connectivity_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_code VARCHAR(128) NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  tenant_id UUID,
  product_id UUID,
  deployment_profile_code VARCHAR(128),
  agent_status VARCHAR(32) NOT NULL DEFAULT 'PENDING'
    CHECK (agent_status IN (
      'PENDING','REGISTERING','ACTIVE','DEGRADED','REVOKING','REVOKED','FAILED'
    )),
  public_key_ref VARCHAR(128) NOT NULL,
  certificate_ref VARCHAR(128),
  outbound_only BOOLEAN NOT NULL DEFAULT TRUE,
  last_seen_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  revocation_reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by VARCHAR(255) NOT NULL,
  updated_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  CONSTRAINT edge_p7_connectivity_agents_code UNIQUE (agent_code)
);

CREATE INDEX IF NOT EXISTS idx_edge_p7_agents_status
  ON edge_p7_connectivity_agents (agent_status, tenant_id);

CREATE TABLE IF NOT EXISTS edge_p7_agent_commands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL
    REFERENCES edge_p7_connectivity_agents(id) ON DELETE CASCADE,
  command_type VARCHAR(64) NOT NULL,
  command_status VARCHAR(32) NOT NULL DEFAULT 'PENDING'
    CHECK (command_status IN (
      'PENDING','QUEUED','DISPATCHED','ACKED','SUCCEEDED','FAILED','EXPIRED','REVOKED'
    )),
  nonce CHAR(64) NOT NULL,
  payload_ref VARCHAR(128),
  signature_ref VARCHAR(128),
  provisioning_request_id UUID,
  authorization_row_id UUID,
  authorization_version INTEGER,
  workflow_id UUID,
  expires_at TIMESTAMPTZ,
  acked_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  error_code VARCHAR(64),
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_p7_agent_commands_nonce UNIQUE (agent_id, nonce)
);

CREATE INDEX IF NOT EXISTS idx_edge_p7_agent_commands_agent
  ON edge_p7_agent_commands (agent_id, created_at DESC);

CREATE TABLE IF NOT EXISTS edge_p7_agent_spool (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL
    REFERENCES edge_p7_connectivity_agents(id) ON DELETE CASCADE,
  command_id UUID
    REFERENCES edge_p7_agent_commands(id) ON DELETE SET NULL,
  spool_status VARCHAR(32) NOT NULL DEFAULT 'PENDING'
    CHECK (spool_status IN ('PENDING','DELIVERED','EXPIRED','FAILED')),
  payload_ref VARCHAR(128) NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS edge_p7_agent_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_type VARCHAR(64) NOT NULL,
  resource_id UUID NOT NULL,
  tenant_id UUID,
  from_status VARCHAR(64),
  to_status VARCHAR(64),
  action VARCHAR(64) NOT NULL,
  reason TEXT,
  actor_id VARCHAR(255) NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS edge_p7_agent_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID,
  command_id UUID,
  tenant_id UUID,
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
  AND p.code LIKE 'platform:agents:%'
ON CONFLICT DO NOTHING;

INSERT INTO edge_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM edge_roles r
INNER JOIN edge_permissions p ON p.code IN (
  'platform:agents:read',
  'platform:agents:history:read'
)
WHERE r.code = 'EDGE_PLATFORM_OPERATOR'
ON CONFLICT DO NOTHING;

INSERT INTO schema_migrations (version)
VALUES ('110_edge_p7_connectivity_agent')
ON CONFLICT DO NOTHING;
