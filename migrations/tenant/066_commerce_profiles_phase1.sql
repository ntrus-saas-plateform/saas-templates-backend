-- Phase 1 commerce profiles foundation (backend).
-- GENERAL_COMMERCE + enrich RETAIL_STORE + STATIONERY_BOOKSTORE + COSMETICS_RETAIL.
-- Book/cosmetic/stationery via vertical extensions — no second Sales/POS/Inventory engines.

-- —— Capabilities ——
INSERT INTO capability_definitions (code, name, description, category, status, required_modules, supported_verticals)
VALUES
  (
    'GENERAL_COMMERCE',
    'General commerce',
    'Parent commerce capability composing Core Sales/POS/Catalog/Pricing/Inventory/Procurement',
    'COMMERCE',
    'AVAILABLE',
    '["sales","pos","catalog","pricing","inventory","purchasing"]'::jsonb,
    '["GENERAL_COMMERCE","RETAIL_STORE","STATIONERY_BOOKSTORE","COSMETICS_RETAIL","BOUTIQUE","SUPERMARKET","GROCERY","WHOLESALE"]'::jsonb
  ),
  (
    'STORE_MANAGEMENT',
    'Store management',
    'Multi-store / branch operations marker (uses Core warehouse + location — not a second store engine)',
    'COMMERCE',
    'AVAILABLE',
    '["inventory","pos"]'::jsonb,
    '["RETAIL_STORE","STATIONERY_BOOKSTORE","COSMETICS_RETAIL","SUPERMARKET","GROCERY","BOUTIQUE"]'::jsonb
  ),
  (
    'MULTI_REGISTER',
    'Multi-register',
    'Multiple POS registers / cash sessions per location (Core cash-session engine)',
    'COMMERCE',
    'AVAILABLE',
    '["pos"]'::jsonb,
    '["RETAIL_STORE","STATIONERY_BOOKSTORE","COSMETICS_RETAIL","SUPERMARKET","GENERAL_COMMERCE"]'::jsonb
  ),
  (
    'BOOKSTORE',
    'Bookstore',
    'Bookstore vertical parent — book metadata via product extensions',
    'COMMERCE',
    'AVAILABLE',
    '["catalog"]'::jsonb,
    '["STATIONERY_BOOKSTORE"]'::jsonb
  ),
  (
    'BOOK_CATALOG',
    'Book catalog',
    'Book catalog operations (search by ISBN/author/publisher)',
    'COMMERCE',
    'AVAILABLE',
    '["catalog"]'::jsonb,
    '["STATIONERY_BOOKSTORE"]'::jsonb
  ),
  (
    'ISBN',
    'ISBN',
    'ISBN-10/13 validation and org-scoped uniqueness index',
    'COMMERCE',
    'AVAILABLE',
    '["catalog"]'::jsonb,
    '["STATIONERY_BOOKSTORE"]'::jsonb
  ),
  (
    'STATIONERY',
    'Stationery attributes',
    'Stationery product attributes via satellite extension',
    'COMMERCE',
    'AVAILABLE',
    '["catalog"]'::jsonb,
    '["STATIONERY_BOOKSTORE"]'::jsonb
  ),
  (
    'COSMETICS_RETAIL',
    'Cosmetics retail',
    'Cosmetics retail vertical parent',
    'COMMERCE',
    'AVAILABLE',
    '["catalog","inventory","pos"]'::jsonb,
    '["COSMETICS_RETAIL"]'::jsonb
  ),
  (
    'COSMETIC_PRODUCT',
    'Cosmetic product attributes',
    'Shade/color/fragrance/size via product extension — lot/FEFO remain Core Inventory caps',
    'COMMERCE',
    'AVAILABLE',
    '["catalog"]'::jsonb,
    '["COSMETICS_RETAIL"]'::jsonb
  )
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  status = EXCLUDED.status,
  required_modules = EXCLUDED.required_modules,
  supported_verticals = EXCLUDED.supported_verticals,
  updated_at = NOW();

INSERT INTO capability_dependencies (capability_code, depends_on_code) VALUES
  ('GENERAL_COMMERCE', 'SALES'),
  ('GENERAL_COMMERCE', 'POS'),
  ('STORE_MANAGEMENT', 'GENERAL_COMMERCE'),
  ('MULTI_REGISTER', 'POS'),
  ('BOOKSTORE', 'GENERAL_COMMERCE'),
  ('BOOK_CATALOG', 'BOOKSTORE'),
  ('ISBN', 'BOOKSTORE'),
  ('STATIONERY', 'GENERAL_COMMERCE'),
  ('COSMETICS_RETAIL', 'GENERAL_COMMERCE'),
  ('COSMETIC_PRODUCT', 'COSMETICS_RETAIL')
ON CONFLICT DO NOTHING;

-- —— ISBN uniqueness index (org-scoped) ——
CREATE TABLE IF NOT EXISTS product_isbn_index (
  organization_id UUID NOT NULL,
  isbn VARCHAR(20) NOT NULL,
  product_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (organization_id, isbn)
);

CREATE INDEX IF NOT EXISTS idx_product_isbn_product
  ON product_isbn_index (organization_id, product_id);

INSERT INTO product_type_codes (code, label, is_system) VALUES
  ('BOOK', 'Book', true),
  ('STATIONERY', 'Stationery', true)
ON CONFLICT (code) DO NOTHING;

-- —— Vertical extension contracts ——
INSERT INTO vertical_extension_definitions
  (vertical_code, extension_key, label, description, json_schema, required_capabilities, status, schema_version)
VALUES
  (
    'BOOKSTORE', 'book.metadata', 'Book metadata',
    'ISBN, authors, publisher, edition — kept off products core table',
    '{
      "type":"object",
      "properties":{
        "isbn13":{"type":"string"},
        "isbn10":{"type":"string"},
        "subtitle":{"type":"string"},
        "authors":{"type":"array","items":{"type":"string"}},
        "publisher":{"type":"string"},
        "publicationDate":{"type":"string"},
        "edition":{"type":"string"},
        "language":{"type":"string"},
        "genre":{"type":"string"},
        "format":{"type":"string"},
        "series":{"type":"string"},
        "volume":{"type":"string"},
        "binding":{"type":"string"},
        "pageCount":{"type":"number"},
        "ageRange":{"type":"string"}
      }
    }'::jsonb,
    '["BOOKSTORE","ISBN"]'::jsonb, 'AVAILABLE', 1
  ),
  (
    'STATIONERY', 'stationery.attributes', 'Stationery attributes',
    'Color/size/paper attributes for stationery SKUs',
    '{
      "type":"object",
      "properties":{
        "brand":{"type":"string"},
        "color":{"type":"string"},
        "size":{"type":"string"},
        "format":{"type":"string"},
        "paperWeight":{"type":"string"},
        "pages":{"type":"number"},
        "binding":{"type":"string"},
        "material":{"type":"string"},
        "packQuantity":{"type":"number"}
      }
    }'::jsonb,
    '["STATIONERY"]'::jsonb, 'AVAILABLE', 1
  ),
  (
    'COSMETICS_RETAIL', 'cosmetic.attributes', 'Cosmetic attributes',
    'Shade/color/fragrance/size for cosmetics — batch/expiry via Core Inventory',
    '{
      "type":"object",
      "properties":{
        "brand":{"type":"string"},
        "productType":{"type":"string"},
        "shade":{"type":"string"},
        "color":{"type":"string"},
        "finish":{"type":"string"},
        "fragrance":{"type":"string"},
        "size":{"type":"string"},
        "volume":{"type":"string"},
        "weight":{"type":"string"},
        "skinType":{"type":"string"},
        "hairType":{"type":"string"},
        "genderTarget":{"type":"string"},
        "ageRange":{"type":"string"},
        "countryOfOrigin":{"type":"string"},
        "manufacturer":{"type":"string"}
      }
    }'::jsonb,
    '["COSMETICS_RETAIL","COSMETIC_PRODUCT"]'::jsonb, 'AVAILABLE', 1
  )
ON CONFLICT (vertical_code, extension_key) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  json_schema = EXCLUDED.json_schema,
  required_capabilities = EXCLUDED.required_capabilities,
  status = EXCLUDED.status,
  schema_version = EXCLUDED.schema_version,
  updated_at = NOW();


INSERT INTO schema_migrations (version) VALUES ('066_commerce_profiles_phase1')
ON CONFLICT DO NOTHING;

