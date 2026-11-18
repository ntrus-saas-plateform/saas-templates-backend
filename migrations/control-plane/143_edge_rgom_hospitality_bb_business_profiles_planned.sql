-- Migration 143: Hospitality vertical taxonomy — Edge rows for each BB OKAPI_HOSPITALITY profile (doc 39 W1)
-- status PLANNED + metadata INTERNAL_ONLY — mirrors BB FAMILY_BY_PROFILE hospitality family (ADR-055).
-- Does not set commercial_availability AVAILABLE on products.

INSERT INTO edge_market_segments (code, name, vertical_id, status, metadata)
SELECT s.code, s.name, v.id, 'PLANNED',
  jsonb_build_object(
    'rgom', true,
    'productFamily', 'OKAPI_HOSPITALITY',
    'commercialAvailability', 'INTERNAL_ONLY',
    'rgomRoadmapStatus', 'PLANNED',
    'docRef', '39-master-plan'
  )
FROM edge_verticals v
CROSS JOIN (VALUES
  ('HOSP_INDEPENDENT_HOTEL', 'Independent hotel'),
  ('HOSP_BOUTIQUE',          'Boutique hotel'),
  ('HOSP_CHAIN',             'Hotel chain / multi-property')
) AS s(code, name)
WHERE v.code = 'HOSPITALITY'
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
    'productFamily', 'OKAPI_HOSPITALITY',
    'commercialAvailability', 'INTERNAL_ONLY',
    'rgomRoadmapStatus', 'PLANNED',
    'edgeProductCode', 'OKAPI_HOSPITALITY',
    'docRef', '39-master-plan-w1'
  )
FROM edge_verticals v
JOIN (VALUES
  ('HOTEL_HOSPITALITY', 'Hotel hospitality (PMS)',     'HOSP_INDEPENDENT_HOTEL'),
  ('HOTEL',             'Hotel',                       'HOSP_INDEPENDENT_HOTEL'),
  ('HOSPITALITY',       'Hospitality',                 'HOSP_BOUTIQUE')
) AS p(bb_code, display_name, segment_code) ON TRUE
JOIN edge_market_segments seg ON seg.code = p.segment_code
WHERE v.code = 'HOSPITALITY'
  AND NOT EXISTS (
    SELECT 1 FROM edge_business_profile_templates t WHERE t.code = p.bb_code
  );