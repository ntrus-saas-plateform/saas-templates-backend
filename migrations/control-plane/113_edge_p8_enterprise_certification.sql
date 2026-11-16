-- Migration 113: P8 enterprise certification — legal hold dual-approval requests

INSERT INTO edge_permissions (code, description) VALUES
  ('platform:tenant_management:legal_hold:approve', 'Approve tenant legal hold change requests (SoD)')
ON CONFLICT (code) DO NOTHING;

INSERT INTO edge_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM edge_roles r
INNER JOIN edge_permissions p ON p.code = 'platform:tenant_management:legal_hold:approve'
WHERE r.code = 'EDGE_PLATFORM_SUPER_ADMIN'
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS edge_p8_legal_hold_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_registry_id UUID NOT NULL
    REFERENCES edge_p8_tenants(id) ON DELETE RESTRICT,
  action VARCHAR(16) NOT NULL
    CHECK (action IN ('RAISE', 'LIFT')),
  status VARCHAR(32) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
  justification TEXT NOT NULL,
  requested_by VARCHAR(255) NOT NULL,
  approver_id VARCHAR(255),
  approved_at TIMESTAMPTZ,
  rejected_reason TEXT,
  correlation_id UUID,
  idempotency_key VARCHAR(128) NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_edge_p8_legal_hold_idempotency UNIQUE (idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_edge_p8_legal_hold_tenant_status
  ON edge_p8_legal_hold_requests (tenant_registry_id, status);

INSERT INTO schema_migrations (version)
VALUES ('113_edge_p8_enterprise_certification')
ON CONFLICT DO NOTHING;