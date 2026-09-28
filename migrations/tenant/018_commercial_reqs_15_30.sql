-- Migration 018: Commercial requirements 15-30
-- Substitution, kits/bundles, consignment ops, channels, promotions, discount auth,
-- tax engine, multi-warehouse fulfillment, pick strategies, packing

-- ========== 15 SUBSTITUTION ==========
CREATE TABLE IF NOT EXISTS product_substitutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  source_sku_id UUID NOT NULL REFERENCES product_skus(id) ON DELETE CASCADE,
  substitute_sku_id UUID NOT NULL REFERENCES product_skus(id) ON DELETE CASCADE,
  priority INT NOT NULL DEFAULT 100,
  requires_approval BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  max_quantity NUMERIC(18, 4),
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, source_sku_id, substitute_sku_id),
  CHECK (source_sku_id <> substitute_sku_id)
);

CREATE INDEX IF NOT EXISTS idx_product_substitutions_source
  ON product_substitutions (organization_id, source_sku_id)
  WHERE is_active;

CREATE TABLE IF NOT EXISTS substitution_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  sales_order_id UUID,
  sales_order_line_id UUID,
  source_sku_id UUID NOT NULL,
  substitute_sku_id UUID NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
  requested_by VARCHAR(100),
  decided_by VARCHAR(100),
  decided_at TIMESTAMPTZ,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ========== 16 KITS / BUNDLES ==========
CREATE TABLE IF NOT EXISTS product_kits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  kit_sku_id UUID NOT NULL REFERENCES product_skus(id) ON DELETE CASCADE,
  kit_type VARCHAR(40) NOT NULL DEFAULT 'KIT'
    CHECK (kit_type IN ('KIT', 'BUNDLE', 'PACK', 'COMBO', 'VIRTUAL_BUNDLE', 'PHYSICAL_BUNDLE')),
  stock_mode VARCHAR(40) NOT NULL DEFAULT 'EXPLODED'
    CHECK (stock_mode IN ('AS_BUNDLE', 'EXPLODED')),
  name VARCHAR(255) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, kit_sku_id)
);

CREATE TABLE IF NOT EXISTS product_kit_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kit_id UUID NOT NULL REFERENCES product_kits(id) ON DELETE CASCADE,
  component_sku_id UUID NOT NULL REFERENCES product_skus(id) ON DELETE RESTRICT,
  quantity NUMERIC(18, 4) NOT NULL CHECK (quantity > 0),
  is_optional BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  UNIQUE (kit_id, component_sku_id)
);

-- ========== 17 CONSIGNMENT — operational separation ==========
CREATE TABLE IF NOT EXISTS consignment_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  ownership VARCHAR(30) NOT NULL
    CHECK (ownership IN ('OWNED', 'CONSIGNED', 'CUSTOMER_OWNED', 'SUPPLIER_OWNED', 'THIRD_PARTY')),
  partner_ref VARCHAR(100),
  is_sellable BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, code)
);

ALTER TABLE stock_lots
  ADD COLUMN IF NOT EXISTS consignment_account_id UUID REFERENCES consignment_accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_stock_lots_ownership
  ON stock_lots (organization_id, ownership, sku_id);

-- ========== 18-19 CHANNELS + MULTI-CHANNEL INVENTORY ==========
ALTER TABLE sales_channels
  ADD COLUMN IF NOT EXISTS channel_type VARCHAR(40) NOT NULL DEFAULT 'API'
    CHECK (channel_type IN (
      'POS', 'MOBILE_POS', 'WEB', 'MOBILE_APP', 'B2B_PORTAL', 'B2C',
      'MARKETPLACE', 'WHOLESALE', 'INTERNAL', 'CALL_CENTER', 'API'
    )),
  ADD COLUMN IF NOT EXISTS tax_rule_code VARCHAR(50),
  ADD COLUMN IF NOT EXISTS payment_methods JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS delivery_methods JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS inventory_policy JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS allocation_policy JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS fulfillment_policy JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS customer_segment VARCHAR(50),
  ADD COLUMN IF NOT EXISTS reserved_stock_pct NUMERIC(8, 4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dedicated_stock_qty NUMERIC(18, 4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pricing_priority INT NOT NULL DEFAULT 100;

CREATE TABLE IF NOT EXISTS channel_inventory_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  channel_id UUID NOT NULL REFERENCES sales_channels(id) ON DELETE CASCADE,
  warehouse_id UUID NOT NULL REFERENCES org_warehouses(id) ON DELETE CASCADE,
  sku_id UUID NOT NULL REFERENCES product_skus(id) ON DELETE CASCADE,
  dedicated_qty NUMERIC(18, 4) NOT NULL DEFAULT 0,
  reserved_qty NUMERIC(18, 4) NOT NULL DEFAULT 0,
  priority INT NOT NULL DEFAULT 100,
  UNIQUE (channel_id, warehouse_id, sku_id)
);

-- ========== 20-21 PRICE LISTS ENRICHMENT ==========
ALTER TABLE price_lists
  ADD COLUMN IF NOT EXISTS list_type VARCHAR(40) NOT NULL DEFAULT 'BASE'
    CHECK (list_type IN (
      'BASE', 'CUSTOMER', 'CUSTOMER_GROUP', 'WHOLESALE', 'RETAIL', 'CHANNEL',
      'CONTRACT', 'VOLUME', 'TIER', 'PROMOTIONAL', 'TEMPORARY', 'LOCATION', 'CURRENCY'
    )),
  ADD COLUMN IF NOT EXISTS location_code VARCHAR(50),
  ADD COLUMN IF NOT EXISTS customer_id UUID,
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS published_by VARCHAR(100);

CREATE TABLE IF NOT EXISTS price_list_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  price_list_id UUID NOT NULL REFERENCES price_lists(id) ON DELETE CASCADE,
  version INT NOT NULL,
  snapshot JSONB NOT NULL,
  changed_by VARCHAR(100),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (price_list_id, version)
);

ALTER TABLE price_list_items
  ADD COLUMN IF NOT EXISTS max_qty NUMERIC(18, 4),
  ADD COLUMN IF NOT EXISTS tier_label VARCHAR(50);

-- ========== 22-23 PROMOTIONS ==========
ALTER TABLE promotions
  DROP CONSTRAINT IF EXISTS promotions_promo_type_check;

ALTER TABLE promotions
  ADD COLUMN IF NOT EXISTS buy_qty NUMERIC(18, 4),
  ADD COLUMN IF NOT EXISTS get_qty NUMERIC(18, 4),
  ADD COLUMN IF NOT EXISTS get_discount_percent NUMERIC(8, 4),
  ADD COLUMN IF NOT EXISTS threshold_amount NUMERIC(18, 4),
  ADD COLUMN IF NOT EXISTS channel_id UUID REFERENCES sales_channels(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS customer_group_id UUID REFERENCES customer_groups(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS customer_id UUID,
  ADD COLUMN IF NOT EXISTS product_category VARCHAR(100),
  ADD COLUMN IF NOT EXISTS sku_id UUID REFERENCES product_skus(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS stacking_group VARCHAR(50),
  ADD COLUMN IF NOT EXISTS exclusive BOOLEAN NOT NULL DEFAULT false;

DO $$
BEGIN
  ALTER TABLE promotions ADD CONSTRAINT promotions_promo_type_check
    CHECK (promo_type IN (
      'PERCENTAGE', 'FIXED', 'BUY_X_GET_Y', 'BUY_X_GET_X', 'BUNDLE_DISCOUNT',
      'VOLUME', 'THRESHOLD', 'CUSTOMER', 'CHANNEL', 'CATEGORY', 'PRODUCT',
      'TIME_BASED', 'LOYALTY'
    ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS promotion_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  promotion_id UUID NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
  sales_order_id UUID,
  cart_id UUID,
  discount_amount NUMERIC(18, 4) NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- ========== 24 DISCOUNT AUTHORIZATION ==========
CREATE TABLE IF NOT EXISTS discount_authorization_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  role_name VARCHAR(100) NOT NULL,
  max_discount_percent NUMERIC(8, 4) NOT NULL,
  max_discount_amount NUMERIC(18, 4),
  requires_approval_above BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, role_name)
);

INSERT INTO discount_authorization_limits (organization_id, role_name, max_discount_percent)
SELECT DISTINCT organization_id, v.role_name, v.max_pct
FROM org_warehouses
CROSS JOIN (
  VALUES
    ('sales-agent', 5),
    ('manager', 15),
    ('director', 30),
    ('tenant-owner', 100),
    ('tenant-administrator', 100)
) AS v(role_name, max_pct)
ON CONFLICT (organization_id, role_name) DO NOTHING;

CREATE TABLE IF NOT EXISTS discount_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  sales_order_id UUID,
  sales_order_line_id UUID,
  requested_percent NUMERIC(8, 4) NOT NULL,
  max_allowed_percent NUMERIC(8, 4) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  requested_by VARCHAR(100),
  decided_by VARCHAR(100),
  decided_at TIMESTAMPTZ,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ========== 25 TAX ENGINE ==========
CREATE TABLE IF NOT EXISTS commercial_tax_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  profile_type VARCHAR(30) NOT NULL DEFAULT 'CUSTOMER'
    CHECK (profile_type IN ('CUSTOMER', 'PRODUCT', 'LOCATION')),
  is_exempt BOOLEAN NOT NULL DEFAULT false,
  exemption_reason VARCHAR(255),
  default_rate NUMERIC(8, 6),
  jurisdiction_code VARCHAR(50),
  valid_from TIMESTAMPTZ,
  valid_to TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, code, profile_type)
);

CREATE TABLE IF NOT EXISTS commercial_tax_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  rate NUMERIC(8, 6) NOT NULL,
  tax_category VARCHAR(50),
  jurisdiction_code VARCHAR(50),
  compound BOOLEAN NOT NULL DEFAULT false,
  valid_from TIMESTAMPTZ,
  valid_to TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, code)
);

-- ========== 28 FULFILLMENT PLANS ==========
CREATE TABLE IF NOT EXISTS fulfillment_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  sales_order_id UUID NOT NULL,
  fulfillment_type VARCHAR(40) NOT NULL DEFAULT 'SINGLE'
    CHECK (fulfillment_type IN (
      'SINGLE', 'PARTIAL', 'MULTI_WAREHOUSE', 'SPLIT_SHIPMENT',
      'DROP_SHIPMENT', 'STORE_PICKUP', 'HOME_DELIVERY', 'INTERNAL_TRANSFER'
    )),
  status VARCHAR(30) NOT NULL DEFAULT 'PLANNED'
    CHECK (status IN ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fulfillment_plan_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES fulfillment_plans(id) ON DELETE CASCADE,
  sales_order_line_id UUID NOT NULL,
  warehouse_id UUID NOT NULL,
  sku_id UUID NOT NULL,
  quantity NUMERIC(18, 4) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'PLANNED'
);

-- ========== 29 PICKING STRATEGIES ==========
ALTER TABLE pick_tickets
  ADD COLUMN IF NOT EXISTS pick_strategy VARCHAR(40) NOT NULL DEFAULT 'SINGLE_ORDER'
    CHECK (pick_strategy IN (
      'SINGLE_ORDER', 'BATCH', 'WAVE', 'ZONE', 'CLUSTER', 'FEFO', 'PRIORITY'
    )),
  ADD COLUMN IF NOT EXISTS wave_id UUID,
  ADD COLUMN IF NOT EXISTS zone_code VARCHAR(50),
  ADD COLUMN IF NOT EXISTS batch_id UUID,
  ADD COLUMN IF NOT EXISTS priority INT NOT NULL DEFAULT 100;

CREATE TABLE IF NOT EXISTS pick_waves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  wave_number VARCHAR(50) NOT NULL,
  warehouse_id UUID NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN', 'RELEASED', 'COMPLETED', 'CANCELLED')),
  strategy VARCHAR(40) NOT NULL DEFAULT 'WAVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, wave_number)
);

-- ========== 30 PACKING ==========
CREATE TABLE IF NOT EXISTS packing_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  shipment_id UUID REFERENCES shipments(id) ON DELETE CASCADE,
  sales_order_id UUID,
  package_number VARCHAR(50) NOT NULL,
  weight NUMERIC(18, 4),
  weight_uom VARCHAR(10) NOT NULL DEFAULT 'KG',
  length NUMERIC(18, 4),
  width NUMERIC(18, 4),
  height NUMERIC(18, 4),
  dimension_uom VARCHAR(10) NOT NULL DEFAULT 'CM',
  packaging_type VARCHAR(50),
  label_ref VARCHAR(100),
  tracking_number VARCHAR(100),
  document_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  status VARCHAR(30) NOT NULL DEFAULT 'PACKED'
    CHECK (status IN ('OPEN', 'PACKED', 'LABELED', 'SHIPPED', 'CANCELLED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, package_number)
);

CREATE TABLE IF NOT EXISTS packing_package_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID NOT NULL REFERENCES packing_packages(id) ON DELETE CASCADE,
  sales_order_line_id UUID,
  sku_id UUID NOT NULL,
  lot_id UUID,
  quantity NUMERIC(18, 4) NOT NULL
);

INSERT INTO tenant_number_sequences (document_type, prefix, pad_length, reset_policy)
VALUES
  ('WAVE', 'WAVE-', 6, 'YEAR'),
  ('PKG', 'PKG-', 6, 'YEAR'),
  ('CH', 'CH-', 4, 'NEVER')
ON CONFLICT DO NOTHING;

INSERT INTO schema_migrations (version) VALUES ('018_commercial_reqs_15_30') ON CONFLICT DO NOTHING;
