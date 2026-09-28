-- Migration 017: Complete commercial reqs 4-14 (customer master, groups, ATP/CTP, backorders, allocation)

-- ========== CUSTOMER MASTER (control-plane fields mirrored usage; tenant contacts/groups) ==========
-- Secondary contacts live on control plane next to customers (migration 043). This tenant migration
-- extends commercial group policies and inventory/sales line completeness.

ALTER TABLE customer_groups
  ADD COLUMN IF NOT EXISTS discount_percent NUMERIC(8, 4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS credit_limit_default NUMERIC(18, 4),
  ADD COLUMN IF NOT EXISTS payment_terms_default VARCHAR(50),
  ADD COLUMN IF NOT EXISTS promotion_eligible BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sla_hours INT,
  ADD COLUMN IF NOT EXISTS delivery_priority INT NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS influences JSONB NOT NULL DEFAULT '{}'::jsonb;

INSERT INTO customer_groups (organization_id, code, name, allocation_priority, discount_percent, delivery_priority, influences)
SELECT ow.organization_id, g.code, g.name, g.allocation_priority, g.discount_percent, g.delivery_priority, g.influences::jsonb
FROM (SELECT DISTINCT organization_id FROM org_warehouses) ow
CROSS JOIN (
  VALUES
    ('RETAIL', 'Retail', 100, 0, 100, '{"price":true,"discounts":true,"credit":true,"payment":true,"promotions":true,"allocation":true,"sla":true,"delivery":true}'),
    ('WHOLESALE', 'Wholesale', 80, 5, 90, '{"price":true,"discounts":true,"credit":true,"payment":true,"promotions":true,"allocation":true,"sla":true,"delivery":true}'),
    ('HOSPITAL', 'Hospital', 10, 0, 10, '{"price":true,"discounts":true,"credit":true,"payment":true,"promotions":false,"allocation":true,"sla":true,"delivery":true}'),
    ('PHARMACY', 'Pharmacy', 40, 2, 40, '{"price":true,"discounts":true,"credit":true,"payment":true,"promotions":true,"allocation":true,"sla":true,"delivery":true}'),
    ('VIP', 'VIP', 50, 10, 20, '{"price":true,"discounts":true,"credit":true,"payment":true,"promotions":true,"allocation":true,"sla":true,"delivery":true}'),
    ('CORPORATE', 'Corporate', 60, 3, 50, '{"price":true,"discounts":true,"credit":true,"payment":true,"promotions":true,"allocation":true,"sla":true,"delivery":true}'),
    ('GOVERNMENT', 'Government', 30, 0, 30, '{"price":true,"discounts":true,"credit":true,"payment":true,"promotions":false,"allocation":true,"sla":true,"delivery":true}'),
    ('DISTRIBUTOR', 'Distributor', 70, 8, 70, '{"price":true,"discounts":true,"credit":true,"payment":true,"promotions":true,"allocation":true,"sla":true,"delivery":true}'),
    ('INTERNAL', 'Internal', 20, 0, 5, '{"price":true,"discounts":false,"credit":false,"payment":false,"promotions":false,"allocation":true,"sla":true,"delivery":true}')
) AS g(code, name, allocation_priority, discount_percent, delivery_priority, influences)
ON CONFLICT (organization_id, code) DO NOTHING;

-- Seed groups for orgs that may not have warehouses yet: noop if empty.

ALTER TABLE sales_order_lines
  ADD COLUMN IF NOT EXISTS product_id UUID;

ALTER TABLE sales_quotation_lines
  ADD COLUMN IF NOT EXISTS product_id UUID;

ALTER TABLE sales_quotations
  ADD COLUMN IF NOT EXISTS conditions TEXT,
  ADD COLUMN IF NOT EXISTS attachment_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS approval_required BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by VARCHAR(100);

CREATE TABLE IF NOT EXISTS sales_quotation_transitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id UUID NOT NULL REFERENCES sales_quotations(id) ON DELETE CASCADE,
  from_status VARCHAR(40),
  to_status VARCHAR(40) NOT NULL,
  actor_id VARCHAR(100),
  reason TEXT,
  correlation_id VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ========== ATP POLICY / INBOUND / SAFETY ==========
CREATE TABLE IF NOT EXISTS inventory_atp_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  code VARCHAR(50) NOT NULL DEFAULT 'DEFAULT',
  include_inbound BOOLEAN NOT NULL DEFAULT true,
  include_open_orders BOOLEAN NOT NULL DEFAULT true,
  include_transfers BOOLEAN NOT NULL DEFAULT true,
  subtract_safety_stock BOOLEAN NOT NULL DEFAULT true,
  subtract_blocked BOOLEAN NOT NULL DEFAULT true,
  subtract_protected BOOLEAN NOT NULL DEFAULT true,
  safety_stock_default NUMERIC(18, 4) NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, code)
);

CREATE TABLE IF NOT EXISTS inventory_sku_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  sku_id UUID NOT NULL REFERENCES product_skus(id) ON DELETE CASCADE,
  warehouse_id UUID REFERENCES org_warehouses(id) ON DELETE CASCADE,
  safety_stock NUMERIC(18, 4) NOT NULL DEFAULT 0,
  protected_stock NUMERIC(18, 4) NOT NULL DEFAULT 0,
  allocation_strategy VARCHAR(40) NOT NULL DEFAULT 'FEFO'
    CHECK (allocation_strategy IN (
      'FIFO', 'FEFO', 'PRIORITY', 'CUSTOMER_PRIORITY', 'CHANNEL_PRIORITY',
      'ORDER_PRIORITY', 'MARGIN_PRIORITY', 'EXPIRY_RISK', 'MANUAL', 'RULE_BASED'
    )),
  UNIQUE (organization_id, sku_id, warehouse_id)
);

CREATE TABLE IF NOT EXISTS inventory_inbound (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  warehouse_id UUID NOT NULL REFERENCES org_warehouses(id) ON DELETE CASCADE,
  sku_id UUID NOT NULL REFERENCES product_skus(id) ON DELETE CASCADE,
  quantity NUMERIC(18, 4) NOT NULL,
  quantity_received NUMERIC(18, 4) NOT NULL DEFAULT 0,
  expected_at TIMESTAMPTZ NOT NULL,
  source_type VARCHAR(40) NOT NULL DEFAULT 'PURCHASE'
    CHECK (source_type IN ('PURCHASE', 'TRANSFER', 'PRODUCTION', 'OTHER')),
  source_ref VARCHAR(100),
  status VARCHAR(30) NOT NULL DEFAULT 'CONFIRMED'
    CHECK (status IN ('PLANNED', 'CONFIRMED', 'RECEIVED', 'CANCELLED')),
  lead_time_days INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_inbound_sku_wh
  ON inventory_inbound (sku_id, warehouse_id, expected_at)
  WHERE status = 'CONFIRMED';

ALTER TABLE stock_lots
  ADD COLUMN IF NOT EXISTS temperature_class VARCHAR(30),
  ADD COLUMN IF NOT EXISTS quantity_in_transit NUMERIC(18, 4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS restrictions JSONB NOT NULL DEFAULT '{}'::jsonb;

-- ========== BACKORDERS LIFECYCLE ==========
ALTER TABLE backorders
  ADD COLUMN IF NOT EXISTS supply_source VARCHAR(40),
  ADD COLUMN IF NOT EXISTS warehouse_id UUID,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

DO $$
BEGIN
  ALTER TABLE backorders DROP CONSTRAINT IF EXISTS backorders_status_check;
  ALTER TABLE backorders ADD CONSTRAINT backorders_status_check
    CHECK (status IN ('OPEN', 'PARTIAL', 'FULFILLED', 'CANCELLED', 'SUBSTITUTED'));
EXCEPTION WHEN others THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS backorder_transitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  backorder_id UUID NOT NULL REFERENCES backorders(id) ON DELETE CASCADE,
  from_status VARCHAR(40),
  to_status VARCHAR(40) NOT NULL,
  actor_id VARCHAR(100),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ========== ALLOCATION MANUAL OVERRIDES ==========
CREATE TABLE IF NOT EXISTS inventory_manual_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  sales_order_id UUID NOT NULL,
  sales_order_line_id UUID NOT NULL,
  lot_id UUID NOT NULL REFERENCES stock_lots(id),
  quantity NUMERIC(18, 4) NOT NULL,
  reason TEXT,
  actor_id VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO schema_migrations (version) VALUES ('017_commercial_reqs_4_14') ON CONFLICT DO NOTHING;
