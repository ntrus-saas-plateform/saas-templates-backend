-- Migration 134: Async provisioning job checkpoints (scale H1 — doc 39 W3)
-- Durable job table for deferred advance / worker processing. Fail-closed: no fake COMPLETE.

CREATE TABLE IF NOT EXISTS edge_provisioning_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL,
  job_type TEXT NOT NULL CHECK (job_type IN (
    'REQUEST_PROVISION',
    'ADVANCE_AFTER_PAID',
    'POLL_READY',
    'PUBLISH_ENTITLEMENTS',
    'ACTIVATE_SUBSCRIPTION'
  )),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN (
    'PENDING',
    'RUNNING',
    'SUCCEEDED',
    'FAILED',
    'DEAD_LETTER',
    'CANCELLED'
  )),
  attempt_count INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 8,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_error TEXT NULL,
  checkpoint JSONB NOT NULL DEFAULT '{}'::jsonb,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  correlation_id UUID NULL,
  idempotency_key TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_edge_provisioning_jobs_idempotency
  ON edge_provisioning_jobs (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_edge_provisioning_jobs_poll
  ON edge_provisioning_jobs (status, next_attempt_at)
  WHERE status IN ('PENDING', 'FAILED');

CREATE INDEX IF NOT EXISTS idx_edge_provisioning_jobs_subscription
  ON edge_provisioning_jobs (subscription_id, created_at DESC);

COMMENT ON TABLE edge_provisioning_jobs IS
  'RGOM W3 — durable provisioning steps; process via worker (EDGE_PROVISIONING_JOBS_ENABLED). Not a claim of 50k/s.';
