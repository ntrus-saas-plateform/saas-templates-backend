-- Migration 142: Retail vertical taxonomy — Edge rows for each BB OKAPI_RETAIL profile (doc 39 W1)
-- status PLANNED + metadata INTERNAL_ONLY — mirrors BB FAMILY_BY_PROFILE retail family (ADR-055).
-- Does not set commercial_availability AVAILABLE on products.

INSERT INTO edge_market_segments (code, name, vertical_id, status, metadata)
SELECT s.code, s.name, v.id, 'PLANNED',
  jsonb_build_object(
    'rgom', true,
    'productFamily', 'OKAPI_RETAIL',
    'commercialAvailability', 'INTERNAL_ONLY',
    'rgomRoadmapStatus', 'PLANNED',
    'docRef', '39-master-plan'
  )
FROM edge_verticals v
CROSS JOIN (VALUES
  ('RETAIL_SUPERMARKET', 'Supermarket / hypermarket'),
  ('RETAIL_GROCERY', 'Grocery / convenience'),
  ('RETAIL_SPECIALTY', 'Specialty retail (non-grocery)')
) AS s(code, name)
WHERE v.code = 'RETAIL'
  AND NOT EXISTS (SELECT 1 FROM edge_market_segments m WHERE m.code = s.code);

INSERT INTO edge_business_profile_templates (code, name, vertical_id, segment_id, status, metadata)
SELECT
  p.bb_code,
  p.display_name,
  v.id,
  seg.id,
  'PLANNED',
  jsonb_build_object(
    'rgom', true,
    'bbProfileCode', p.bb_code,
    'productFamily', 'OKAPI_RETAIL',
    'commercialAvailability', 'INTERNAL_ONLY',
    'rgomRoadmapStatus', 'PLANNED',
    'edgeProductCode', 'OKAPI_RETAIL',
    'docRef', '39-master-plan-w1'
  )
FROM edge_verticals v
JOIN (VALUES
  ('SUPERMARKET',                'Supermarket',                    'RETAIL_SUPERMARKET'),
  ('GROCERY',                    'Grocery',                        'RETAIL_GROCERY'),
  ('BOUTIQUE',                   'Boutique',                       'RETAIL_SPECIALTY'),
  ('FOOD_RETAIL',                'Food retail',                    'RETAIL_SPECIALTY'),
  ('ELECTRONICS_RETAIL',         'Electronics retail',             'RETAIL_SPECIALTY'),
  ('HARDWARE_BUILDING_SUPPLIES', 'Hardware & building supplies',   'RETAIL_SPECIALTY'),
  ('AUTO_PARTS',                 'Automotive parts',               'RETAIL_SPECIALTY'),
  ('OPTICAL_RETAIL',             'Optical retail / optician',      'RETAIL_SPECIALTY'),
  ('JEWELRY_RETAIL',             'Jewelry retail',                 'RETAIL_SPECIALTY'),
  ('TEXTILE_FABRIC_RETAIL',      'Textile / fabric retail',        'RETAIL_SPECIALTY')
) AS p(bb_code, display_name, segment_code) ON TRUE
JOIN edge_market_segments seg ON seg.code = p.segment_code
WHERE v.code = 'RETAIL'
  AND NOT EXISTS (
    SELECT 1 FROM edge_business_profile_templates t WHERE t.code = p.bb_code
  );