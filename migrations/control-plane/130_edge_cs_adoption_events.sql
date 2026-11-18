-- RGOM-E9 — BB → Edge adoption / Aha event store (fail-closed consumers).
-- Soft refs only; does not invent activation from login alone.

CREATE TABLE IF NOT EXISTS edge_cs_adoption_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL,
  product_tenant_ref VARCHAR(255),
  event_code VARCHAR(128) NOT NULL,
  product_segment VARCHAR(32) NOT NULL
    CHECK (product_segment IN ('RETAIL_PHARMACY', 'WHOLESALE', 'RESTAURANT')),
  occurred_at TIMESTAMPTZ NOT NULL,
  source VARCHAR(32) NOT NULL DEFAULT 'BB'
    CHECK (source IN ('BB', 'EDGE_OPS', 'MANUAL')),
  correlation_id VARCHAR(128),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edge_cs_adoption_events_sub_occurred
  ON edge_cs_adoption_events (subscription_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_edge_cs_adoption_events_code
  ON edge_cs_adoption_events (event_code, occurred_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_edge_cs_adoption_events_idempotency
  ON edge_cs_adoption_events (subscription_id, event_code, correlation_id)
  WHERE correlation_id IS NOT NULL;

INSERT INTO schema_migrations (version) VALUES ('130_edge_cs_adoption_events')
ON CONFLICT DO NOTHING;
