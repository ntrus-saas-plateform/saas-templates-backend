-- Migration 042: Customer commercial profile (credit, tax, group, payment terms)

ALTER TABLE tenant_customers
  ADD COLUMN IF NOT EXISTS credit_limit NUMERIC(18, 4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS credit_used NUMERIC(18, 4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_terms VARCHAR(50),
  ADD COLUMN IF NOT EXISTS currency_code VARCHAR(3) NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS tax_profile_code VARCHAR(50),
  ADD COLUMN IF NOT EXISTS customer_group_code VARCHAR(50),
  ADD COLUMN IF NOT EXISTS credit_hold BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE global_customers
  DROP CONSTRAINT IF EXISTS global_customers_type_check;

-- type is free VARCHAR; application enum expanded — no DB check historically beyond default

INSERT INTO schema_migrations (version) VALUES ('042_customer_commercial_profile') ON CONFLICT DO NOTHING;
