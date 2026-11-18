-- Migration 140: RGOM E5 sales discovery questionnaire codes per product family (doc 39 W2)
-- Status DRAFT only — not ACTIVE (sales ops enablement after Legal/G11 gates).
-- Products may be AVAILABLE or INTERNAL_ONLY; questionnaires stay internal draft templates.
-- Aligns with sales-engine-beachhead.ts DISCOVERY_TEMPLATES field keys.

INSERT INTO edge_sales_discovery_questionnaires (
  code, name, vertical_id, product_id, status, questions, metadata
)
SELECT
  'DISC_SYNTIX_PHARMA',
  'Syntix Pharma — discovery',
  p.vertical_id,
  p.id,
  'DRAFT',
  '[
    {"key":"profile","label":"Pharmacy profile (independent / chain / wholesale)"},
    {"key":"sites","label":"Sites and establishments count"},
    {"key":"users","label":"Licensed users and roles"},
    {"key":"warehouses","label":"Warehouses / storage locations"},
    {"key":"pain","label":"Primary operational pain"},
    {"key":"fit","label":"Solution fit hypothesis"}
  ]'::jsonb,
  '{"rgom":true,"productFamily":"SYNTIX_PHARMA","visibility":"INTERNAL","docRef":"27-e5-sales-engine-beachhead"}'::jsonb
FROM edge_products p
WHERE p.code = 'SYNTIX_PHARMA'
  AND NOT EXISTS (
    SELECT 1 FROM edge_sales_discovery_questionnaires x WHERE x.code = 'DISC_SYNTIX_PHARMA'
  );

INSERT INTO edge_sales_discovery_questionnaires (
  code, name, vertical_id, product_id, status, questions, metadata
)
SELECT
  'DISC_OKAPI_RESTAURANT',
  'Okapi Restaurant — discovery',
  p.vertical_id,
  p.id,
  'DRAFT',
  '[
    {"key":"profile","label":"Restaurant profile (independent / multi-site / QSR)"},
    {"key":"sites","label":"Sites and service modes"},
    {"key":"covers","label":"Daily covers / throughput"},
    {"key":"posTerminals","label":"POS terminals and channels"},
    {"key":"pain","label":"Primary operational pain"},
    {"key":"fit","label":"Solution fit hypothesis"}
  ]'::jsonb,
  '{"rgom":true,"productFamily":"OKAPI_RESTAURANT","visibility":"INTERNAL","docRef":"27-e5-sales-engine-beachhead"}'::jsonb
FROM edge_products p
WHERE p.code = 'OKAPI_RESTAURANT'
  AND NOT EXISTS (
    SELECT 1 FROM edge_sales_discovery_questionnaires x WHERE x.code = 'DISC_OKAPI_RESTAURANT'
  );

INSERT INTO edge_sales_discovery_questionnaires (
  code, name, vertical_id, product_id, status, questions, metadata
)
SELECT
  'DISC_OKAPI_RETAIL',
  'Okapi Retail — discovery',
  p.vertical_id,
  p.id,
  'DRAFT',
  '[
    {"key":"profile","label":"Retail profile (supermarket / grocery / specialty)"},
    {"key":"sites","label":"Stores and regions"},
    {"key":"users","label":"Store staff and back-office users"},
    {"key":"skus","label":"SKU scale and replenishment model"},
    {"key":"pain","label":"Primary operational pain"},
    {"key":"fit","label":"Solution fit hypothesis"}
  ]'::jsonb,
  '{"rgom":true,"productFamily":"OKAPI_RETAIL","visibility":"INTERNAL","rgomRoadmapStatus":"PLANNED","docRef":"39-master-plan"}'::jsonb
FROM edge_products p
WHERE p.code = 'OKAPI_RETAIL'
  AND NOT EXISTS (
    SELECT 1 FROM edge_sales_discovery_questionnaires x WHERE x.code = 'DISC_OKAPI_RETAIL'
  );

INSERT INTO edge_sales_discovery_questionnaires (
  code, name, vertical_id, product_id, status, questions, metadata
)
SELECT
  'DISC_OKAPI_HOSPITALITY',
  'Okapi Hospitality — discovery',
  p.vertical_id,
  p.id,
  'DRAFT',
  '[
    {"key":"profile","label":"Property profile (hotel / resort / apart-hotel)"},
    {"key":"sites","label":"Properties and room inventory"},
    {"key":"rooms","label":"Room count and segmentation"},
    {"key":"posTerminals","label":"F&B outlets and POS touchpoints"},
    {"key":"pain","label":"Primary operational pain"},
    {"key":"fit","label":"Solution fit hypothesis"}
  ]'::jsonb,
  '{"rgom":true,"productFamily":"OKAPI_HOSPITALITY","visibility":"INTERNAL","rgomRoadmapStatus":"PLANNED","docRef":"39-master-plan"}'::jsonb
FROM edge_products p
WHERE p.code = 'OKAPI_HOSPITALITY'
  AND NOT EXISTS (
    SELECT 1 FROM edge_sales_discovery_questionnaires x WHERE x.code = 'DISC_OKAPI_HOSPITALITY'
  );

INSERT INTO schema_migrations (version) VALUES ('140_edge_rgom_sales_discovery_codes_draft')
ON CONFLICT DO NOTHING;