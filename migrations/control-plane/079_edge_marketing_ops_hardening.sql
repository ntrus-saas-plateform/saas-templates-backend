-- Migration 079: P3 marketing ops hardening
-- Frequency caps, journey wait schedules. No fake metrics.

CREATE TABLE IF NOT EXISTS edge_marketing_frequency_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  channel VARCHAR(64) NOT NULL,
  max_per_day INT NOT NULL DEFAULT 3 CHECK (max_per_day > 0),
  max_per_week INT NOT NULL DEFAULT 10 CHECK (max_per_week > 0),
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE','DISABLED')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_marketing_frequency_policies_code_key UNIQUE (code),
  CONSTRAINT edge_marketing_frequency_policies_channel_key UNIQUE (channel)
);

CREATE TABLE IF NOT EXISTS edge_marketing_frequency_counters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES edge_marketing_leads(id) ON DELETE CASCADE,
  channel VARCHAR(64) NOT NULL,
  window_type VARCHAR(16) NOT NULL CHECK (window_type IN ('DAY','WEEK')),
  window_start DATE NOT NULL,
  send_count INT NOT NULL DEFAULT 0 CHECK (send_count >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (lead_id, channel, window_type, window_start)
);

CREATE INDEX IF NOT EXISTS idx_edge_marketing_freq_counters_lead
  ON edge_marketing_frequency_counters (lead_id, channel);

CREATE TABLE IF NOT EXISTS edge_marketing_journey_wait_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID NOT NULL REFERENCES edge_marketing_journey_executions(id) ON DELETE CASCADE,
  step_key VARCHAR(128) NOT NULL,
  resume_at TIMESTAMPTZ NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING','RESUMED','CANCELLED','FAILED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resumed_at TIMESTAMPTZ,
  UNIQUE (execution_id, step_key)
);

CREATE INDEX IF NOT EXISTS idx_edge_marketing_journey_waits_due
  ON edge_marketing_journey_wait_schedules (status, resume_at)
  WHERE status = 'PENDING';

INSERT INTO edge_marketing_frequency_policies (code, name, channel, max_per_day, max_per_week, status)
VALUES
  ('EMAIL_DEFAULT', 'Default email frequency', 'EMAIL', 3, 10, 'ACTIVE'),
  ('WHATSAPP_DEFAULT', 'Default WhatsApp frequency', 'WHATSAPP_BUSINESS', 2, 6, 'ACTIVE')
ON CONFLICT (code) DO NOTHING;

INSERT INTO schema_migrations (version)
VALUES ('079_edge_marketing_ops_hardening')
ON CONFLICT DO NOTHING;
