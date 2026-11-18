-- Migration 138: Retail + Hospitality full plan ladders (doc 39 C/D)
-- status DRAFT, commercialAvailability INTERNAL_ONLY — NOT AVAILABLE / NOT PUBLISHED for sale.
-- No invented unit prices (price books NEEDS_RESEARCH).

INSERT INTO edge_technical_capabilities (
  code, name, category, technical_status, commercial_availability, metadata
)
SELECT c.code, c.name, c.category, 'AVAILABLE', 'INTERNAL_ONLY',
  '{"rgom":true,"roadmap":"retail-hospitality"}'::jsonb
FROM (VALUES
  ('purchasing', 'Purchasing', 'PROCUREMENT'),
  ('retail', 'Retail operations', 'RETAIL'),
  ('grocery', 'Grocery', 'RETAIL'),
  ('hospitality', 'Hospitality / PMS', 'HOSPITALITY'),
  ('front_desk', 'Front desk', 'HOSPITALITY'),
  ('housekeeping', 'Housekeeping', 'HOSPITALITY')
) AS c(code, name, category)
WHERE NOT EXISTS (SELECT 1 FROM edge_technical_capabilities x WHERE x.code = c.code);

-- Retail packages
INSERT INTO edge_solution_packages (
  code, name, product_id, vertical_id, package_type, status, metadata
)
SELECT pkg.code, pkg.name, p.id, v.id, 'SOLUTION', 'DRAFT',
  jsonb_build_object('rgom', true, 'bbProfileCode', 'SUPERMARKET', 'commercialAvailability', 'INTERNAL_ONLY')
FROM edge_products p
JOIN edge_verticals v ON v.id = p.vertical_id
CROSS JOIN (VALUES
  ('PKG_RETAIL_SUPERMARKET', 'Supermarket Package'),
  ('PKG_RETAIL_GROCERY', 'Grocery Package'),
  ('PKG_RETAIL_CHAIN', 'Retail Chain Package')
) AS pkg(code, name)
WHERE p.code = 'OKAPI_RETAIL'
  AND NOT EXISTS (SELECT 1 FROM edge_solution_packages s WHERE s.code = pkg.code);

-- Hospitality packages
INSERT INTO edge_solution_packages (
  code, name, product_id, vertical_id, package_type, status, metadata
)
SELECT pkg.code, pkg.name, p.id, v.id, 'SOLUTION', 'DRAFT',
  jsonb_build_object('rgom', true, 'bbProfileCode', 'HOTEL_HOSPITALITY', 'commercialAvailability', 'INTERNAL_ONLY')
FROM edge_products p
JOIN edge_verticals v ON v.id = p.vertical_id
CROSS JOIN (VALUES
  ('PKG_HOSP_HOTEL', 'Hotel Hospitality Package'),
  ('PKG_HOSP_CHAIN', 'Hospitality Chain Package')
) AS pkg(code, name)
WHERE p.code = 'OKAPI_HOSPITALITY'
  AND NOT EXISTS (SELECT 1 FROM edge_solution_packages s WHERE s.code = pkg.code);

-- Retail plans Lite→Enterprise
INSERT INTO edge_commercial_plans (
  code, name, product_id, vertical_id, plan_tier, solution_package_id, status, metadata
)
SELECT pl.code, pl.name, p.id, v.id, pl.tier, pkg.id, 'DRAFT',
  jsonb_build_object(
    'rgom', true,
    'rgomRoadmapStatus', 'PLANNED',
    'bbProfileCode', 'SUPERMARKET',
    'commercialAvailability', 'INTERNAL_ONLY',
    'g11', 'PARTIAL'
  )
FROM edge_products p
JOIN edge_verticals v ON v.id = p.vertical_id
JOIN (VALUES
  ('OKAPI_RETAIL_LITE', 'Okapi Retail Lite', 'LITE', 'PKG_RETAIL_SUPERMARKET'),
  ('OKAPI_RETAIL_PROFESSIONAL', 'Okapi Retail Professional', 'PROFESSIONAL', 'PKG_RETAIL_SUPERMARKET'),
  ('OKAPI_RETAIL_BUSINESS', 'Okapi Retail Business', 'BUSINESS', 'PKG_RETAIL_CHAIN'),
  ('OKAPI_RETAIL_ENTERPRISE', 'Okapi Retail Enterprise', 'ENTERPRISE', 'PKG_RETAIL_CHAIN')
) AS pl(code, name, tier, pkg_code) ON TRUE
JOIN edge_solution_packages pkg ON pkg.code = pl.pkg_code
WHERE p.code = 'OKAPI_RETAIL'
  AND NOT EXISTS (SELECT 1 FROM edge_commercial_plans x WHERE x.code = pl.code);

-- Hospitality plans
INSERT INTO edge_commercial_plans (
  code, name, product_id, vertical_id, plan_tier, solution_package_id, status, metadata
)
SELECT pl.code, pl.name, p.id, v.id, pl.tier, pkg.id, 'DRAFT',
  jsonb_build_object(
    'rgom', true,
    'rgomRoadmapStatus', 'PLANNED',
    'bbProfileCode', 'HOTEL_HOSPITALITY',
    'commercialAvailability', 'INTERNAL_ONLY',
    'g11', 'PARTIAL'
  )
FROM edge_products p
JOIN edge_verticals v ON v.id = p.vertical_id
JOIN (VALUES
  ('OKAPI_HOSP_LITE', 'Okapi Hospitality Lite', 'LITE', 'PKG_HOSP_HOTEL'),
  ('OKAPI_HOSP_PROFESSIONAL', 'Okapi Hospitality Professional', 'PROFESSIONAL', 'PKG_HOSP_HOTEL'),
  ('OKAPI_HOSP_BUSINESS', 'Okapi Hospitality Business', 'BUSINESS', 'PKG_HOSP_CHAIN'),
  ('OKAPI_HOSP_ENTERPRISE', 'Okapi Hospitality Enterprise', 'ENTERPRISE', 'PKG_HOSP_CHAIN')
) AS pl(code, name, tier, pkg_code) ON TRUE
JOIN edge_solution_packages pkg ON pkg.code = pl.pkg_code
WHERE p.code = 'OKAPI_HOSPITALITY'
  AND NOT EXISTS (SELECT 1 FROM edge_commercial_plans x WHERE x.code = pl.code);

-- Retail Lite caps
INSERT INTO edge_commercial_plan_capabilities (plan_id, capability_id, inclusion_type)
SELECT pl.id, cap.id, 'INCLUDED'
FROM edge_commercial_plans pl
CROSS JOIN edge_technical_capabilities cap
WHERE pl.code = 'OKAPI_RETAIL_LITE'
  AND cap.code IN ('identity','retail','inventory','pos')
  AND NOT EXISTS (
    SELECT 1 FROM edge_commercial_plan_capabilities x
    WHERE x.plan_id = pl.id AND x.capability_id = cap.id
  );

INSERT INTO edge_commercial_plan_capabilities (plan_id, capability_id, inclusion_type, restrictions)
SELECT pl.id, cap.id, 'INCLUDED', jsonb_build_object('numericLimit', lim.limit_val)
FROM edge_commercial_plans pl
JOIN (VALUES ('max_organizations', 1), ('max_users', 10), ('max_pos_terminals', 4)) AS lim(code, limit_val) ON TRUE
JOIN edge_technical_capabilities cap ON cap.code = lim.code
WHERE pl.code = 'OKAPI_RETAIL_LITE'
  AND NOT EXISTS (
    SELECT 1 FROM edge_commercial_plan_capabilities x
    WHERE x.plan_id = pl.id AND x.capability_id = cap.id
  );

-- Retail Professional
INSERT INTO edge_commercial_plan_capabilities (plan_id, capability_id, inclusion_type)
SELECT pl.id, cap.id, 'INCLUDED'
FROM edge_commercial_plans pl
CROSS JOIN edge_technical_capabilities cap
WHERE pl.code = 'OKAPI_RETAIL_PROFESSIONAL'
  AND cap.code IN ('identity','retail','grocery','inventory','pos','purchasing','reporting')
  AND NOT EXISTS (
    SELECT 1 FROM edge_commercial_plan_capabilities x
    WHERE x.plan_id = pl.id AND x.capability_id = cap.id
  );

INSERT INTO edge_commercial_plan_capabilities (plan_id, capability_id, inclusion_type, restrictions)
SELECT pl.id, cap.id, 'INCLUDED', jsonb_build_object('numericLimit', lim.limit_val)
FROM edge_commercial_plans pl
JOIN (VALUES ('max_organizations', 3), ('max_users', 40), ('max_pos_terminals', 12)) AS lim(code, limit_val) ON TRUE
JOIN edge_technical_capabilities cap ON cap.code = lim.code
WHERE pl.code = 'OKAPI_RETAIL_PROFESSIONAL'
  AND NOT EXISTS (
    SELECT 1 FROM edge_commercial_plan_capabilities x
    WHERE x.plan_id = pl.id AND x.capability_id = cap.id
  );

-- Retail Business
INSERT INTO edge_commercial_plan_capabilities (plan_id, capability_id, inclusion_type)
SELECT pl.id, cap.id, 'INCLUDED'
FROM edge_commercial_plans pl
CROSS JOIN edge_technical_capabilities cap
WHERE pl.code = 'OKAPI_RETAIL_BUSINESS'
  AND cap.code IN ('identity','retail','grocery','inventory','pos','purchasing','reporting','api')
  AND NOT EXISTS (
    SELECT 1 FROM edge_commercial_plan_capabilities x
    WHERE x.plan_id = pl.id AND x.capability_id = cap.id
  );

INSERT INTO edge_commercial_plan_capabilities (plan_id, capability_id, inclusion_type, restrictions)
SELECT pl.id, cap.id, 'INCLUDED', jsonb_build_object('numericLimit', lim.limit_val)
FROM edge_commercial_plans pl
JOIN (VALUES ('max_organizations', 15), ('max_users', 150), ('max_pos_terminals', 40)) AS lim(code, limit_val) ON TRUE
JOIN edge_technical_capabilities cap ON cap.code = lim.code
WHERE pl.code = 'OKAPI_RETAIL_BUSINESS'
  AND NOT EXISTS (
    SELECT 1 FROM edge_commercial_plan_capabilities x
    WHERE x.plan_id = pl.id AND x.capability_id = cap.id
  );

-- Retail Enterprise
INSERT INTO edge_commercial_plan_capabilities (plan_id, capability_id, inclusion_type)
SELECT pl.id, cap.id, 'INCLUDED'
FROM edge_commercial_plans pl
CROSS JOIN edge_technical_capabilities cap
WHERE pl.code = 'OKAPI_RETAIL_ENTERPRISE'
  AND cap.code IN ('identity','retail','grocery','inventory','pos','purchasing','reporting','api','analytics','sso')
  AND NOT EXISTS (
    SELECT 1 FROM edge_commercial_plan_capabilities x
    WHERE x.plan_id = pl.id AND x.capability_id = cap.id
  );

INSERT INTO edge_commercial_plan_capabilities (plan_id, capability_id, inclusion_type, restrictions)
SELECT pl.id, cap.id, 'INCLUDED', jsonb_build_object('numericLimit', lim.limit_val)
FROM edge_commercial_plans pl
JOIN (VALUES ('max_organizations', 100), ('max_users', 1000), ('max_pos_terminals', 200)) AS lim(code, limit_val) ON TRUE
JOIN edge_technical_capabilities cap ON cap.code = lim.code
WHERE pl.code = 'OKAPI_RETAIL_ENTERPRISE'
  AND NOT EXISTS (
    SELECT 1 FROM edge_commercial_plan_capabilities x
    WHERE x.plan_id = pl.id AND x.capability_id = cap.id
  );

-- Hospitality Lite
INSERT INTO edge_commercial_plan_capabilities (plan_id, capability_id, inclusion_type)
SELECT pl.id, cap.id, 'INCLUDED'
FROM edge_commercial_plans pl
CROSS JOIN edge_technical_capabilities cap
WHERE pl.code = 'OKAPI_HOSP_LITE'
  AND cap.code IN ('identity','hospitality','front_desk')
  AND NOT EXISTS (
    SELECT 1 FROM edge_commercial_plan_capabilities x
    WHERE x.plan_id = pl.id AND x.capability_id = cap.id
  );

INSERT INTO edge_commercial_plan_capabilities (plan_id, capability_id, inclusion_type, restrictions)
SELECT pl.id, cap.id, 'INCLUDED', jsonb_build_object('numericLimit', lim.limit_val)
FROM edge_commercial_plans pl
JOIN (VALUES ('max_organizations', 1), ('max_users', 15)) AS lim(code, limit_val) ON TRUE
JOIN edge_technical_capabilities cap ON cap.code = lim.code
WHERE pl.code = 'OKAPI_HOSP_LITE'
  AND NOT EXISTS (
    SELECT 1 FROM edge_commercial_plan_capabilities x
    WHERE x.plan_id = pl.id AND x.capability_id = cap.id
  );

-- Hospitality Professional
INSERT INTO edge_commercial_plan_capabilities (plan_id, capability_id, inclusion_type)
SELECT pl.id, cap.id, 'INCLUDED'
FROM edge_commercial_plans pl
CROSS JOIN edge_technical_capabilities cap
WHERE pl.code = 'OKAPI_HOSP_PROFESSIONAL'
  AND cap.code IN ('identity','hospitality','front_desk','housekeeping','reporting')
  AND NOT EXISTS (
    SELECT 1 FROM edge_commercial_plan_capabilities x
    WHERE x.plan_id = pl.id AND x.capability_id = cap.id
  );

INSERT INTO edge_commercial_plan_capabilities (plan_id, capability_id, inclusion_type, restrictions)
SELECT pl.id, cap.id, 'INCLUDED', jsonb_build_object('numericLimit', lim.limit_val)
FROM edge_commercial_plans pl
JOIN (VALUES ('max_organizations', 1), ('max_users', 40)) AS lim(code, limit_val) ON TRUE
JOIN edge_technical_capabilities cap ON cap.code = lim.code
WHERE pl.code = 'OKAPI_HOSP_PROFESSIONAL'
  AND NOT EXISTS (
    SELECT 1 FROM edge_commercial_plan_capabilities x
    WHERE x.plan_id = pl.id AND x.capability_id = cap.id
  );

-- Hospitality Business
INSERT INTO edge_commercial_plan_capabilities (plan_id, capability_id, inclusion_type)
SELECT pl.id, cap.id, 'INCLUDED'
FROM edge_commercial_plans pl
CROSS JOIN edge_technical_capabilities cap
WHERE pl.code = 'OKAPI_HOSP_BUSINESS'
  AND cap.code IN ('identity','hospitality','front_desk','housekeeping','reporting','api')
  AND NOT EXISTS (
    SELECT 1 FROM edge_commercial_plan_capabilities x
    WHERE x.plan_id = pl.id AND x.capability_id = cap.id
  );

INSERT INTO edge_commercial_plan_capabilities (plan_id, capability_id, inclusion_type, restrictions)
SELECT pl.id, cap.id, 'INCLUDED', jsonb_build_object('numericLimit', lim.limit_val)
FROM edge_commercial_plans pl
JOIN (VALUES ('max_organizations', 10), ('max_users', 120)) AS lim(code, limit_val) ON TRUE
JOIN edge_technical_capabilities cap ON cap.code = lim.code
WHERE pl.code = 'OKAPI_HOSP_BUSINESS'
  AND NOT EXISTS (
    SELECT 1 FROM edge_commercial_plan_capabilities x
    WHERE x.plan_id = pl.id AND x.capability_id = cap.id
  );

-- Hospitality Enterprise
INSERT INTO edge_commercial_plan_capabilities (plan_id, capability_id, inclusion_type)
SELECT pl.id, cap.id, 'INCLUDED'
FROM edge_commercial_plans pl
CROSS JOIN edge_technical_capabilities cap
WHERE pl.code = 'OKAPI_HOSP_ENTERPRISE'
  AND cap.code IN ('identity','hospitality','front_desk','housekeeping','reporting','api','analytics','sso')
  AND NOT EXISTS (
    SELECT 1 FROM edge_commercial_plan_capabilities x
    WHERE x.plan_id = pl.id AND x.capability_id = cap.id
  );

INSERT INTO edge_commercial_plan_capabilities (plan_id, capability_id, inclusion_type, restrictions)
SELECT pl.id, cap.id, 'INCLUDED', jsonb_build_object('numericLimit', lim.limit_val)
FROM edge_commercial_plans pl
JOIN (VALUES ('max_organizations', 50), ('max_users', 500)) AS lim(code, limit_val) ON TRUE
JOIN edge_technical_capabilities cap ON cap.code = lim.code
WHERE pl.code = 'OKAPI_HOSP_ENTERPRISE'
  AND NOT EXISTS (
    SELECT 1 FROM edge_commercial_plan_capabilities x
    WHERE x.plan_id = pl.id AND x.capability_id = cap.id
  );

-- Price books DRAFT / NEEDS_RESEARCH — no amounts
INSERT INTO edge_price_books (code, name, product_id, currency, status, metadata)
SELECT
  'PB_OKAPI_RETAIL_ROADMAP',
  'Okapi Retail roadmap price book',
  p.id,
  'XOF',
  'DRAFT',
  '{"rgom":true,"researchStatus":"NEEDS_RESEARCH","note":"no invented prices — G11 gate"}'::jsonb
FROM edge_products p
WHERE p.code = 'OKAPI_RETAIL'
  AND NOT EXISTS (SELECT 1 FROM edge_price_books b WHERE b.code = 'PB_OKAPI_RETAIL_ROADMAP');

INSERT INTO edge_price_books (code, name, product_id, currency, status, metadata)
SELECT
  'PB_OKAPI_HOSPITALITY_ROADMAP',
  'Okapi Hospitality roadmap price book',
  p.id,
  'XOF',
  'DRAFT',
  '{"rgom":true,"researchStatus":"NEEDS_RESEARCH","note":"no invented prices — G11 gate"}'::jsonb
FROM edge_products p
WHERE p.code = 'OKAPI_HOSPITALITY'
  AND NOT EXISTS (SELECT 1 FROM edge_price_books b WHERE b.code = 'PB_OKAPI_HOSPITALITY_ROADMAP');

-- Map product capabilities (supported)
INSERT INTO edge_product_capability_mappings (
  product_id, capability_id, classification, technical_status, commercial_availability
)
SELECT p.id, c.id, 'SUPPORTED', 'AVAILABLE', 'INTERNAL_ONLY'
FROM edge_products p
CROSS JOIN edge_technical_capabilities c
WHERE p.code = 'OKAPI_RETAIL'
  AND c.code IN (
    'identity','retail','grocery','inventory','pos','purchasing','reporting','api','analytics','sso',
    'max_organizations','max_users','max_pos_terminals'
  )
  AND NOT EXISTS (
    SELECT 1 FROM edge_product_capability_mappings m
    WHERE m.product_id = p.id AND m.capability_id = c.id AND m.product_version_id IS NULL
  );

INSERT INTO edge_product_capability_mappings (
  product_id, capability_id, classification, technical_status, commercial_availability
)
SELECT p.id, c.id, 'SUPPORTED', 'AVAILABLE', 'INTERNAL_ONLY'
FROM edge_products p
CROSS JOIN edge_technical_capabilities c
WHERE p.code = 'OKAPI_HOSPITALITY'
  AND c.code IN (
    'identity','hospitality','front_desk','housekeeping','reporting','api','analytics','sso',
    'max_organizations','max_users'
  )
  AND NOT EXISTS (
    SELECT 1 FROM edge_product_capability_mappings m
    WHERE m.product_id = p.id AND m.capability_id = c.id AND m.product_version_id IS NULL
  );
