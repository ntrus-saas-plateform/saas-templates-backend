-- Migration 135: CAFE Controlled pack under OKAPI_RESTAURANT (doc 39 Phase B)
-- Same Product Tenant — NOT a separate AVAILABLE product. No invented prices.

INSERT INTO edge_solution_packages (
  code, name, product_id, vertical_id, package_type, status, metadata
)
SELECT
  'PKG_REST_CAFE_CONTROLLED',
  'Cafe Controlled Pack (under Okapi Restaurant)',
  p.id,
  v.id,
  'SOLUTION',
  'DRAFT',
  '{
    "rgom": true,
    "bbProfileCode": "CAFE",
    "commercialAvailability": "CONTROLLED_ROLLOUT",
    "parentProduct": "OKAPI_RESTAURANT",
    "note": "G11 Controlled — same tenant family (doc 39 Phase B). Not public AVAILABLE."
  }'::jsonb
FROM edge_products p
JOIN edge_verticals v ON v.id = p.vertical_id
WHERE p.code = 'OKAPI_RESTAURANT'
  AND NOT EXISTS (
    SELECT 1 FROM edge_solution_packages s WHERE s.code = 'PKG_REST_CAFE_CONTROLLED'
  );

UPDATE edge_products
SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
  'bbProfiles', '["RESTAURANT","CAFE"]'::jsonb,
  'cafePack', 'PKG_REST_CAFE_CONTROLLED',
  'cafeCommercialAvailability', 'CONTROLLED_ROLLOUT'
)
WHERE code = 'OKAPI_RESTAURANT';
