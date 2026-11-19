-- Migration 144: Edge quotas max_customers / max_products (RGOM W4)
-- Align SQL seeds with TypeScript catalogs so bb_control projections publish
-- entitlements.quotas.max_customers / max_products (BB fail-closed if missing).
-- No AVAILABLE / PUBLISH / price changes.

INSERT INTO edge_technical_capabilities (
  code, name, category, technical_status, commercial_availability, metadata
)
SELECT c.code, c.name, 'QUOTA', c.tech, c.avail,
  jsonb_build_object('rgom', true, 'entitlementKind', 'QUOTA')
FROM (VALUES
  ('max_customers', 'Max customers', 'AVAILABLE', 'AVAILABLE'),
  ('max_products', 'Max products', 'AVAILABLE', 'AVAILABLE')
) AS c(code, name, tech, avail)
WHERE NOT EXISTS (SELECT 1 FROM edge_technical_capabilities t WHERE t.code = c.code);

-- Product ↔ capability mappings (beachhead + roadmap families)
INSERT INTO edge_product_capability_mappings (
  product_id, capability_id, classification, technical_status, commercial_availability
)
SELECT p.id, c.id, 'SUPPORTED',
  CASE WHEN p.code IN ('OKAPI_RETAIL', 'OKAPI_HOSPITALITY') THEN 'AVAILABLE' ELSE 'AVAILABLE' END,
  CASE WHEN p.code IN ('OKAPI_RETAIL', 'OKAPI_HOSPITALITY') THEN 'INTERNAL_ONLY' ELSE 'AVAILABLE' END
FROM edge_products p
CROSS JOIN edge_technical_capabilities c
WHERE p.code IN ('SYNTIX_PHARMA', 'OKAPI_RESTAURANT', 'OKAPI_RETAIL', 'OKAPI_HOSPITALITY')
  AND c.code IN ('max_customers', 'max_products')
  AND NOT EXISTS (
    SELECT 1 FROM edge_product_capability_mappings m
    WHERE m.product_id = p.id AND m.capability_id = c.id AND m.product_version_id IS NULL
  );

-- Syntix Pharma plan quotas
INSERT INTO edge_commercial_plan_capabilities (plan_id, capability_id, inclusion_type, restrictions)
SELECT pl.id, cap.id, 'INCLUDED', jsonb_build_object('numericLimit', lim.limit_val)
FROM edge_commercial_plans pl
JOIN (VALUES
  ('SYNTIX_LITE', 'max_customers', 500),
  ('SYNTIX_LITE', 'max_products', 2000),
  ('SYNTIX_PROFESSIONAL', 'max_customers', 5000),
  ('SYNTIX_PROFESSIONAL', 'max_products', 10000),
  ('SYNTIX_BUSINESS', 'max_customers', 25000),
  ('SYNTIX_BUSINESS', 'max_products', 50000),
  ('SYNTIX_ENTERPRISE', 'max_customers', 100000),
  ('SYNTIX_ENTERPRISE', 'max_products', 200000)
) AS lim(plan_code, code, limit_val) ON lim.plan_code = pl.code
JOIN edge_technical_capabilities cap ON cap.code = lim.code
WHERE NOT EXISTS (
  SELECT 1 FROM edge_commercial_plan_capabilities x
  WHERE x.plan_id = pl.id AND x.capability_id = cap.id
);

-- Okapi Restaurant plan quotas (+ cafe controlled pack quotas via package plans if any)
INSERT INTO edge_commercial_plan_capabilities (plan_id, capability_id, inclusion_type, restrictions)
SELECT pl.id, cap.id, 'INCLUDED', jsonb_build_object('numericLimit', lim.limit_val)
FROM edge_commercial_plans pl
JOIN (VALUES
  ('OKAPI_REST_STARTER', 'max_customers', 2000),
  ('OKAPI_REST_STARTER', 'max_products', 500),
  ('OKAPI_REST_GROWTH', 'max_customers', 10000),
  ('OKAPI_REST_GROWTH', 'max_products', 2000),
  ('OKAPI_REST_MULTI', 'max_customers', 50000),
  ('OKAPI_REST_MULTI', 'max_products', 5000),
  ('OKAPI_REST_ENTERPRISE', 'max_customers', 200000),
  ('OKAPI_REST_ENTERPRISE', 'max_products', 20000)
) AS lim(plan_code, code, limit_val) ON lim.plan_code = pl.code
JOIN edge_technical_capabilities cap ON cap.code = lim.code
WHERE NOT EXISTS (
  SELECT 1 FROM edge_commercial_plan_capabilities x
  WHERE x.plan_id = pl.id AND x.capability_id = cap.id
);

-- Okapi Retail plan quotas (INTERNAL_ONLY commercial)
INSERT INTO edge_commercial_plan_capabilities (plan_id, capability_id, inclusion_type, restrictions)
SELECT pl.id, cap.id, 'INCLUDED', jsonb_build_object('numericLimit', lim.limit_val)
FROM edge_commercial_plans pl
JOIN (VALUES
  ('OKAPI_RETAIL_LITE', 'max_customers', 2000),
  ('OKAPI_RETAIL_LITE', 'max_products', 5000),
  ('OKAPI_RETAIL_PROFESSIONAL', 'max_customers', 15000),
  ('OKAPI_RETAIL_PROFESSIONAL', 'max_products', 25000),
  ('OKAPI_RETAIL_BUSINESS', 'max_customers', 75000),
  ('OKAPI_RETAIL_BUSINESS', 'max_products', 100000),
  ('OKAPI_RETAIL_ENTERPRISE', 'max_customers', 500000),
  ('OKAPI_RETAIL_ENTERPRISE', 'max_products', 500000)
) AS lim(plan_code, code, limit_val) ON lim.plan_code = pl.code
JOIN edge_technical_capabilities cap ON cap.code = lim.code
WHERE NOT EXISTS (
  SELECT 1 FROM edge_commercial_plan_capabilities x
  WHERE x.plan_id = pl.id AND x.capability_id = cap.id
);

-- Okapi Hospitality plan quotas (INTERNAL_ONLY commercial)
INSERT INTO edge_commercial_plan_capabilities (plan_id, capability_id, inclusion_type, restrictions)
SELECT pl.id, cap.id, 'INCLUDED', jsonb_build_object('numericLimit', lim.limit_val)
FROM edge_commercial_plans pl
JOIN (VALUES
  ('OKAPI_HOSP_LITE', 'max_customers', 3000),
  ('OKAPI_HOSP_LITE', 'max_products', 500),
  ('OKAPI_HOSP_PROFESSIONAL', 'max_customers', 15000),
  ('OKAPI_HOSP_PROFESSIONAL', 'max_products', 2000),
  ('OKAPI_HOSP_BUSINESS', 'max_customers', 75000),
  ('OKAPI_HOSP_BUSINESS', 'max_products', 5000),
  ('OKAPI_HOSP_ENTERPRISE', 'max_customers', 250000),
  ('OKAPI_HOSP_ENTERPRISE', 'max_products', 20000)
) AS lim(plan_code, code, limit_val) ON lim.plan_code = pl.code
JOIN edge_technical_capabilities cap ON cap.code = lim.code
WHERE NOT EXISTS (
  SELECT 1 FROM edge_commercial_plan_capabilities x
  WHERE x.plan_id = pl.id AND x.capability_id = cap.id
);
