-- Migration 016: Commercial engine Tranche 1 (catalog, inventory, pricing, sales, fulfillment, finance)

-- ========== CATALOG ==========
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  code VARCHAR(80) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(40) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'INACTIVE', 'DISCONTINUED', 'BLOCKED', 'RECALLED', 'OUT_OF_MARKET', 'TEMPORARILY_UNAVAILABLE')),
  tax_category VARCHAR(50),
  lot_tracking_required BOOLEAN NOT NULL DEFAULT true,
  serial_tracking_required BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, code)
);

CREATE INDEX IF NOT EXISTS idx_products_org_status ON products (organization_id, status);

CREATE TABLE IF NOT EXISTS product_skus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku VARCHAR(80) NOT NULL,
  name VARCHAR(255) NOT NULL,
  uom VARCHAR(20) NOT NULL DEFAULT 'EA',
  status VARCHAR(40) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'INACTIVE', 'DISCONTINUED', 'BLOCKED', 'RECALLED', 'OUT_OF_MARKET', 'TEMPORARILY_UNAVAILABLE')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (sku)
);

CREATE INDEX IF NOT EXISTS idx_product_skus_product ON product_skus (product_id);

CREATE TABLE IF NOT EXISTS product_barcodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku_id UUID NOT NULL REFERENCES product_skus(id) ON DELETE CASCADE,
  barcode VARCHAR(64) NOT NULL,
  symbology VARCHAR(30) NOT NULL DEFAULT 'EAN13',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (barcode)
);

CREATE INDEX IF NOT EXISTS idx_product_barcodes_sku ON product_barcodes (sku_id);

CREATE TABLE IF NOT EXISTS product_uoms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku_id UUID NOT NULL REFERENCES product_skus(id) ON DELETE CASCADE,
  uom VARCHAR(20) NOT NULL,
  factor_to_base NUMERIC(18, 6) NOT NULL DEFAULT 1,
  is_base BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (sku_id, uom)
);

-- ========== CUSTOMER GROUPS / CHANNELS ==========
CREATE TABLE IF NOT EXISTS customer_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  allocation_priority INT NOT NULL DEFAULT 100,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, code)
);

CREATE TABLE IF NOT EXISTS sales_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  warehouse_id UUID REFERENCES org_warehouses(id) ON DELETE SET NULL,
  price_list_id UUID,
  allocation_priority INT NOT NULL DEFAULT 100,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, code)
);

-- ========== PRICING ==========
CREATE TABLE IF NOT EXISTS price_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  channel_id UUID REFERENCES sales_channels(id) ON DELETE SET NULL,
  customer_group_id UUID REFERENCES customer_groups(id) ON DELETE SET NULL,
  tax_included BOOLEAN NOT NULL DEFAULT false,
  priority INT NOT NULL DEFAULT 100,
  valid_from TIMESTAMPTZ,
  valid_to TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, code)
);

ALTER TABLE sales_channels
  DROP CONSTRAINT IF EXISTS sales_channels_price_list_id_fkey;
ALTER TABLE sales_channels
  ADD CONSTRAINT sales_channels_price_list_id_fkey
  FOREIGN KEY (price_list_id) REFERENCES price_lists(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS price_list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  price_list_id UUID NOT NULL REFERENCES price_lists(id) ON DELETE CASCADE,
  sku_id UUID NOT NULL REFERENCES product_skus(id) ON DELETE CASCADE,
  unit_price NUMERIC(18, 4) NOT NULL,
  min_qty NUMERIC(18, 4) NOT NULL DEFAULT 1,
  valid_from TIMESTAMPTZ,
  valid_to TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (price_list_id, sku_id, min_qty)
);

CREATE INDEX IF NOT EXISTS idx_price_list_items_sku ON price_list_items (sku_id);

CREATE TABLE IF NOT EXISTS tax_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  rate NUMERIC(8, 6) NOT NULL,
  tax_category VARCHAR(50),
  valid_from TIMESTAMPTZ,
  valid_to TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, code)
);

CREATE TABLE IF NOT EXISTS promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  promo_type VARCHAR(40) NOT NULL DEFAULT 'PERCENTAGE'
    CHECK (promo_type IN ('PERCENTAGE', 'FIXED', 'BUY_X_GET_Y')),
  value NUMERIC(18, 4) NOT NULL DEFAULT 0,
  priority INT NOT NULL DEFAULT 100,
  stackable BOOLEAN NOT NULL DEFAULT false,
  valid_from TIMESTAMPTZ,
  valid_to TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, code)
);

-- ========== INVENTORY ==========
CREATE TABLE IF NOT EXISTS stock_lots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  warehouse_id UUID NOT NULL REFERENCES org_warehouses(id) ON DELETE RESTRICT,
  location_id UUID REFERENCES org_warehouse_locations(id) ON DELETE SET NULL,
  sku_id UUID NOT NULL REFERENCES product_skus(id) ON DELETE RESTRICT,
  lot_number VARCHAR(100) NOT NULL,
  expires_at DATE,
  quality_status VARCHAR(30) NOT NULL DEFAULT 'AVAILABLE'
    CHECK (quality_status IN ('AVAILABLE', 'QUARANTINE', 'RECALLED', 'EXPIRED', 'DAMAGED', 'BLOCKED')),
  ownership VARCHAR(30) NOT NULL DEFAULT 'OWNED'
    CHECK (ownership IN ('OWNED', 'CONSIGNED', 'CUSTOMER_OWNED', 'SUPPLIER_OWNED', 'THIRD_PARTY')),
  quantity_on_hand NUMERIC(18, 4) NOT NULL DEFAULT 0,
  quantity_reserved NUMERIC(18, 4) NOT NULL DEFAULT 0,
  quantity_allocated NUMERIC(18, 4) NOT NULL DEFAULT 0,
  version INT NOT NULL DEFAULT 1,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (warehouse_id, sku_id, lot_number),
  CHECK (quantity_on_hand >= 0),
  CHECK (quantity_reserved >= 0),
  CHECK (quantity_allocated >= 0),
  CHECK (quantity_reserved <= quantity_on_hand),
  CHECK (quantity_allocated <= quantity_reserved)
);

CREATE INDEX IF NOT EXISTS idx_stock_lots_sku_wh ON stock_lots (sku_id, warehouse_id);
CREATE INDEX IF NOT EXISTS idx_stock_lots_expiry ON stock_lots (expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_stock_lots_quality ON stock_lots (quality_status);

CREATE TABLE IF NOT EXISTS inventory_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  warehouse_id UUID NOT NULL,
  sku_id UUID NOT NULL,
  lot_id UUID REFERENCES stock_lots(id) ON DELETE SET NULL,
  entry_type VARCHAR(40) NOT NULL
    CHECK (entry_type IN (
      'RECEIPT', 'SALE', 'RETURN', 'TRANSFER_IN', 'TRANSFER_OUT',
      'ADJUSTMENT', 'DISPOSAL', 'QUARANTINE', 'RELEASE',
      'RESERVATION', 'ALLOCATION', 'RESERVATION_RELEASE', 'ISSUE'
    )),
  quantity_delta NUMERIC(18, 4) NOT NULL,
  quantity_after NUMERIC(18, 4),
  reference_type VARCHAR(50),
  reference_id UUID,
  reason TEXT,
  actor_id VARCHAR(100),
  correlation_id VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_ledger_sku ON inventory_ledger (sku_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_ledger_ref ON inventory_ledger (reference_type, reference_id);

CREATE TABLE IF NOT EXISTS inventory_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  warehouse_id UUID NOT NULL REFERENCES org_warehouses(id),
  sku_id UUID NOT NULL REFERENCES product_skus(id),
  sales_order_id UUID,
  sales_order_line_id UUID,
  quantity NUMERIC(18, 4) NOT NULL,
  quantity_allocated NUMERIC(18, 4) NOT NULL DEFAULT 0,
  status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'ALLOCATED', 'RELEASED', 'EXPIRED', 'CONSUMED')),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inv_reservations_order ON inventory_reservations (sales_order_id);
CREATE INDEX IF NOT EXISTS idx_inv_reservations_sku ON inventory_reservations (sku_id, status);

CREATE TABLE IF NOT EXISTS inventory_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID NOT NULL REFERENCES inventory_reservations(id) ON DELETE CASCADE,
  lot_id UUID NOT NULL REFERENCES stock_lots(id) ON DELETE RESTRICT,
  quantity NUMERIC(18, 4) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'ALLOCATED'
    CHECK (status IN ('ALLOCATED', 'PICKED', 'SHIPPED', 'RELEASED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inv_allocations_lot ON inventory_allocations (lot_id);

CREATE TABLE IF NOT EXISTS backorders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  sales_order_id UUID NOT NULL,
  sales_order_line_id UUID NOT NULL,
  sku_id UUID NOT NULL REFERENCES product_skus(id),
  quantity NUMERIC(18, 4) NOT NULL,
  quantity_fulfilled NUMERIC(18, 4) NOT NULL DEFAULT 0,
  priority INT NOT NULL DEFAULT 100,
  status VARCHAR(30) NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN', 'PARTIAL', 'FULFILLED', 'CANCELLED')),
  expected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ========== SALES ==========
CREATE TABLE IF NOT EXISTS carts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  channel_id UUID REFERENCES sales_channels(id) ON DELETE SET NULL,
  customer_id UUID,
  cart_type VARCHAR(30) NOT NULL DEFAULT 'CUSTOMER'
    CHECK (cart_type IN ('ANONYMOUS', 'CUSTOMER', 'B2B', 'POS', 'MOBILE', 'ONLINE')),
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  status VARCHAR(20) NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN', 'CONVERTED', 'ABANDONED', 'EXPIRED')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cart_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id UUID NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  sku_id UUID NOT NULL REFERENCES product_skus(id),
  quantity NUMERIC(18, 4) NOT NULL,
  unit_price NUMERIC(18, 4),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sales_quotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  quotation_number VARCHAR(50) NOT NULL,
  customer_id UUID NOT NULL,
  channel_id UUID REFERENCES sales_channels(id) ON DELETE SET NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'SENT', 'VIEWED', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CONVERTED', 'CANCELLED')),
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  valid_until TIMESTAMPTZ,
  subtotal NUMERIC(18, 4) NOT NULL DEFAULT 0,
  discount_total NUMERIC(18, 4) NOT NULL DEFAULT 0,
  tax_total NUMERIC(18, 4) NOT NULL DEFAULT 0,
  grand_total NUMERIC(18, 4) NOT NULL DEFAULT 0,
  notes TEXT,
  snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  converted_order_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, quotation_number)
);

CREATE TABLE IF NOT EXISTS sales_quotation_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id UUID NOT NULL REFERENCES sales_quotations(id) ON DELETE CASCADE,
  sku_id UUID NOT NULL,
  sku_code VARCHAR(80) NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  quantity NUMERIC(18, 4) NOT NULL,
  uom VARCHAR(20) NOT NULL DEFAULT 'EA',
  unit_price NUMERIC(18, 4) NOT NULL,
  discount_amount NUMERIC(18, 4) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(18, 4) NOT NULL DEFAULT 0,
  line_total NUMERIC(18, 4) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sales_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  order_number VARCHAR(50) NOT NULL,
  customer_id UUID NOT NULL,
  channel_id UUID REFERENCES sales_channels(id) ON DELETE SET NULL,
  warehouse_id UUID REFERENCES org_warehouses(id) ON DELETE SET NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN (
      'DRAFT', 'PENDING_APPROVAL', 'CONFIRMED', 'PAYMENT_PENDING', 'PAID', 'PARTIALLY_PAID',
      'ALLOCATING', 'ALLOCATED', 'PARTIALLY_ALLOCATED', 'PICKING', 'PARTIALLY_FULFILLED',
      'FULFILLED', 'PARTIALLY_SHIPPED', 'SHIPPED', 'DELIVERED', 'COMPLETED',
      'BACKORDERED', 'CANCELLED'
    )),
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  subtotal NUMERIC(18, 4) NOT NULL DEFAULT 0,
  discount_total NUMERIC(18, 4) NOT NULL DEFAULT 0,
  tax_total NUMERIC(18, 4) NOT NULL DEFAULT 0,
  grand_total NUMERIC(18, 4) NOT NULL DEFAULT 0,
  amount_paid NUMERIC(18, 4) NOT NULL DEFAULT 0,
  customer_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT,
  version INT NOT NULL DEFAULT 1,
  confirmed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, order_number)
);

CREATE INDEX IF NOT EXISTS idx_sales_orders_customer ON sales_orders (customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_status ON sales_orders (organization_id, status);
CREATE INDEX IF NOT EXISTS idx_sales_orders_created ON sales_orders (created_at DESC);

CREATE TABLE IF NOT EXISTS sales_order_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_order_id UUID NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
  line_number INT NOT NULL,
  sku_id UUID NOT NULL,
  sku_code VARCHAR(80) NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  uom VARCHAR(20) NOT NULL DEFAULT 'EA',
  quantity_ordered NUMERIC(18, 4) NOT NULL,
  quantity_reserved NUMERIC(18, 4) NOT NULL DEFAULT 0,
  quantity_allocated NUMERIC(18, 4) NOT NULL DEFAULT 0,
  quantity_picked NUMERIC(18, 4) NOT NULL DEFAULT 0,
  quantity_shipped NUMERIC(18, 4) NOT NULL DEFAULT 0,
  quantity_delivered NUMERIC(18, 4) NOT NULL DEFAULT 0,
  quantity_returned NUMERIC(18, 4) NOT NULL DEFAULT 0,
  quantity_backordered NUMERIC(18, 4) NOT NULL DEFAULT 0,
  unit_price NUMERIC(18, 4) NOT NULL,
  discount_amount NUMERIC(18, 4) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(18, 4) NOT NULL DEFAULT 0,
  line_gross NUMERIC(18, 4) NOT NULL,
  line_net NUMERIC(18, 4) NOT NULL,
  snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (sales_order_id, line_number),
  CHECK (quantity_reserved <= quantity_ordered),
  CHECK (quantity_allocated <= quantity_reserved),
  CHECK (quantity_picked <= quantity_allocated),
  CHECK (quantity_shipped <= quantity_picked),
  CHECK (quantity_delivered <= quantity_shipped),
  CHECK (quantity_returned <= quantity_delivered)
);

CREATE INDEX IF NOT EXISTS idx_sales_order_lines_sku ON sales_order_lines (sku_id);

CREATE TABLE IF NOT EXISTS sales_order_transitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_order_id UUID NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
  from_status VARCHAR(40),
  to_status VARCHAR(40) NOT NULL,
  actor_id VARCHAR(100),
  reason TEXT,
  correlation_id VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ========== FULFILLMENT ==========
CREATE TABLE IF NOT EXISTS pick_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  sales_order_id UUID NOT NULL REFERENCES sales_orders(id) ON DELETE RESTRICT,
  warehouse_id UUID NOT NULL,
  pick_number VARCHAR(50) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  UNIQUE (organization_id, pick_number)
);

CREATE TABLE IF NOT EXISTS pick_ticket_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pick_ticket_id UUID NOT NULL REFERENCES pick_tickets(id) ON DELETE CASCADE,
  sales_order_line_id UUID NOT NULL,
  allocation_id UUID REFERENCES inventory_allocations(id),
  lot_id UUID,
  sku_id UUID NOT NULL,
  quantity_to_pick NUMERIC(18, 4) NOT NULL,
  quantity_picked NUMERIC(18, 4) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  sales_order_id UUID NOT NULL REFERENCES sales_orders(id) ON DELETE RESTRICT,
  shipment_number VARCHAR(50) NOT NULL,
  warehouse_id UUID NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'CREATED'
    CHECK (status IN ('CREATED', 'SHIPPED', 'DELIVERED', 'CANCELLED')),
  carrier VARCHAR(100),
  tracking_number VARCHAR(100),
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, shipment_number)
);

CREATE TABLE IF NOT EXISTS shipment_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  sales_order_line_id UUID NOT NULL,
  lot_id UUID,
  sku_id UUID NOT NULL,
  quantity NUMERIC(18, 4) NOT NULL
);

-- ========== FINANCE ==========
CREATE TABLE IF NOT EXISTS commercial_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  invoice_number VARCHAR(50) NOT NULL,
  sales_order_id UUID REFERENCES sales_orders(id) ON DELETE SET NULL,
  customer_id UUID NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'POSTED', 'CANCELLED', 'VOID')),
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  subtotal NUMERIC(18, 4) NOT NULL DEFAULT 0,
  tax_total NUMERIC(18, 4) NOT NULL DEFAULT 0,
  grand_total NUMERIC(18, 4) NOT NULL DEFAULT 0,
  amount_paid NUMERIC(18, 4) NOT NULL DEFAULT 0,
  posted_at TIMESTAMPTZ,
  snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, invoice_number)
);

CREATE TABLE IF NOT EXISTS commercial_invoice_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES commercial_invoices(id) ON DELETE CASCADE,
  sales_order_line_id UUID,
  sku_code VARCHAR(80) NOT NULL,
  description VARCHAR(255) NOT NULL,
  quantity NUMERIC(18, 4) NOT NULL,
  unit_price NUMERIC(18, 4) NOT NULL,
  tax_amount NUMERIC(18, 4) NOT NULL DEFAULT 0,
  line_total NUMERIC(18, 4) NOT NULL
);

CREATE TABLE IF NOT EXISTS commercial_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  payment_number VARCHAR(50) NOT NULL,
  customer_id UUID NOT NULL,
  invoice_id UUID REFERENCES commercial_invoices(id) ON DELETE SET NULL,
  sales_order_id UUID REFERENCES sales_orders(id) ON DELETE SET NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'CAPTURED'
    CHECK (status IN ('PENDING', 'CAPTURED', 'FAILED', 'REFUNDED')),
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  amount NUMERIC(18, 4) NOT NULL,
  method VARCHAR(40) NOT NULL
    CHECK (method IN ('CASH', 'CARD', 'MOBILE_MONEY', 'BANK_TRANSFER', 'WALLET', 'CREDIT', 'MIXED')),
  methods JSONB NOT NULL DEFAULT '[]'::jsonb,
  idempotency_key VARCHAR(100),
  captured_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, payment_number),
  UNIQUE (organization_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS commercial_payment_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES commercial_payments(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES commercial_invoices(id) ON DELETE RESTRICT,
  amount NUMERIC(18, 4) NOT NULL
);

-- Extra document sequences
INSERT INTO tenant_number_sequences (document_type, prefix, pad_length, reset_policy)
VALUES
  ('QT', 'QT-', 6, 'YEAR'),
  ('PICK', 'PICK-', 6, 'YEAR'),
  ('SHP', 'SHP-', 6, 'YEAR'),
  ('PAY', 'PAY-', 6, 'YEAR'),
  ('RET', 'RET-', 6, 'YEAR')
ON CONFLICT DO NOTHING;

INSERT INTO schema_migrations (version) VALUES ('016_commercial_core') ON CONFLICT DO NOTHING;
