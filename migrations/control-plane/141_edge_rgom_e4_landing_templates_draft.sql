-- Migration 141: E4 demand-gen landing templates (doc 26-e4-demand-generation-beachhead)
-- Status DRAFT only — never PUBLISHED (Legal wet-ink + G11 / price MEASURED required).
-- Product Tenants: beachhead SYNTIX_PHARMA + OKAPI_RESTAURANT + PLANNED OKAPI_RETAIL + OKAPI_HOSPITALITY.

-- ---------------------------------------------------------------------------
-- E4 product IA page shells (8 routes per Product Tenant)
-- ---------------------------------------------------------------------------
INSERT INTO edge_marketing_landing_pages (
  code, name, page_type, slug, product_id, locale, status,
  layout, seo, cta, metadata, created_by
)
SELECT
  'LP_' || replace(p.code, '-', '_') || '_' || t.route_key,
  p.name || ' — ' || t.page_name,
  t.page_type,
  p.slug || '/product/' || t.slug_suffix,
  p.id,
  'en',
  'DRAFT',
  jsonb_build_object(
    'e4Template', true,
    'e4Route', '/product/' || t.slug_suffix,
    'sections', '[]'::jsonb
  ),
  jsonb_build_object(
    'noindex', true,
    'titleTemplate', p.name || ' — ' || t.page_name
  ),
  jsonb_build_object('primary', t.cta_primary, 'secondary', t.cta_secondary),
  jsonb_build_object(
    'rgom', true,
    'docRef', '26-e4-demand-generation-beachhead',
    'e4Template', true,
    'publishGate', 'Legal+G11+PriceMeasured',
    'commercialAvailability',
      CASE
        WHEN p.commercial_availability = 'AVAILABLE' THEN 'AVAILABLE'
        ELSE 'INTERNAL_ONLY'
      END
  ),
  'rgom-seed'
FROM edge_products p
CROSS JOIN (VALUES
  ('OVERVIEW',     'Product overview',  'PRODUCT',            'overview',     'Book demo',  'Talk to expert'),
  ('SOLUTIONS',    'Solutions',         'PRODUCT',            'solutions',    'Configure',  NULL),
  ('SEGMENTS',     'Segments',          'SEGMENT',            'segments',     'Explore segment', NULL),
  ('CAPABILITIES', 'Capabilities',      'PRODUCT',            'capabilities', 'View capabilities', NULL),
  ('PRICING',      'Pricing',           'PRODUCT',            'pricing',      'Start trial', 'Request quote'),
  ('SECURITY',     'Security & trust',  'PRODUCT',            'security',     'Trust center', NULL),
  ('RESOURCES',    'Resources',         'RESOURCE_DOWNLOAD',  'resources',    'Browse content', NULL),
  ('DEMO',         'Demo',              'DEMO',               'demo',         'Book demo', NULL)
) AS t(route_key, page_name, page_type, slug_suffix, cta_primary, cta_secondary)
WHERE p.code IN ('SYNTIX_PHARMA', 'OKAPI_RESTAURANT', 'OKAPI_RETAIL', 'OKAPI_HOSPITALITY')
  AND NOT EXISTS (
    SELECT 1 FROM edge_marketing_landing_pages x
    WHERE x.code = 'LP_' || replace(p.code, '-', '_') || '_' || t.route_key
  );

-- ---------------------------------------------------------------------------
-- Beachhead Syntix — E4 segment landings (doc 26 § Landings Syntix)
-- ---------------------------------------------------------------------------
INSERT INTO edge_marketing_landing_pages (
  code, name, page_type, slug, product_id, locale, status,
  layout, seo, cta, metadata, created_by
)
SELECT
  v.lp_code,
  v.lp_name,
  'SEGMENT',
  p.slug || '/segments/' || v.slug_suffix,
  p.id,
  'en',
  'DRAFT',
  jsonb_build_object('e4Template', true, 'segmentCode', v.segment_code, 'sections', '[]'::jsonb),
  jsonb_build_object('noindex', true),
  v.cta,
  jsonb_build_object(
    'rgom', true,
    'beachhead', 'syntix-pharma',
    'docRef', '26-e4-demand-generation-beachhead',
    'edgeMarketSegment', v.segment_code,
    'publishGate', 'Legal+G11'
  ),
  'rgom-seed'
FROM edge_products p
CROSS JOIN (VALUES
  (
    'LP_SYNTIX_PHARMA_INDEPENDENT_PHARMACY',
    'Independent pharmacy',
    'independent-pharmacy',
    'PHARMA_RETAIL_INDEPENDENT',
    '{"primary":"Start trial","secondary":"Book demo","icp":"smb"}'::jsonb
  ),
  (
    'LP_SYNTIX_PHARMA_PHARMACY_CHAIN',
    'Pharmacy chain',
    'pharmacy-chain',
    'PHARMA_CHAIN',
    '{"primary":"Book demo","secondary":"Talk to expert","icp":"mid-market"}'::jsonb
  ),
  (
    'LP_SYNTIX_PHARMA_WHOLESALE',
    'Pharmaceutical wholesale',
    'wholesale',
    'PHARMA_WHOLESALE',
    '{"primary":"Talk to expert","secondary":"Configure","configureHint":"3 WH / 45 users"}'::jsonb
  ),
  (
    'LP_SYNTIX_PHARMA_DISTRIBUTION',
    'Pharmaceutical distribution',
    'distribution',
    'PHARMA_DISTRIBUTION',
    '{"primary":"Request enterprise quote","secondary":"Book demo","icp":"enterprise"}'::jsonb
  )
) AS v(lp_code, lp_name, slug_suffix, segment_code, cta)
WHERE p.code = 'SYNTIX_PHARMA'
  AND NOT EXISTS (SELECT 1 FROM edge_marketing_landing_pages x WHERE x.code = v.lp_code);

-- ---------------------------------------------------------------------------
-- Beachhead Okapi Restaurant — segment landings (E4-style, draft)
-- ---------------------------------------------------------------------------
INSERT INTO edge_marketing_landing_pages (
  code, name, page_type, slug, product_id, locale, status,
  layout, seo, cta, metadata, created_by
)
SELECT
  v.lp_code,
  v.lp_name,
  'SEGMENT',
  p.slug || '/segments/' || v.slug_suffix,
  p.id,
  'en',
  'DRAFT',
  jsonb_build_object('e4Template', true, 'segmentCode', v.segment_code, 'sections', '[]'::jsonb),
  jsonb_build_object('noindex', true),
  v.cta,
  jsonb_build_object(
    'rgom', true,
    'beachhead', 'okapi-restaurant',
    'docRef', '26-e4-demand-generation-beachhead',
    'edgeMarketSegment', v.segment_code,
    'publishGate', 'Legal+G11'
  ),
  'rgom-seed'
FROM edge_products p
CROSS JOIN (VALUES
  (
    'LP_OKAPI_RESTAURANT_INDEPENDENT',
    'Independent restaurant',
    'independent-restaurant',
    'REST_INDEPENDENT',
    '{"primary":"Start trial","secondary":"Book demo"}'::jsonb
  ),
  (
    'LP_OKAPI_RESTAURANT_MULTI_SITE',
    'Multi-site restaurant group',
    'multi-site',
    'REST_MULTI_SITE',
    '{"primary":"Book demo","secondary":"Configure"}'::jsonb
  ),
  (
    'LP_OKAPI_RESTAURANT_QSR',
    'Quick service restaurant',
    'qsr',
    'REST_QSR',
    '{"primary":"Configure","secondary":"Book demo"}'::jsonb
  )
) AS v(lp_code, lp_name, slug_suffix, segment_code, cta)
WHERE p.code = 'OKAPI_RESTAURANT'
  AND NOT EXISTS (SELECT 1 FROM edge_marketing_landing_pages x WHERE x.code = v.lp_code);

-- ---------------------------------------------------------------------------
-- Roadmap Retail / Hospitality — primary segment landings (DRAFT, INTERNAL)
-- ---------------------------------------------------------------------------
INSERT INTO edge_marketing_landing_pages (
  code, name, page_type, slug, product_id, locale, status,
  layout, seo, cta, metadata, created_by
)
SELECT
  v.lp_code,
  v.lp_name,
  'SEGMENT',
  p.slug || '/segments/' || v.slug_suffix,
  p.id,
  'en',
  'DRAFT',
  jsonb_build_object('e4Template', true, 'segmentCode', v.segment_code, 'sections', '[]'::jsonb),
  jsonb_build_object('noindex', true),
  v.cta,
  jsonb_build_object(
    'rgom', true,
    'rgomRoadmapStatus', 'PLANNED',
    'docRef', '26-e4-demand-generation-beachhead',
    'edgeMarketSegment', v.segment_code,
    'commercialAvailability', 'INTERNAL_ONLY',
    'publishGate', 'G11+Legal'
  ),
  'rgom-seed'
FROM edge_products p
JOIN (VALUES
  (
    'OKAPI_RETAIL',
    'LP_OKAPI_RETAIL_SUPERMARKET',
    'Supermarket / hypermarket',
    'supermarket',
    'RETAIL_SUPERMARKET',
    '{"primary":"Request quote","secondary":"Configure","note":"INTERNAL_ONLY until G11"}'::jsonb
  ),
  (
    'OKAPI_HOSPITALITY',
    'LP_OKAPI_HOSPITALITY_INDEPENDENT_HOTEL',
    'Independent hotel',
    'independent-hotel',
    'HOSP_INDEPENDENT_HOTEL',
    '{"primary":"Request quote","secondary":"Book demo","note":"INTERNAL_ONLY until G11"}'::jsonb
  )
) AS v(product_code, lp_code, lp_name, slug_suffix, segment_code, cta)
  ON v.product_code = p.code
WHERE NOT EXISTS (SELECT 1 FROM edge_marketing_landing_pages x WHERE x.code = v.lp_code);