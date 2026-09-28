-- Migration 044: Loyalty concurrency + idempotent reference keys

-- Optimistic version for account mutations
ALTER TABLE loyalty_accounts
  ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1;

-- Idempotent ledger entries when reference is provided
CREATE UNIQUE INDEX IF NOT EXISTS uq_loyalty_tx_account_reference
  ON loyalty_transactions (account_id, reference_type, reference_id)
  WHERE reference_type IS NOT NULL AND reference_id IS NOT NULL;

INSERT INTO schema_migrations (version) VALUES ('044_loyalty_concurrency_idempotency')
ON CONFLICT DO NOTHING;
