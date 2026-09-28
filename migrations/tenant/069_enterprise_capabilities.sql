-- Promotes the former experimental commerce capabilities once their Core rules exist.
-- Instruments, store credit, supplier contracts, and settlements are ledgers on existing engines.

UPDATE capability_definitions
SET status = 'AVAILABLE', updated_at = NOW()
WHERE code IN (
  'WEB_POS', 'COUPONS', 'VOUCHERS', 'PROMOTION_STACKING', 'CTP', 'DELIVERY_FULFILLMENT',
  'WALLET_PAYMENT', 'PAYMENT_TERMINAL', 'ONLINE_PAYMENT', 'SETTLEMENT', 'EXCHANGES',
  'STORE_CREDIT', 'SUPPLIER_CONTRACTS', 'SUPPLIER_PERFORMANCE', 'LOADING', 'ONLINE',
  'BULK_ORDER', 'COSMETIC_VARIANTS'
);

CREATE TABLE IF NOT EXISTS commercial_instruments (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  code text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('COUPON', 'VOUCHER')),
  status text NOT NULL CHECK (status IN ('ACTIVE', 'REDEEMED', 'EXPIRED', 'VOID')),
  discount_percent numeric,
  face_value numeric,
  remaining_value numeric,
  min_order_amount numeric,
  valid_from timestamptz,
  valid_to timestamptz,
  max_redemptions integer,
  redemption_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, code)
);

CREATE TABLE IF NOT EXISTS store_credit_entries (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  customer_id uuid NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  direction text NOT NULL CHECK (direction IN ('ISSUE', 'REDEEM', 'VOID')),
  source_type text NOT NULL,
  source_id text NOT NULL,
  idempotency_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS supplier_contracts (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  supplier_id uuid NOT NULL,
  sku_id uuid,
  currency text NOT NULL,
  unit_price numeric NOT NULL CHECK (unit_price >= 0),
  valid_from timestamptz NOT NULL,
  valid_to timestamptz NOT NULL,
  status text NOT NULL CHECK (status IN ('ACTIVE', 'EXPIRED', 'SUSPENDED')),
  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payment_settlements (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  capture_total numeric NOT NULL,
  refund_total numeric NOT NULL,
  net numeric NOT NULL,
  status text NOT NULL CHECK (status = 'CLOSED'),
  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payment_settlement_lines (
  settlement_id uuid NOT NULL REFERENCES payment_settlements(id),
  payment_id text NOT NULL,
  method text NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  direction text NOT NULL CHECK (direction IN ('CAPTURE', 'REFUND')),
  PRIMARY KEY (settlement_id, payment_id, direction)
);

INSERT INTO schema_migrations (version) VALUES ('069_enterprise_capabilities')
ON CONFLICT DO NOTHING;
