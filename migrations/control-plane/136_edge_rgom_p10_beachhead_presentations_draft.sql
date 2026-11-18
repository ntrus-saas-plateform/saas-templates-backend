-- Migration 136: P10 product/plan presentations DRAFT for beachhead (doc 39 Phase B)
-- Status DRAFT only — never PUBLISHED here (Legal/Marketing wet-ink + price MEASURED required).
-- No invented monetary amounts. price_display_mode = QUOTE_REQUIRED | INDICATIVE.

INSERT INTO edge_p10_product_presentations (
  product_id, code, slug, title, summary, status, locale, metadata, created_by
)
SELECT
  p.id,
  'PRES_SYNTIX_PHARMA_BEACHHEAD',
  'syntix-pharma',
  'Syntix Pharma',
  'Pharmacy retail operations — beachhead Product Tenant (draft presentation)',
  'DRAFT',
  'en',
  '{"rgom":true,"roadmap":"beachhead","g11":"PASS_TECHNICAL","publishGate":"Legal+Marketing"}'::jsonb,
  'rgom-seed'
FROM edge_products p
WHERE p.code = 'SYNTIX_PHARMA'
  AND NOT EXISTS (
    SELECT 1 FROM edge_p10_product_presentations x WHERE x.code = 'PRES_SYNTIX_PHARMA_BEACHHEAD'
  );

INSERT INTO edge_p10_product_presentations (
  product_id, code, slug, title, summary, status, locale, metadata, created_by
)
SELECT
  p.id,
  'PRES_OKAPI_RESTAURANT_BEACHHEAD',
  'okapi-restaurant',
  'Okapi Restaurant',
  'Restaurant / cafe operations — beachhead Product Tenant (draft presentation)',
  'DRAFT',
  'en',
  '{"rgom":true,"roadmap":"beachhead","cafePack":"PKG_REST_CAFE_CONTROLLED","publishGate":"Legal+Marketing"}'::jsonb,
  'rgom-seed'
FROM edge_products p
WHERE p.code = 'OKAPI_RESTAURANT'
  AND NOT EXISTS (
    SELECT 1 FROM edge_p10_product_presentations x WHERE x.code = 'PRES_OKAPI_RESTAURANT_BEACHHEAD'
  );

-- Plan presentations (Lite / Starter) — QUOTE_REQUIRED, no amounts
INSERT INTO edge_p10_plan_presentations (
  commercial_plan_id, product_presentation_id, code, title, summary, status,
  price_display_mode, features_display, cta_label, metadata, created_by
)
SELECT
  pl.id,
  pp.id,
  'PLANPRES_SYNTIX_LITE',
  'Syntix Lite',
  'Entry pharmacy plan — display only; checkout requires published presentation',
  'DRAFT',
  'QUOTE_REQUIRED',
  '["identity","pharmacy","inventory","pos"]'::jsonb,
  'Request quote',
  '{"rgom":true,"planCode":"SYNTIX_LITE"}'::jsonb,
  'rgom-seed'
FROM edge_commercial_plans pl
JOIN edge_p10_product_presentations pp ON pp.code = 'PRES_SYNTIX_PHARMA_BEACHHEAD'
WHERE pl.code = 'SYNTIX_LITE'
  AND NOT EXISTS (SELECT 1 FROM edge_p10_plan_presentations x WHERE x.code = 'PLANPRES_SYNTIX_LITE');

INSERT INTO edge_p10_plan_presentations (
  commercial_plan_id, product_presentation_id, code, title, summary, status,
  price_display_mode, features_display, cta_label, metadata, created_by
)
SELECT
  pl.id,
  pp.id,
  'PLANPRES_OKAPI_REST_STARTER',
  'Restaurant Starter',
  'Entry restaurant plan — display only; checkout requires published presentation',
  'DRAFT',
  'QUOTE_REQUIRED',
  '["identity","restaurant","menu","pos","tables"]'::jsonb,
  'Request quote',
  '{"rgom":true,"planCode":"OKAPI_REST_STARTER"}'::jsonb,
  'rgom-seed'
FROM edge_commercial_plans pl
JOIN edge_p10_product_presentations pp ON pp.code = 'PRES_OKAPI_RESTAURANT_BEACHHEAD'
WHERE pl.code = 'OKAPI_REST_STARTER'
  AND NOT EXISTS (
    SELECT 1 FROM edge_p10_plan_presentations x WHERE x.code = 'PLANPRES_OKAPI_REST_STARTER'
  );

INSERT INTO edge_p10_segment_presentations (
  code, name, description, product_presentation_id, status, targeting_rules, metadata, created_by
)
SELECT
  'SEG_PHARMACY_INDEPENDENT',
  'Independent Pharmacy',
  'ICP beachhead Syntix — draft segment presentation',
  pp.id,
  'DRAFT',
  '{"vertical":"PHARMACY","icp":"independent"}'::jsonb,
  '{"rgom":true}'::jsonb,
  'rgom-seed'
FROM edge_p10_product_presentations pp
WHERE pp.code = 'PRES_SYNTIX_PHARMA_BEACHHEAD'
  AND NOT EXISTS (
    SELECT 1 FROM edge_p10_segment_presentations x WHERE x.code = 'SEG_PHARMACY_INDEPENDENT'
  );

INSERT INTO edge_p10_segment_presentations (
  code, name, description, product_presentation_id, status, targeting_rules, metadata, created_by
)
SELECT
  'SEG_RESTAURANT_INDEPENDENT',
  'Independent Restaurant',
  'ICP beachhead Okapi Restaurant — draft segment presentation',
  pp.id,
  'DRAFT',
  '{"vertical":"RESTAURANT","icp":"independent"}'::jsonb,
  '{"rgom":true}'::jsonb,
  'rgom-seed'
FROM edge_p10_product_presentations pp
WHERE pp.code = 'PRES_OKAPI_RESTAURANT_BEACHHEAD'
  AND NOT EXISTS (
    SELECT 1 FROM edge_p10_segment_presentations x WHERE x.code = 'SEG_RESTAURANT_INDEPENDENT'
  );
