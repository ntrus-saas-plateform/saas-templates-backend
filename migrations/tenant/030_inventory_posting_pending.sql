-- Migration 030: Inventory posting pending (req 39) + orchestration payment-failure audit

CREATE TABLE IF NOT EXISTS inventory_posting_pending (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  warehouse_id UUID,
  sales_order_id UUID,
  reference_type VARCHAR(60),
  reference_id UUID,
  allocation_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  status VARCHAR(30) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'RETRYING', 'RESOLVED', 'FAILED', 'MANUAL')),
  retry_count INT NOT NULL DEFAULT 0,
  max_retries INT NOT NULL DEFAULT 10,
  last_error TEXT,
  correlation_id VARCHAR(64),
  causation_id VARCHAR(64),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_inv_posting_pending_status
  ON inventory_posting_pending (organization_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_inv_posting_pending_corr
  ON inventory_posting_pending (correlation_id);
