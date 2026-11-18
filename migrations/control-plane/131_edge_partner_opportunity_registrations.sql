-- RGOM-E11 — Partner opportunity registration (conflict-window SoT).

CREATE TABLE IF NOT EXISTS edge_partner_opportunity_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_code VARCHAR(64) NOT NULL,
  account_name VARCHAR(255) NOT NULL,
  territory_code VARCHAR(64),
  product_segment VARCHAR(64),
  estimated_mrr NUMERIC(24, 8),
  status VARCHAR(32) NOT NULL DEFAULT 'REGISTERED'
    CHECK (status IN ('REGISTERED','ACCEPTED','REJECTED','EXPIRED','CONVERTED','WITHDRAWN')),
  registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  conflict_window_days INTEGER NOT NULL DEFAULT 30 CHECK (conflict_window_days >= 1),
  conflict_expires_at TIMESTAMPTZ NOT NULL,
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edge_partner_opp_partner_status
  ON edge_partner_opportunity_registrations (partner_code, status, registered_at DESC);

CREATE INDEX IF NOT EXISTS idx_edge_partner_opp_conflict
  ON edge_partner_opportunity_registrations (conflict_expires_at)
  WHERE status IN ('REGISTERED', 'ACCEPTED');

INSERT INTO schema_migrations (version) VALUES ('131_edge_partner_opportunity_registrations')
ON CONFLICT DO NOTHING;
