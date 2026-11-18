-- Migration 139: Promote beachhead P10 presentations DRAFT → REVIEW (not PUBLISHED)
-- Legal wet-ink + price MEASURED still required before PUBLISHED / paid traffic.

UPDATE edge_p10_product_presentations
SET status = 'REVIEW',
    updated_at = NOW(),
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'legalGate', 'DPA_WET_INK_REQUIRED',
      'priceGate', 'MEASURED_REQUIRED',
      'publishBlockedUntil', 'Legal+Marketing+PriceResearch',
      'docRefs', jsonb_build_array('30-dpa-beachhead', '39-master-plan', '28-e6-acquisition')
    )
WHERE code IN ('PRES_SYNTIX_PHARMA_BEACHHEAD', 'PRES_OKAPI_RESTAURANT_BEACHHEAD')
  AND status = 'DRAFT';

UPDATE edge_p10_plan_presentations
SET status = 'REVIEW',
    updated_at = NOW(),
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'legalGate', 'DPA_WET_INK_REQUIRED',
      'priceDisplayModeLocked', 'QUOTE_REQUIRED'
    )
WHERE code IN ('PLANPRES_SYNTIX_LITE', 'PLANPRES_OKAPI_REST_STARTER')
  AND status = 'DRAFT';

UPDATE edge_p10_segment_presentations
SET status = 'REVIEW',
    updated_at = NOW(),
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'legalGate', 'DPA_WET_INK_REQUIRED'
    )
WHERE code IN ('SEG_PHARMACY_INDEPENDENT', 'SEG_RESTAURANT_INDEPENDENT')
  AND status = 'DRAFT';

-- Retail / Hospitality DRAFT presentations (roadmap — still not REVIEW for public)
INSERT INTO edge_p10_product_presentations (
  product_id, code, slug, title, summary, status, locale, metadata, created_by
)
SELECT
  p.id,
  'PRES_OKAPI_RETAIL_ROADMAP',
  'okapi-retail',
  'Okapi Retail',
  'Retail Product Tenant roadmap — INTERNAL_ONLY (G11 PARTIAL)',
  'DRAFT',
  'en',
  '{"rgom":true,"g11":"PARTIAL","commercialAvailability":"INTERNAL_ONLY"}'::jsonb,
  'rgom-seed'
FROM edge_products p
WHERE p.code = 'OKAPI_RETAIL'
  AND NOT EXISTS (
    SELECT 1 FROM edge_p10_product_presentations x WHERE x.code = 'PRES_OKAPI_RETAIL_ROADMAP'
  );

INSERT INTO edge_p10_product_presentations (
  product_id, code, slug, title, summary, status, locale, metadata, created_by
)
SELECT
  p.id,
  'PRES_OKAPI_HOSPITALITY_ROADMAP',
  'okapi-hospitality',
  'Okapi Hospitality',
  'Hospitality Product Tenant roadmap — INTERNAL_ONLY (G11 PARTIAL)',
  'DRAFT',
  'en',
  '{"rgom":true,"g11":"PARTIAL","commercialAvailability":"INTERNAL_ONLY"}'::jsonb,
  'rgom-seed'
FROM edge_products p
WHERE p.code = 'OKAPI_HOSPITALITY'
  AND NOT EXISTS (
    SELECT 1 FROM edge_p10_product_presentations x WHERE x.code = 'PRES_OKAPI_HOSPITALITY_ROADMAP'
  );
