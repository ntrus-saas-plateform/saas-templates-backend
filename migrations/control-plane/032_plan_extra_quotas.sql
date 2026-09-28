-- Control plane: plan quotas for customers and products

ALTER TABLE plans
  ADD COLUMN IF NOT EXISTS max_customers INTEGER NOT NULL DEFAULT 1000,
  ADD COLUMN IF NOT EXISTS max_products INTEGER NOT NULL DEFAULT 5000;

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS max_customers_override INTEGER,
  ADD COLUMN IF NOT EXISTS max_products_override INTEGER;

-- Seed BASIC / STANDARD / ENTERPRISE plan quota values
UPDATE plans SET max_customers = 500,   max_products = 200   WHERE code = 'BASIC';
UPDATE plans SET max_customers = 5000,  max_products = 2000  WHERE code = 'STANDARD';
UPDATE plans SET max_customers = 100000,max_products = 50000 WHERE code = 'ENTERPRISE';

INSERT INTO schema_migrations (version) VALUES ('032_plan_extra_quotas') ON CONFLICT DO NOTHING;
