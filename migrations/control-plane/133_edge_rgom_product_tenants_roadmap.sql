-- Migration 133: RGOM Product Tenants roadmap (ADR-021 families)
-- Status: INTERNAL_ONLY + metadata.rgomRoadmapStatus=PLANNED — NOT AVAILABLE until G11 PASS.
-- No invented prices. No public acquisition seed.

-- Verticals for Product Tenants
INSERT INTO edge_verticals (code, slug, display_name, status)
SELECT v.code, v.slug, v.name, 'ACTIVE'
FROM (VALUES
  ('RETAIL', 'retail', 'Retail'),
  ('HOSPITALITY', 'hospitality', 'Hospitality'),
  ('MANUFACTURING', 'manufacturing', 'Manufacturing'),
  ('EQUIPMENT_RENTAL', 'equipment-rental', 'Equipment rental'),
  ('RESTAURANT', 'restaurant', 'Restaurant'),
  ('PHARMACY', 'pharmacy', 'Pharmacy')
) AS v(code, slug, name)
WHERE NOT EXISTS (SELECT 1 FROM edge_verticals x WHERE x.code = v.code);

-- OKAPI_RETAIL
INSERT INTO edge_products (
  code, slug, name, short_description, vertical_id,
  lifecycle_status, commercial_availability, product_type, metadata
)
SELECT
  'OKAPI_RETAIL',
  'okapi-retail',
  'Okapi Retail',
  'Product Tenant roadmap — supermarket / grocery / specialty retail (G11 pending)',
  v.id,
  'CONFIGURING',
  'INTERNAL_ONLY',
  'SAAS',
  '{
    "rgom": true,
    "rgomRoadmapStatus": "PLANNED",
    "productFamily": "OKAPI_RETAIL",
    "bbDefaultProfile": "SUPERMARKET",
    "bbProfiles": ["SUPERMARKET","GROCERY","FOOD_RETAIL","BOUTIQUE","ELECTRONICS_RETAIL","HARDWARE_BUILDING_SUPPLIES","AUTO_PARTS","OPTICAL_RETAIL","JEWELRY_RETAIL","TEXTILE_FABRIC_RETAIL"],
    "g11Required": true,
    "note": "Not AVAILABLE until G11 PASS (doc 39 Phase C)"
  }'::jsonb
FROM edge_verticals v
WHERE v.code = 'RETAIL'
  AND NOT EXISTS (SELECT 1 FROM edge_products p WHERE upper(p.code) = 'OKAPI_RETAIL');

-- OKAPI_HOSPITALITY
INSERT INTO edge_products (
  code, slug, name, short_description, vertical_id,
  lifecycle_status, commercial_availability, product_type, metadata
)
SELECT
  'OKAPI_HOSPITALITY',
  'okapi-hospitality',
  'Okapi Hospitality',
  'Product Tenant roadmap — hotel / PMS (G11 pending)',
  v.id,
  'CONFIGURING',
  'INTERNAL_ONLY',
  'SAAS',
  '{
    "rgom": true,
    "rgomRoadmapStatus": "PLANNED",
    "productFamily": "OKAPI_HOSPITALITY",
    "bbDefaultProfile": "HOTEL_HOSPITALITY",
    "bbProfiles": ["HOTEL_HOSPITALITY"],
    "g11Required": true,
    "note": "Not AVAILABLE until G11 PASS (doc 39 Phase D)"
  }'::jsonb
FROM edge_verticals v
WHERE v.code = 'HOSPITALITY'
  AND NOT EXISTS (SELECT 1 FROM edge_products p WHERE upper(p.code) = 'OKAPI_HOSPITALITY');

-- OKAPI_MANUFACTURING
INSERT INTO edge_products (
  code, slug, name, short_description, vertical_id,
  lifecycle_status, commercial_availability, product_type, metadata
)
SELECT
  'OKAPI_MANUFACTURING',
  'okapi-manufacturing',
  'Okapi Manufacturing',
  'Product Tenant roadmap — BOM / MRP / production (G11 pending)',
  v.id,
  'CONFIGURING',
  'INTERNAL_ONLY',
  'SAAS',
  '{
    "rgom": true,
    "rgomRoadmapStatus": "PLANNED",
    "productFamily": "OKAPI_OTHER",
    "bbDefaultProfile": "MANUFACTURING",
    "bbProfiles": ["MANUFACTURING"],
    "g11Required": true
  }'::jsonb
FROM edge_verticals v
WHERE v.code = 'MANUFACTURING'
  AND NOT EXISTS (SELECT 1 FROM edge_products p WHERE upper(p.code) = 'OKAPI_MANUFACTURING');

-- OKAPI_EQUIPMENT_RENTAL
INSERT INTO edge_products (
  code, slug, name, short_description, vertical_id,
  lifecycle_status, commercial_availability, product_type, metadata
)
SELECT
  'OKAPI_EQUIPMENT_RENTAL',
  'okapi-equipment-rental',
  'Okapi Equipment Rental',
  'Product Tenant roadmap — rental contracts / inspections (G11 pending)',
  v.id,
  'CONFIGURING',
  'INTERNAL_ONLY',
  'SAAS',
  '{
    "rgom": true,
    "rgomRoadmapStatus": "PLANNED",
    "productFamily": "OKAPI_OTHER",
    "bbDefaultProfile": "EQUIPMENT_RENTAL",
    "bbProfiles": ["EQUIPMENT_RENTAL"],
    "g11Required": true
  }'::jsonb
FROM edge_verticals v
WHERE v.code = 'EQUIPMENT_RENTAL'
  AND NOT EXISTS (SELECT 1 FROM edge_products p WHERE upper(p.code) = 'OKAPI_EQUIPMENT_RENTAL');

-- Annotate beachhead products with family + default BB profile (idempotent merge)
UPDATE edge_products
SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
  'productFamily', 'SYNTIX_PHARMA',
  'bbDefaultProfile', 'PHARMACY',
  'rgomRoadmapStatus', 'BEACHHEAD_AVAILABLE'
)
WHERE code = 'SYNTIX_PHARMA';

UPDATE edge_products
SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
  'productFamily', 'OKAPI_RESTAURANT',
  'bbDefaultProfile', 'RESTAURANT',
  'bbProfiles', '["RESTAURANT","CAFE"]'::jsonb,
  'rgomRoadmapStatus', 'BEACHHEAD_AVAILABLE'
)
WHERE code = 'OKAPI_RESTAURANT';
