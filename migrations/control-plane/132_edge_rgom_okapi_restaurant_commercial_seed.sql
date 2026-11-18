-- Migration 132: RGOM E1/E2 Okapi Restaurant commercial beachhead (idempotent).
-- Distinct from Syntix Pharma plans. No invented price amounts.

INSERT INTO edge_verticals (code, slug, display_name, status)
SELECT 'RESTAURANT', 'restaurant', 'Restaurant', 'ACTIVE'
WHERE NOT EXISTS (SELECT 1 FROM edge_verticals WHERE code = 'RESTAURANT');

INSERT INTO edge_products (
  code, slug, name, short_description, vertical_id,
  lifecycle_status, commercial_availability, product_type, metadata
)
SELECT
  'OKAPI_RESTAURANT',
  'okapi-restaurant',
  'Okapi Restaurant',
  'Beachhead commercial product — independent / multi-site / QSR',
  v.id,
  'PUBLISHED',
  'AVAILABLE',
  'SAAS',
  '{"rgom":true,"beachhead":"okapi-restaurant","multiEstablishmentSemantics":"same-product-establishments"}'::jsonb
FROM edge_verticals v
WHERE v.code = 'RESTAURANT'
  AND NOT EXISTS (SELECT 1 FROM edge_products p WHERE upper(p.code) = 'OKAPI_RESTAURANT');

-- Also align RESTAURANT_LIVE lab product commercial_availability if present
UPDATE edge_products
SET commercial_availability = COALESCE(commercial_availability, 'AVAILABLE'),
    metadata = COALESCE(metadata, '{}'::jsonb) || '{"rgomAligned":true}'::jsonb
WHERE upper(code) IN ('RESTAURANT_LIVE', 'RESTAURANT');

INSERT INTO edge_market_segments (code, name, vertical_id, status, metadata)
SELECT s.code, s.name, v.id, 'ACTIVE', '{"rgom":"okapi-restaurant-beachhead"}'::jsonb
FROM edge_verticals v
CROSS JOIN (VALUES
  ('REST_INDEPENDENT', 'Independent restaurant'),
  ('REST_MULTI_SITE', 'Multi-site restaurant group'),
  ('REST_QSR', 'Quick service restaurant (QSR)'),
  ('REST_CLOUD_KITCHEN', 'Cloud / ghost kitchen')
) AS s(code, name)
WHERE v.code = 'RESTAURANT'
  AND NOT EXISTS (SELECT 1 FROM edge_market_segments m WHERE m.code = s.code);

INSERT INTO edge_business_profile_templates (code, name, vertical_id, segment_id, status, metadata)
SELECT p.code, p.name, v.id, seg.id, 'ACTIVE', '{"rgom":"okapi-restaurant-beachhead"}'::jsonb
FROM edge_verticals v
JOIN (VALUES
  ('INDEPENDENT_RESTAURANT', 'Independent restaurant', 'REST_INDEPENDENT'),
  ('MULTI_SITE_RESTAURANT', 'Multi-site restaurant group', 'REST_MULTI_SITE'),
  ('QSR_RESTAURANT', 'QSR restaurant', 'REST_QSR')
) AS p(code, name, segment_code) ON TRUE
JOIN edge_market_segments seg ON seg.code = p.segment_code
WHERE v.code = 'RESTAURANT'
  AND NOT EXISTS (SELECT 1 FROM edge_business_profile_templates t WHERE t.code = p.code);

INSERT INTO edge_icp_definitions (code, name, vertical_id, product_id, status, metadata)
SELECT i.code, i.name, v.id, p.id, 'ACTIVE',
  jsonb_build_object('rgom', 'okapi-restaurant-beachhead', 'segmentCode', i.segment_code)
FROM edge_verticals v
JOIN edge_products p ON p.code = 'OKAPI_RESTAURANT' AND p.vertical_id = v.id
CROSS JOIN (VALUES
  ('ICP_REST_INDEPENDENT', 'Independent F&B operator', 'REST_INDEPENDENT'),
  ('ICP_REST_MULTI_SITE', 'Multi-site F&B group', 'REST_MULTI_SITE'),
  ('ICP_REST_QSR', 'QSR / fast casual', 'REST_QSR')
) AS i(code, name, segment_code)
WHERE v.code = 'RESTAURANT'
  AND NOT EXISTS (SELECT 1 FROM edge_icp_definitions x WHERE x.code = i.code);

INSERT INTO edge_technical_capabilities (
  code, name, category, technical_status, commercial_availability, metadata
)
SELECT c.code, c.name, c.category, 'AVAILABLE', c.avail,
  jsonb_build_object('rgom', 'okapi-restaurant-beachhead')
FROM (VALUES
  ('restaurant', 'Restaurant core', 'RESTAURANT', 'AVAILABLE'),
  ('menu', 'Menu management', 'RESTAURANT', 'AVAILABLE'),
  ('kitchen', 'Kitchen display / tickets', 'RESTAURANT', 'AVAILABLE'),
  ('tables', 'Table / floor management', 'RESTAURANT', 'AVAILABLE'),
  ('delivery', 'Delivery / takeaway', 'CHANNEL', 'AVAILABLE'),
  ('max_pos_terminals', 'Max POS terminals', 'QUOTA', 'AVAILABLE')
) AS c(code, name, category, avail)
WHERE NOT EXISTS (SELECT 1 FROM edge_technical_capabilities t WHERE t.code = c.code);

INSERT INTO edge_product_capability_mappings (
  product_id, capability_id, classification, technical_status, commercial_availability
)
SELECT p.id, c.id, 'SUPPORTED', 'AVAILABLE', c.commercial_availability
FROM edge_products p
CROSS JOIN edge_technical_capabilities c
WHERE p.code = 'OKAPI_RESTAURANT'
  AND c.code IN (
    'identity','restaurant','menu','pos','inventory','kitchen','tables','delivery',
    'reporting','api','analytics','sso','max_organizations','max_users','max_pos_terminals'
  )
  AND NOT EXISTS (
    SELECT 1 FROM edge_product_capability_mappings m
    WHERE m.product_id = p.id AND m.capability_id = c.id AND m.product_version_id IS NULL
  );

INSERT INTO edge_solution_packages (
  code, name, product_id, vertical_id, package_type, status, metadata
)
SELECT pkg.code, pkg.name, p.id, v.id, 'SOLUTION', 'PUBLISHED',
  '{"rgom":"okapi-restaurant-beachhead"}'::jsonb
FROM edge_products p
JOIN edge_verticals v ON v.id = p.vertical_id
CROSS JOIN (VALUES
  ('PKG_REST_INDEPENDENT', 'Independent Restaurant Package'),
  ('PKG_REST_MULTI_SITE', 'Multi-site Restaurant Package'),
  ('PKG_REST_QSR', 'QSR Restaurant Package')
) AS pkg(code, name)
WHERE p.code = 'OKAPI_RESTAURANT'
  AND NOT EXISTS (SELECT 1 FROM edge_solution_packages s WHERE s.code = pkg.code);

INSERT INTO edge_commercial_plans (
  code, name, product_id, vertical_id, plan_tier, solution_package_id, status, metadata
)
SELECT
  pl.code, pl.name, p.id, v.id, pl.tier, pkg.id, 'PUBLISHED',
  jsonb_build_object('rgom', 'okapi-restaurant-beachhead', 'distinctFromPharma', true)
FROM edge_products p
JOIN edge_verticals v ON v.id = p.vertical_id
JOIN (VALUES
  ('OKAPI_REST_STARTER', 'Okapi Restaurant Starter', 'LITE', 'PKG_REST_INDEPENDENT'),
  ('OKAPI_REST_GROWTH', 'Okapi Restaurant Growth', 'PROFESSIONAL', 'PKG_REST_INDEPENDENT'),
  ('OKAPI_REST_MULTI', 'Okapi Restaurant Multi-site', 'BUSINESS', 'PKG_REST_MULTI_SITE'),
  ('OKAPI_REST_ENTERPRISE', 'Okapi Restaurant Enterprise', 'ENTERPRISE', 'PKG_REST_QSR')
) AS pl(code, name, tier, pkg_code) ON TRUE
JOIN edge_solution_packages pkg ON pkg.code = pl.pkg_code
WHERE p.code = 'OKAPI_RESTAURANT'
  AND NOT EXISTS (SELECT 1 FROM edge_commercial_plans x WHERE x.code = pl.code);

-- Starter caps
INSERT INTO edge_commercial_plan_capabilities (plan_id, capability_id, inclusion_type)
SELECT pl.id, cap.id, 'INCLUDED'
FROM edge_commercial_plans pl
CROSS JOIN edge_technical_capabilities cap
WHERE pl.code = 'OKAPI_REST_STARTER'
  AND cap.code IN ('identity','restaurant','menu','pos','tables')
  AND NOT EXISTS (
    SELECT 1 FROM edge_commercial_plan_capabilities x
    WHERE x.plan_id = pl.id AND x.capability_id = cap.id
  );

INSERT INTO edge_commercial_plan_capabilities (plan_id, capability_id, inclusion_type, restrictions)
SELECT pl.id, cap.id, 'INCLUDED', jsonb_build_object('numericLimit', lim.limit_val)
FROM edge_commercial_plans pl
JOIN (VALUES
  ('max_organizations', 1),
  ('max_users', 8),
  ('max_pos_terminals', 2)
) AS lim(code, limit_val) ON TRUE
JOIN edge_technical_capabilities cap ON cap.code = lim.code
WHERE pl.code = 'OKAPI_REST_STARTER'
  AND NOT EXISTS (
    SELECT 1 FROM edge_commercial_plan_capabilities x
    WHERE x.plan_id = pl.id AND x.capability_id = cap.id
  );

-- Growth
INSERT INTO edge_commercial_plan_capabilities (plan_id, capability_id, inclusion_type)
SELECT pl.id, cap.id, 'INCLUDED'
FROM edge_commercial_plans pl
CROSS JOIN edge_technical_capabilities cap
WHERE pl.code = 'OKAPI_REST_GROWTH'
  AND cap.code IN ('identity','restaurant','menu','pos','tables','inventory','kitchen','reporting')
  AND NOT EXISTS (
    SELECT 1 FROM edge_commercial_plan_capabilities x
    WHERE x.plan_id = pl.id AND x.capability_id = cap.id
  );

INSERT INTO edge_commercial_plan_capabilities (plan_id, capability_id, inclusion_type, restrictions)
SELECT pl.id, cap.id, 'INCLUDED', jsonb_build_object('numericLimit', lim.limit_val)
FROM edge_commercial_plans pl
JOIN (VALUES
  ('max_organizations', 1),
  ('max_users', 25),
  ('max_pos_terminals', 5)
) AS lim(code, limit_val) ON TRUE
JOIN edge_technical_capabilities cap ON cap.code = lim.code
WHERE pl.code = 'OKAPI_REST_GROWTH'
  AND NOT EXISTS (
    SELECT 1 FROM edge_commercial_plan_capabilities x
    WHERE x.plan_id = pl.id AND x.capability_id = cap.id
  );

-- Multi-site
INSERT INTO edge_commercial_plan_capabilities (plan_id, capability_id, inclusion_type)
SELECT pl.id, cap.id, 'INCLUDED'
FROM edge_commercial_plans pl
CROSS JOIN edge_technical_capabilities cap
WHERE pl.code = 'OKAPI_REST_MULTI'
  AND cap.code IN (
    'identity','restaurant','menu','pos','tables','inventory','kitchen','delivery','reporting','api'
  )
  AND NOT EXISTS (
    SELECT 1 FROM edge_commercial_plan_capabilities x
    WHERE x.plan_id = pl.id AND x.capability_id = cap.id
  );

INSERT INTO edge_commercial_plan_capabilities (plan_id, capability_id, inclusion_type, restrictions)
SELECT pl.id, cap.id, 'INCLUDED', jsonb_build_object('numericLimit', lim.limit_val)
FROM edge_commercial_plans pl
JOIN (VALUES
  ('max_organizations', 10),
  ('max_users', 80),
  ('max_pos_terminals', 20)
) AS lim(code, limit_val) ON TRUE
JOIN edge_technical_capabilities cap ON cap.code = lim.code
WHERE pl.code = 'OKAPI_REST_MULTI'
  AND NOT EXISTS (
    SELECT 1 FROM edge_commercial_plan_capabilities x
    WHERE x.plan_id = pl.id AND x.capability_id = cap.id
  );

-- Enterprise
INSERT INTO edge_commercial_plan_capabilities (plan_id, capability_id, inclusion_type)
SELECT pl.id, cap.id, 'INCLUDED'
FROM edge_commercial_plans pl
CROSS JOIN edge_technical_capabilities cap
WHERE pl.code = 'OKAPI_REST_ENTERPRISE'
  AND cap.code IN (
    'identity','restaurant','menu','pos','tables','inventory','kitchen','delivery',
    'reporting','api','analytics','sso'
  )
  AND NOT EXISTS (
    SELECT 1 FROM edge_commercial_plan_capabilities x
    WHERE x.plan_id = pl.id AND x.capability_id = cap.id
  );

INSERT INTO edge_commercial_plan_capabilities (plan_id, capability_id, inclusion_type, restrictions)
SELECT pl.id, cap.id, 'INCLUDED', jsonb_build_object('numericLimit', lim.limit_val)
FROM edge_commercial_plans pl
JOIN (VALUES
  ('max_organizations', 50),
  ('max_users', 500),
  ('max_pos_terminals', 100)
) AS lim(code, limit_val) ON TRUE
JOIN edge_technical_capabilities cap ON cap.code = lim.code
WHERE pl.code = 'OKAPI_REST_ENTERPRISE'
  AND NOT EXISTS (
    SELECT 1 FROM edge_commercial_plan_capabilities x
    WHERE x.plan_id = pl.id AND x.capability_id = cap.id
  );

INSERT INTO edge_pricing_units (code, name, unit_category, status, metadata)
SELECT u.code, u.name, u.cat, 'ACTIVE', '{"rgom":"okapi-restaurant-beachhead"}'::jsonb
FROM (VALUES
  ('PU_POS_TERMINAL', 'Per POS terminal', 'DEVICE'),
  ('PU_COVER', 'Per cover / seat (research)', 'USAGE')
) AS u(code, name, cat)
WHERE NOT EXISTS (SELECT 1 FROM edge_pricing_units x WHERE x.code = u.code);

INSERT INTO edge_price_books (code, name, product_id, currency, status, metadata)
SELECT
  'PB_OKAPI_RESTAURANT_BEACHHEAD',
  'Okapi Restaurant beachhead price book',
  p.id,
  'XOF',
  'DRAFT',
  '{"rgom":"okapi-restaurant-beachhead","researchStatus":"NEEDS_RESEARCH","note":"no invented prices"}'::jsonb
FROM edge_products p
WHERE p.code = 'OKAPI_RESTAURANT'
  AND NOT EXISTS (SELECT 1 FROM edge_price_books b WHERE b.code = 'PB_OKAPI_RESTAURANT_BEACHHEAD');

-- Taxonomy-only verticals (E1 autres)
INSERT INTO edge_verticals (code, slug, display_name, status)
SELECT v.code, v.slug, v.name, 'ACTIVE'
FROM (VALUES
  ('RETAIL', 'retail', 'Retail'),
  ('EDUCATION', 'education', 'Education'),
  ('LOGISTICS', 'logistics', 'Logistics')
) AS v(code, slug, name)
WHERE NOT EXISTS (SELECT 1 FROM edge_verticals x WHERE x.code = v.code);

-- Discount policy beachhead (approval matrix — no invented amounts)
INSERT INTO edge_discount_policies (
  code, name, product_id, discount_type, max_percentage, approval_matrix, status, metadata
)
SELECT
  'DISC_RGOM_BEACHHEAD',
  'RGOM beachhead discount policy',
  NULL,
  'PERCENTAGE',
  25,
  '[
    {"maxPercentExclusive":5,"approver":"AE"},
    {"maxPercentExclusive":15,"approver":"MANAGER"},
    {"maxPercentExclusive":25,"approver":"DIRECTOR"},
    {"maxPercentExclusive":100,"approver":"CFO"}
  ]'::jsonb,
  'ACTIVE',
  '{"rgom":true,"auditRequired":true}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM edge_discount_policies d WHERE d.code = 'DISC_RGOM_BEACHHEAD');

-- Geographic pricing rules as billing policy seed (declarative)
INSERT INTO edge_billing_policies (code, policy_type, rules, status)
VALUES (
  'GEO_PRICING_BEACHHEAD',
  'PRICING',
  '{
    "markets":[{"code":"GEO_CI_XOF","countries":["CI"],"currency":"XOF","priceBookCode":"PB_SYNTIX_BEACHHEAD","status":"DRAFT"}],
    "note":"Amounts NEEDS_RESEARCH — never invent unit prices"
  }'::jsonb,
  'ACTIVE'
)
ON CONFLICT (code) DO UPDATE SET
  rules = EXCLUDED.rules,
  status = 'ACTIVE',
  updated_at = NOW();

INSERT INTO schema_migrations (version)
VALUES ('132_edge_rgom_okapi_restaurant_commercial_seed')
ON CONFLICT DO NOTHING;
