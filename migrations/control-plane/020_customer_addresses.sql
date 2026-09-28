-- Migration 020: Customer addresses

CREATE TABLE IF NOT EXISTS global_customer_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  global_customer_id UUID NOT NULL REFERENCES global_customers(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('HOME', 'WORK', 'BILLING', 'SHIPPING', 'OTHER')),
  country VARCHAR(2),
  province VARCHAR(100),
  city VARCHAR(100),
  district VARCHAR(100),
  commune VARCHAR(100),
  street VARCHAR(255),
  postal_code VARCHAR(20),
  latitude NUMERIC(10, 7),
  longitude NUMERIC(10, 7),
  delivery_instructions TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_global_customer_addresses_customer
  ON global_customer_addresses(global_customer_id);

INSERT INTO schema_migrations (version) VALUES ('020_customer_addresses') ON CONFLICT DO NOTHING;
