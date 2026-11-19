-- Migration 145: CAFE Controlled pack capabilities + quotas (doc 39 Phase B)
-- Aligns PKG_REST_CAFE_CONTROLLED with RESTAURANT_CAFE_CONTROLLED_PACK seed.
-- CONTROLLED_ROLLOUT only — not AVAILABLE / not public PUBLISH.

-- Feature caps for cafe pack
INSERT INTO edge_solution_package_capabilities (package_id, capability_id, inclusion_type)
SELECT pkg.id, cap.id, 'INCLUDED'
FROM edge_solution_packages pkg
CROSS JOIN edge_technical_capabilities cap
WHERE pkg.code = 'PKG_REST_CAFE_CONTROLLED'
  AND cap.code IN (
    'identity', 'restaurant', 'menu', 'pos', 'inventory', 'kitchen', 'reporting'
  )
  AND NOT EXISTS (
    SELECT 1 FROM edge_solution_package_capabilities x
    WHERE x.package_id = pkg.id AND x.capability_id = cap.id
  );

-- Quota caps with numericLimit (seed: org 1 / users 15 / pos 4 / customers 5000 / products 800)
INSERT INTO edge_solution_package_capabilities (package_id, capability_id, inclusion_type, restrictions)
SELECT pkg.id, cap.id, 'INCLUDED', jsonb_build_object('numericLimit', lim.limit_val)
FROM edge_solution_packages pkg
JOIN (VALUES
  ('max_organizations', 1),
  ('max_users', 15),
  ('max_pos_terminals', 4),
  ('max_customers', 5000),
  ('max_products', 800)
) AS lim(code, limit_val) ON TRUE
JOIN edge_technical_capabilities cap ON cap.code = lim.code
WHERE pkg.code = 'PKG_REST_CAFE_CONTROLLED'
  AND NOT EXISTS (
    SELECT 1 FROM edge_solution_package_capabilities x
    WHERE x.package_id = pkg.id AND x.capability_id = cap.id
  );

-- Keep package metadata honest about quotas (ops/readability)
UPDATE edge_solution_packages
SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
  'quotas', jsonb_build_object(
    'max_organizations', 1,
    'max_users', 15,
    'max_pos_terminals', 4,
    'max_customers', 5000,
    'max_products', 800
  ),
  'rgomQuotaSeed', '145'
)
WHERE code = 'PKG_REST_CAFE_CONTROLLED';
