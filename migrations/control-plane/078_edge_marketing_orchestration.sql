-- Migration 078: P3 marketing orchestration extensions (additive on 077)
-- Journeys, deliveries, templates, attribution models, suppressions.
-- No fake delivery confirmations. Secrets stay in secret_ref only.

CREATE TABLE IF NOT EXISTS edge_marketing_message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  channel_type VARCHAR(64) NOT NULL,
  locale VARCHAR(16) NOT NULL DEFAULT 'en',
  subject VARCHAR(512),
  body JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT','APPROVED','ACTIVE','DEPRECATED','ARCHIVED')),
  version INT NOT NULL DEFAULT 1,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  CONSTRAINT edge_marketing_message_templates_code_key UNIQUE (code)
);

CREATE TABLE IF NOT EXISTS edge_marketing_delivery_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_config_id UUID REFERENCES edge_marketing_channel_configs(id) ON DELETE SET NULL,
  template_id UUID REFERENCES edge_marketing_message_templates(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES edge_marketing_campaigns(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES edge_marketing_leads(id) ON DELETE SET NULL,
  journey_execution_id UUID,
  status VARCHAR(32) NOT NULL DEFAULT 'REQUESTED'
    CHECK (status IN (
      'REQUESTED','QUEUED','SUBMITTED','DELIVERED','FAILED','BOUNCED',
      'SUPPRESSED','CANCELLED'
    )),
  provider_message_id VARCHAR(255),
  failure_code VARCHAR(128),
  failure_message TEXT,
  idempotency_key VARCHAR(128),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,
  terminal_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT edge_marketing_delivery_attempts_idempotency
    UNIQUE (idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_edge_marketing_delivery_lead
  ON edge_marketing_delivery_attempts (lead_id, requested_at DESC);

CREATE TABLE IF NOT EXISTS edge_marketing_delivery_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_attempt_id UUID NOT NULL REFERENCES edge_marketing_delivery_attempts(id) ON DELETE CASCADE,
  provider_event_id VARCHAR(255),
  receipt_status VARCHAR(32) NOT NULL
    CHECK (receipt_status IN ('DELIVERED','FAILED','BOUNCED','OPENED','CLICKED','UNKNOWN')),
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  signature_valid BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT edge_marketing_delivery_receipts_provider_event
    UNIQUE (provider_event_id)
);

CREATE TABLE IF NOT EXISTS edge_marketing_suppressions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_normalized VARCHAR(320),
  lead_id UUID REFERENCES edge_marketing_leads(id) ON DELETE SET NULL,
  channel VARCHAR(64) NOT NULL,
  reason VARCHAR(128) NOT NULL
    CHECK (reason IN ('UNSUBSCRIBE','CONSENT_WITHDRAWN','BOUNCE','MANUAL','COMPLAINT')),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deactivated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_edge_marketing_suppressions_email
  ON edge_marketing_suppressions (email_normalized, channel)
  WHERE active = TRUE;

CREATE TABLE IF NOT EXISTS edge_marketing_journeys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  product_id UUID REFERENCES edge_products(id) ON DELETE SET NULL,
  trigger_type VARCHAR(64) NOT NULL
    CHECK (trigger_type IN (
      'FORM_SUBMITTED','DEMO_REQUESTED','RESOURCE_DOWNLOADED','WEBINAR_REGISTERED',
      'EVENT_ATTENDED','TRIAL_REQUESTED','INACTIVE_AFTER_INTERACTION','MANUAL'
    )),
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT','ACTIVE','PAUSED','DEPRECATED','ARCHIVED')),
  version INT NOT NULL DEFAULT 1,
  definition JSONB NOT NULL DEFAULT '{"steps":[]}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  CONSTRAINT edge_marketing_journeys_code_key UNIQUE (code)
);

CREATE TABLE IF NOT EXISTS edge_marketing_journey_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id UUID NOT NULL REFERENCES edge_marketing_journeys(id) ON DELETE RESTRICT,
  journey_version INT NOT NULL,
  lead_id UUID NOT NULL REFERENCES edge_marketing_leads(id) ON DELETE CASCADE,
  status VARCHAR(32) NOT NULL DEFAULT 'RUNNING'
    CHECK (status IN (
      'RUNNING','WAITING','COMPLETED','STOPPED','FAILED','EXITED_CONVERSION',
      'EXITED_UNSUBSCRIBE'
    )),
  current_step_key VARCHAR(128),
  idempotency_key VARCHAR(128) NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT edge_marketing_journey_executions_idempotency UNIQUE (idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_edge_marketing_journey_exec_lead
  ON edge_marketing_journey_executions (lead_id, started_at DESC);

ALTER TABLE edge_marketing_delivery_attempts
  DROP CONSTRAINT IF EXISTS edge_marketing_delivery_attempts_journey_fk;
ALTER TABLE edge_marketing_delivery_attempts
  ADD CONSTRAINT edge_marketing_delivery_attempts_journey_fk
  FOREIGN KEY (journey_execution_id)
  REFERENCES edge_marketing_journey_executions(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS edge_marketing_journey_execution_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID NOT NULL REFERENCES edge_marketing_journey_executions(id) ON DELETE CASCADE,
  step_key VARCHAR(128) NOT NULL,
  step_type VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING','EXECUTED','SKIPPED','FAILED','WAITING')),
  result JSONB NOT NULL DEFAULT '{}'::jsonb,
  executed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (execution_id, step_key)
);

CREATE TABLE IF NOT EXISTS edge_marketing_attribution_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  model_type VARCHAR(32) NOT NULL
    CHECK (model_type IN (
      'FIRST_TOUCH','LAST_TOUCH','LINEAR','POSITION_BASED','TIME_DECAY','CAMPAIGN'
    )),
  version INT NOT NULL DEFAULT 1,
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('DRAFT','ACTIVE','DEPRECATED')),
  parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_marketing_attribution_models_code_version UNIQUE (code, version)
);

CREATE TABLE IF NOT EXISTS edge_marketing_attribution_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id UUID NOT NULL REFERENCES edge_marketing_attribution_models(id) ON DELETE RESTRICT,
  model_version INT NOT NULL,
  lead_id UUID NOT NULL REFERENCES edge_marketing_leads(id) ON DELETE CASCADE,
  conversion_key VARCHAR(128) NOT NULL,
  credits JSONB NOT NULL DEFAULT '[]'::jsonb,
  data_quality VARCHAR(16) NOT NULL DEFAULT 'MEASURED'
    CHECK (data_quality IN ('MEASURED','ESTIMATED','UNAVAILABLE')),
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (model_id, model_version, lead_id, conversion_key)
);

CREATE TABLE IF NOT EXISTS edge_marketing_performance_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_type VARCHAR(32) NOT NULL
    CHECK (scope_type IN ('GLOBAL','PRODUCT','VERTICAL','CAMPAIGN','CHANNEL')),
  scope_id UUID,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  metric_quality JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO edge_marketing_attribution_models (code, name, model_type, version, status, parameters)
VALUES
  ('FIRST_TOUCH', 'First touch', 'FIRST_TOUCH', 1, 'ACTIVE', '{}'::jsonb),
  ('LAST_TOUCH', 'Last touch', 'LAST_TOUCH', 1, 'ACTIVE', '{}'::jsonb),
  ('LINEAR', 'Linear', 'LINEAR', 1, 'ACTIVE', '{}'::jsonb)
ON CONFLICT (code, version) DO NOTHING;

INSERT INTO schema_migrations (version)
VALUES ('078_edge_marketing_orchestration')
ON CONFLICT DO NOTHING;
