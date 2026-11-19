-- Migration 146: Plan OKAPI_REST_CAFE_CONTROLLED (doc 39 Phase B)
-- Même mécanisme plan→capabilities que Retail/Hosp stubs.
-- status DRAFT, commercialAvailability CONTROLLED_ROLLOUT — PAS AVAILABLE / PAS PUBLISHED.
-- Quotas alignés RESTAURANT_CAFE_CONTROLLED_PACK / PKG_REST_CAFE_CONTROLLED. Pas de prix inventés.

INSERT INTO edge_commercial_plans (
  code, name, product_id, vertical_id, plan_tier, solution_package_id, status, metadata
)
SELECT
  'OKAPI_REST_CAFE_CONTROLLED',
  'Okapi Cafe Controlled',
  p.id,
  v.id,
  'LITE',
  pkg.id,
  'DRAFT',
  jsonb_build_object(
    'rgom', true,
    'bbProfileCode', 'CAFE',
    'commercialAvailability', 'CONTROLLED_ROLLOUT',
    'parentProduct', 'OKAPI_RESTAURANT',
    'cafePack', 'PKG_REST_CAFE_CONTROLLED',
    'note', 'G11 Controlled — same tenant family (doc 39 Phase B). Not public AVAILABLE.'
  )
FROM edge_products p
JOIN edge_verticals v ON v.id = p.vertical_id
JOIN edge_solution_packages pkg ON pkg.code = 'PKG_REST_CAFE_CONTROLLED'
WHERE p.code = 'OKAPI_RESTAURANT'
  AND NOT EXISTS (
    SELECT 1 FROM edge_commercial_plans x WHERE x.code = 'OKAPI_REST_CAFE_CONTROLLED'
  );

-- Feature caps (seed pack)
INSERT INTO edge_commercial_plan_capabilities (plan_id, capability_id, inclusion_type)
SELECT pl.id, cap.id, 'INCLUDED'
FROM edge_commercial_plans pl
CROSS JOIN edge_technical_capabilities cap
WHERE pl.code = 'OKAPI_REST_CAFE_CONTROLLED'
  AND cap.code IN (
    'identity', 'restaurant', 'menu', 'pos', 'inventory', 'kitchen', 'reporting'
  )
  AND NOT EXISTS (
    SELECT 1 FROM edge_commercial_plan_capabilities x
    WHERE x.plan_id = pl.id AND x.capability_id = cap.id
  );

-- Quota caps with numericLimit (org 1 / users 15 / pos 4 / customers 5000 / products 800)
INSERT INTO edge_commercial_plan_capabilities (plan_id, capability_id, inclusion_type, restrictions)
SELECT pl.id, cap.id, 'INCLUDED', jsonb_build_object('numericLimit', lim.limit_val)
FROM edge_commercial_plans pl
JOIN (VALUES
  ('max_organizations', 1),
  ('max_users', 15),
  ('max_pos_terminals', 4),
  ('max_customers', 5000),
  ('max_products', 800)
) AS lim(code, limit_val) ON TRUE
JOIN edge_technical_capabilities cap ON cap.code = lim.code
WHERE pl.code = 'OKAPI_REST_CAFE_CONTROLLED'
  AND NOT EXISTS (
    SELECT 1 FROM edge_commercial_plan_capabilities x
    WHERE x.plan_id = pl.id AND x.capability_id = cap.id
  );
