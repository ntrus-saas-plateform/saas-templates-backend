-- Reconciliation report persistence (tenant-scoped history)

CREATE TABLE IF NOT EXISTS reconciliation_reports (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  ran_at TIMESTAMPTZ NOT NULL,
  keycloak_available BOOLEAN NOT NULL,
  report JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reconciliation_reports_tenant_ran_at
  ON reconciliation_reports (tenant_id, ran_at DESC);

INSERT INTO schema_migrations (version) VALUES ('014_reconciliation_reports') ON CONFLICT DO NOTHING;
