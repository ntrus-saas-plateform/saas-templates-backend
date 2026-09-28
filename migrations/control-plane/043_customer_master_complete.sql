-- Migration 043: Customer master completeness (risk, price group, secondary contacts, defaults)

ALTER TABLE tenant_customers
  ADD COLUMN IF NOT EXISTS price_group_code VARCHAR(50),
  ADD COLUMN IF NOT EXISTS risk_level VARCHAR(30) NOT NULL DEFAULT 'NORMAL'
    CHECK (risk_level IN ('LOW', 'NORMAL', 'ELEVATED', 'HIGH', 'CRITICAL')),
  ADD COLUMN IF NOT EXISTS risk_score NUMERIC(8, 2),
  ADD COLUMN IF NOT EXISTS default_billing_address_id UUID,
  ADD COLUMN IF NOT EXISTS default_shipping_address_id UUID;

CREATE TABLE IF NOT EXISTS tenant_customer_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  tenant_customer_id UUID NOT NULL REFERENCES tenant_customers(id) ON DELETE CASCADE,
  full_name VARCHAR(255) NOT NULL,
  role VARCHAR(100),
  email VARCHAR(255),
  phone VARCHAR(50),
  is_primary BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenant_customer_contacts_customer
  ON tenant_customer_contacts (tenant_id, tenant_customer_id);

INSERT INTO schema_migrations (version) VALUES ('043_customer_master_complete') ON CONFLICT DO NOTHING;
