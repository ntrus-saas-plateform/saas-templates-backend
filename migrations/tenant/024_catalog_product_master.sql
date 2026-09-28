-- Migration 024: Catalog product master, types, UOMs, packaging hierarchy (reqs 5–8)

-- ========== PRODUCT TYPE CODES (extensible) ==========
CREATE TABLE IF NOT EXISTS product_type_codes (
  code VARCHAR(40) PRIMARY KEY,
  label VARCHAR(120) NOT NULL,
  is_system BOOLEAN NOT NULL DEFAULT true,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO product_type_codes (code, label, is_system) VALUES
  ('MEDICATION', 'Medication', true),
  ('MEDICAL_DEVICE', 'Medical device', true),
  ('CONSUMABLE', 'Consumable', true),
  ('SUPPLEMENT', 'Supplement', true),
  ('COSMETIC', 'Cosmetic', true),
  ('VACCINE', 'Vaccine', true),
  ('DIAGNOSTIC', 'Diagnostic', true),
  ('EQUIPMENT', 'Equipment', true),
  ('OTHER', 'Other', true)
ON CONFLICT (code) DO NOTHING;

-- ========== UOM CODES ==========
CREATE TABLE IF NOT EXISTS uom_codes (
  code VARCHAR(20) PRIMARY KEY,
  label VARCHAR(80) NOT NULL,
  dimension VARCHAR(20) NOT NULL DEFAULT 'COUNT'
    CHECK (dimension IN ('COUNT', 'MASS', 'VOLUME', 'LENGTH', 'OTHER')),
  is_system BOOLEAN NOT NULL DEFAULT true,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO uom_codes (code, label, dimension, is_system) VALUES
  ('UNIT', 'Unit', 'COUNT', true),
  ('EA', 'Each', 'COUNT', true),
  ('BOX', 'Box', 'COUNT', true),
  ('CARTON', 'Carton', 'COUNT', true),
  ('PACK', 'Pack', 'COUNT', true),
  ('BLISTER', 'Blister', 'COUNT', true),
  ('TABLET', 'Tablet', 'COUNT', true),
  ('CAPSULE', 'Capsule', 'COUNT', true),
  ('BOTTLE', 'Bottle', 'COUNT', true),
  ('VIAL', 'Vial', 'COUNT', true),
  ('AMPOULE', 'Ampoule', 'COUNT', true),
  ('KG', 'Kilogram', 'MASS', true),
  ('G', 'Gram', 'MASS', true),
  ('L', 'Litre', 'VOLUME', true),
  ('ML', 'Millilitre', 'VOLUME', true)
ON CONFLICT (code) DO NOTHING;

-- ========== PRODUCTS — master attributes ==========
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS product_type VARCHAR(40) NOT NULL DEFAULT 'OTHER',
  ADD COLUMN IF NOT EXISTS internal_code VARCHAR(80),
  ADD COLUMN IF NOT EXISTS generic_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS brand_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS category VARCHAR(120),
  ADD COLUMN IF NOT EXISTS subcategory VARCHAR(120),
  ADD COLUMN IF NOT EXISTS manufacturer VARCHAR(255),
  ADD COLUMN IF NOT EXISTS dosage VARCHAR(80),
  ADD COLUMN IF NOT EXISTS strength VARCHAR(80),
  ADD COLUMN IF NOT EXISTS pharmaceutical_form VARCHAR(80),
  ADD COLUMN IF NOT EXISTS administration_route VARCHAR(80),
  ADD COLUMN IF NOT EXISTS active_ingredients JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS therapeutic_class VARCHAR(120),
  ADD COLUMN IF NOT EXISTS atc_code VARCHAR(40),
  ADD COLUMN IF NOT EXISTS hazardous BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS temperature_sensitive BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS expiration_tracked BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS supplier_references JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS regulatory_info JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS handling_requirements JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS document_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS image_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS attachment_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS custom_fields JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Backfill temperature_sensitive from cold_chain when column existed
UPDATE products
SET temperature_sensitive = true
WHERE cold_chain_required = true AND temperature_sensitive = false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_products_product_type'
  ) THEN
    ALTER TABLE products
      ADD CONSTRAINT fk_products_product_type
      FOREIGN KEY (product_type) REFERENCES product_type_codes(code);
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_products_type ON products (organization_id, product_type);
CREATE INDEX IF NOT EXISTS idx_products_atc ON products (atc_code) WHERE atc_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_internal_code ON products (organization_id, internal_code)
  WHERE internal_code IS NOT NULL;

-- ========== SKUS — role UOMs + GTIN ==========
ALTER TABLE product_skus
  ADD COLUMN IF NOT EXISTS gtin VARCHAR(14),
  ADD COLUMN IF NOT EXISTS purchase_uom VARCHAR(20),
  ADD COLUMN IF NOT EXISTS stock_uom VARCHAR(20),
  ADD COLUMN IF NOT EXISTS sale_uom VARCHAR(20),
  ADD COLUMN IF NOT EXISTS distribution_uom VARCHAR(20);

UPDATE product_skus
SET stock_uom = COALESCE(stock_uom, uom),
    sale_uom = COALESCE(sale_uom, uom),
    purchase_uom = COALESCE(purchase_uom, uom),
    distribution_uom = COALESCE(distribution_uom, uom)
WHERE stock_uom IS NULL OR sale_uom IS NULL;

-- ========== PRODUCT UOMS — activate + roles ==========
ALTER TABLE product_uoms
  ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'PACK'
    CHECK (role IN ('BASE', 'PURCHASE', 'STOCK', 'SALE', 'DISTRIBUTION', 'PACK')),
  ADD COLUMN IF NOT EXISTS label VARCHAR(80),
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Ensure every SKU has a BASE uom row from sku.uom
INSERT INTO product_uoms (sku_id, uom, factor_to_base, is_base, role, label)
SELECT s.id, COALESCE(s.uom, 'EA'), 1, true, 'BASE', COALESCE(s.uom, 'EA')
FROM product_skus s
WHERE NOT EXISTS (
  SELECT 1 FROM product_uoms u WHERE u.sku_id = s.id AND u.is_base = true
)
ON CONFLICT (sku_id, uom) DO UPDATE SET is_base = true, role = 'BASE';

-- ========== PACKAGING HIERARCHY ==========
CREATE TABLE IF NOT EXISTS product_packaging_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku_id UUID NOT NULL REFERENCES product_skus(id) ON DELETE CASCADE,
  level_code VARCHAR(40) NOT NULL,
  parent_id UUID REFERENCES product_packaging_levels(id) ON DELETE CASCADE,
  qty_in_parent NUMERIC(18, 6),
  barcode VARCHAR(64),
  gtin VARCHAR(14),
  weight NUMERIC(18, 6),
  weight_uom VARCHAR(10) NOT NULL DEFAULT 'KG',
  volume NUMERIC(18, 6),
  volume_uom VARCHAR(10) NOT NULL DEFAULT 'L',
  length NUMERIC(18, 6),
  width NUMERIC(18, 6),
  height NUMERIC(18, 6),
  dimension_uom VARCHAR(10) NOT NULL DEFAULT 'CM',
  uom VARCHAR(20),
  is_purchase_unit BOOLEAN NOT NULL DEFAULT false,
  is_stock_unit BOOLEAN NOT NULL DEFAULT false,
  is_sale_unit BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (sku_id, level_code)
);

CREATE INDEX IF NOT EXISTS idx_packaging_sku ON product_packaging_levels (sku_id);
CREATE INDEX IF NOT EXISTS idx_packaging_barcode ON product_packaging_levels (barcode)
  WHERE barcode IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_packaging_gtin ON product_packaging_levels (gtin)
  WHERE gtin IS NOT NULL;

INSERT INTO schema_migrations (version) VALUES ('024_catalog_product_master') ON CONFLICT DO NOTHING;
