-- Migration 137: Retail + Hospitality commercial plan STUBS (doc 39 Phase C/D start)
-- INTERNAL_ONLY / DRAFT — NOT AVAILABLE. No invented prices. G11 required before PUBLISHED.

-- Caps commonly used (idempotent)
INSERT INTO edge_technical_capabilities (
  code, name, category, technical_status, commercial_availability, metadata
)
SELECT c.code, c.name, c.category, 'AVAILABLE', 'INTERNAL_ONLY',
  '{"rgom":true,"roadmapStub":true}'::jsonb
FROM (VALUES
  ('retail', 'Retail operations', 'RETAIL'),
  ('grocery', 'Grocery', 'RETAIL'),
  ('hospitality', 'Hospitality / PMS', 'HOSPITALITY'),
  ('front_desk', 'Front desk', 'HOSPITALITY'),
  ('housekeeping', 'Housekeeping', 'HOSPITALITY')
) AS c(code, name, category)
WHERE NOT EXISTS (SELECT 1 FROM edge_technical_capabilities x WHERE x.code = c.code);

-- OKAPI_RETAIL package + Lite stub
INSERT INTO edge_solution_packages (
  code, name, product_id, vertical_id, package_type, status, metadata
)
SELECT
  'PKG_RETAIL_SUPERMARKET',
  'Supermarket Package (roadmap stub)',
  p.id, v.id, 'SOLUTION', 'DRAFT',
  '{"rgom":true,"bbProfileCode":"SUPERMARKET","commercialAvailability":"INTERNAL_ONLY","g11Required":true}'::jsonb
FROM edge_products p
JOIN edge_verticals v ON v.id = p.vertical_id
WHERE p.code = 'OKAPI_RETAIL'
  AND NOT EXISTS (SELECT 1 FROM edge_solution_packages s WHERE s.code = 'PKG_RETAIL_SUPERMARKET');

INSERT INTO edge_commercial_plans (
  code, name, product_id, vertical_id, plan_tier, solution_package_id, status, metadata
)
SELECT
  'OKAPI_RETAIL_LITE',
  'Okapi Retail Lite (roadmap stub)',
  p.id, v.id, 'LITE', pkg.id, 'DRAFT',
  jsonb_build_object(
    'rgom', true,
    'rgomRoadmapStatus', 'PLANNED',
    'bbProfileCode', 'SUPERMARKET',
    'commercialAvailability', 'INTERNAL_ONLY',
    'note', 'Not sellable until G11 PASS (doc 39 Phase C)'
  )
FROM edge_products p
JOIN edge_verticals v ON v.id = p.vertical_id
JOIN edge_solution_packages pkg ON pkg.code = 'PKG_RETAIL_SUPERMARKET'
WHERE p.code = 'OKAPI_RETAIL'
  AND NOT EXISTS (SELECT 1 FROM edge_commercial_plans x WHERE x.code = 'OKAPI_RETAIL_LITE');

-- OKAPI_HOSPITALITY package + Lite stub
INSERT INTO edge_solution_packages (
  code, name, product_id, vertical_id, package_type, status, metadata
)
SELECT
  'PKG_HOSP_HOTEL',
  'Hotel Hospitality Package (roadmap stub)',
  p.id, v.id, 'SOLUTION', 'DRAFT',
  '{"rgom":true,"bbProfileCode":"HOTEL_HOSPITALITY","commercialAvailability":"INTERNAL_ONLY","g11Required":true}'::jsonb
FROM edge_products p
JOIN edge_verticals v ON v.id = p.vertical_id
WHERE p.code = 'OKAPI_HOSPITALITY'
  AND NOT EXISTS (SELECT 1 FROM edge_solution_packages s WHERE s.code = 'PKG_HOSP_HOTEL');

INSERT INTO edge_commercial_plans (
  code, name, product_id, vertical_id, plan_tier, solution_package_id, status, metadata
)
SELECT
  'OKAPI_HOSP_LITE',
  'Okapi Hospitality Lite (roadmap stub)',
  p.id, v.id, 'LITE', pkg.id, 'DRAFT',
  jsonb_build_object(
    'rgom', true,
    'rgomRoadmapStatus', 'PLANNED',
    'bbProfileCode', 'HOTEL_HOSPITALITY',
    'commercialAvailability', 'INTERNAL_ONLY',
    'note', 'Not sellable until G11 PASS (doc 39 Phase D)'
  )
FROM edge_products p
JOIN edge_verticals v ON v.id = p.vertical_id
JOIN edge_solution_packages pkg ON pkg.code = 'PKG_HOSP_HOTEL'
WHERE p.code = 'OKAPI_HOSPITALITY'
  AND NOT EXISTS (SELECT 1 FROM edge_commercial_plans x WHERE x.code = 'OKAPI_HOSP_LITE');
