-- P3 Resend correlation lookups
CREATE INDEX IF NOT EXISTS idx_edge_marketing_delivery_provider_message
  ON edge_marketing_delivery_attempts (provider_message_id)
  WHERE provider_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_edge_marketing_delivery_receipts_attempt
  ON edge_marketing_delivery_receipts (delivery_attempt_id, received_at DESC);
