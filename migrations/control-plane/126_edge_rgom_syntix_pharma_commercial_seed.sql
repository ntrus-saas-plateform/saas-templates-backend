-- Migration 126: RGOM E1/E2 Syntix Pharma commercial beachhead seed (idempotent).
-- Prefer scripts/seed-rgom-syntix-pharma.ts for full re-seed + entitlementSnapshot JSON.
-- This migration ensures product + core taxonomy/plans exist after migrate:control.
-- No invented price amounts.

INSERT INTO edge_verticals (code, slug, display_name, status)
SELECT 'PHARMACY', 'pharmacy', 'Pharmacy', 'ACTIVE'
WHERE NOT EXISTS (SELECT 1 FROM edge_verticals WHERE code = 'PHARMACY');

INSERT INTO edge_products (
  code, slug, name, short_description, vertical_id,
  lifecycle_status, commercial_availability, product_type, metadata
)
SELECT
  'SYNTIX_PHARMA',
  'syntix-pharma',
  'Syntix Pharma',
  'Beachhead commercial product — retail pharmacy + wholesale/distribution',
  v.id,
  'PUBLISHED',
  'AVAILABLE',
  'SAAS',
  '{"rgom":true,"beachhead":"syntix","multiEstablishmentSemantics":"same-product-establishments"}'::jsonb
FROM edge_verticals v
WHERE v.code = 'PHARMACY'
  AND NOT EXISTS (
    SELECT 1 FROM edge_products p WHERE upper(p.code) = 'SYNTIX_PHARMA'
  );

-- Segments
INSERT INTO edge_market_segments (code, name, vertical_id, status, metadata)
SELECT s.code, s.name, v.id, 'ACTIVE', '{"rgom":"syntix-beachhead"}'::jsonb
FROM edge_verticals v
CROSS JOIN (VALUES
  ('PHARMA_RETAIL_INDEPENDENT', 'Independent retail pharmacy'),
  ('PHARMA_CHAIN', 'Pharmacy chain'),
  ('PHARMA_WHOLESALE', 'Pharmaceutical wholesaler'),
  ('PHARMA_DISTRIBUTION', 'Pharmaceutical distribution'),
  ('PHARMA_IMPORTER', 'Pharmaceutical importer'),
  ('PHARMA_HOSPITAL', 'Hospital / institutional pharmacy'),
  ('PHARMA_HYBRID', 'Hybrid pharmaceutical organization')
) AS s(code, name)
WHERE v.code = 'PHARMACY'
  AND NOT EXISTS (SELECT 1 FROM edge_market_segments m WHERE m.code = s.code);

-- Business profile templates
INSERT INTO edge_business_profile_templates (code, name, vertical_id, segment_id, status, metadata)
SELECT p.code, p.name, v.id, seg.id, 'ACTIVE', '{"rgom":"syntix-beachhead"}'::jsonb
FROM edge_verticals v
JOIN (VALUES
  ('INDEPENDENT_RETAIL_PHARMACY', 'Independent retail pharmacy', 'PHARMA_RETAIL_INDEPENDENT'),
  ('MULTI_BRANCH_PHARMACY_GROUP', 'Multi-branch pharmacy group', 'PHARMA_CHAIN'),
  ('PHARMACEUTICAL_WHOLESALER', 'Pharmaceutical wholesaler', 'PHARMA_WHOLESALE'),
  ('PHARMACEUTICAL_DISTRIBUTOR', 'Pharmaceutical distributor', 'PHARMA_DISTRIBUTION')
) AS p(code, name, segment_code) ON TRUE
JOIN edge_market_segments seg ON seg.code = p.segment_code
WHERE v.code = 'PHARMACY'
  AND NOT EXISTS (SELECT 1 FROM edge_business_profile_templates t WHERE t.code = p.code);

-- Operating models
INSERT INTO edge_operating_models (code, name, dimension, vertical_id, status, metadata)
SELECT o.code, o.name, o.dimension, v.id, 'ACTIVE', '{"rgom":"syntix-beachhead"}'::jsonb
FROM edge_verticals v
CROSS JOIN (VALUES
  ('SALES_B2C', 'B2C sales', 'SALES'),
  ('SALES_B2B', 'B2B sales', 'SALES'),
  ('FULFILL_COUNTER', 'Counter sales', 'FULFILLMENT'),
  ('FULFILL_DELIVERY', 'Delivery', 'FULFILLMENT'),
  ('INV_BATCH_EXPIRY', 'Batch + expiry tracked', 'INVENTORY'),
  ('INV_MULTI_WAREHOUSE', 'Multi-warehouse', 'INVENTORY'),
  ('PROCURE_CENTRAL', 'Centralized procurement', 'PROCUREMENT'),
  ('PROCURE_BRANCH', 'Branch-level procurement', 'PROCUREMENT'),
  ('ORG_SINGLE', 'Single branch', 'ORGANIZATION'),
  ('ORG_MULTI_BRANCH', 'Multi-branch', 'ORGANIZATION'),
  ('CHANNEL_DIRECT', 'Direct channel', 'CHANNEL'),
  ('CHANNEL_DISTRIBUTOR', 'Distributor channel', 'CHANNEL')
) AS o(code, name, dimension)
WHERE v.code = 'PHARMACY'
  AND NOT EXISTS (SELECT 1 FROM edge_operating_models m WHERE m.code = o.code);

-- Technical capabilities (beachhead)
INSERT INTO edge_technical_capabilities (
  code, name, category, technical_status, commercial_availability, metadata
)
SELECT c.code, c.name, c.category, 'AVAILABLE', 'AVAILABLE',
  jsonb_build_object('rgom', 'syntix-beachhead', 'entitlementKind', c.kind)
FROM (VALUES
  ('identity', 'Identity & access', 'PLATFORM', 'FEATURE_FLAG'),
  ('pharmacy', 'Pharmacy core', 'PHARMACY', 'FEATURE_FLAG'),
  ('inventory', 'Inventory engine', 'INVENTORY', 'FEATURE_FLAG'),
  ('pos', 'Point of sale', 'SALES', 'FEATURE_FLAG'),
  ('sales', 'Sales engine', 'SALES', 'FEATURE_FLAG'),
  ('pharmacy.batch', 'Batch management', 'PHARMACY', 'FEATURE_FLAG'),
  ('pharmacy.expiry', 'Expiry management', 'PHARMACY', 'FEATURE_FLAG'),
  ('purchasing', 'Purchasing & replenishment', 'PROCUREMENT', 'FEATURE_FLAG'),
  ('stock_transfers', 'Inter-site stock transfers', 'INVENTORY', 'FEATURE_FLAG'),
  ('reporting', 'Operational reporting', 'ANALYTICS', 'FEATURE_FLAG'),
  ('warehouse', 'Warehouse management', 'WAREHOUSE', 'FEATURE_FLAG'),
  ('b2b_sales', 'B2B sales & credit', 'WHOLESALE', 'FEATURE_FLAG'),
  ('api', 'API access', 'INTEGRATION', 'FEATURE_FLAG'),
  ('analytics', 'Advanced analytics', 'ANALYTICS', 'FEATURE_FLAG'),
  ('sso', 'SSO / IAM enterprise', 'SECURITY', 'FEATURE_FLAG'),
  ('governance', 'Advanced governance', 'PLATFORM', 'FEATURE_FLAG'),
  ('max_organizations', 'Max establishments (organizations)', 'QUOTA', 'QUOTA'),
  ('max_users', 'Max users', 'QUOTA', 'QUOTA'),
  ('max_warehouses', 'Max warehouses', 'QUOTA', 'QUOTA')
) AS c(code, name, category, kind)
WHERE NOT EXISTS (
  SELECT 1 FROM edge_technical_capabilities t WHERE t.code = c.code
);

-- Product ↔ capability mappings
INSERT INTO edge_product_capability_mappings (
  product_id, capability_id, classification, technical_status, commercial_availability
)
SELECT p.id, c.id, 'SUPPORTED', 'AVAILABLE', 'AVAILABLE'
FROM edge_products p
CROSS JOIN edge_technical_capabilities c
WHERE p.code = 'SYNTIX_PHARMA'
  AND c.code IN (
    'identity','pharmacy','inventory','pos','sales','pharmacy.batch','pharmacy.expiry',
    'purchasing','stock_transfers','reporting','warehouse','b2b_sales','api','analytics',
    'sso','governance','max_organizations','max_users','max_warehouses'
  )
  AND NOT EXISTS (
    SELECT 1 FROM edge_product_capability_mappings m
    WHERE m.product_id = p.id AND m.capability_id = c.id AND m.product_version_id IS NULL
  );

-- Solution packages
INSERT INTO edge_solution_packages (
  code, name, product_id, vertical_id, package_type, status, metadata
)
SELECT pkg.code, pkg.name, p.id, v.id, 'SOLUTION', 'PUBLISHED',
  '{"rgom":"syntix-beachhead"}'::jsonb
FROM edge_products p
JOIN edge_verticals v ON v.id = p.vertical_id
CROSS JOIN (VALUES
  ('PKG_RETAIL_PHARMACY', 'Retail Pharmacy Package'),
  ('PKG_PHARMACY_CHAIN', 'Pharmacy Chain Package'),
  ('PKG_WHOLESALE', 'Wholesale Package'),
  ('PKG_DISTRIBUTION', 'Distribution Package')
) AS pkg(code, name)
WHERE p.code = 'SYNTIX_PHARMA'
  AND NOT EXISTS (SELECT 1 FROM edge_solution_packages s WHERE s.code = pkg.code);

-- Package capabilities (core retail shared)
INSERT INTO edge_solution_package_capabilities (package_id, capability_id, inclusion_type)
SELECT pkg.id, cap.id, 'INCLUDED'
FROM edge_solution_packages pkg
CROSS JOIN edge_technical_capabilities cap
WHERE pkg.code = 'PKG_RETAIL_PHARMACY'
  AND cap.code IN (
    'identity','pharmacy','inventory','pos','sales','pharmacy.batch','pharmacy.expiry','purchasing'
  )
  AND NOT EXISTS (
    SELECT 1 FROM edge_solution_package_capabilities x
    WHERE x.package_id = pkg.id AND x.capability_id = cap.id
  );

INSERT INTO edge_solution_package_capabilities (package_id, capability_id, inclusion_type)
SELECT pkg.id, cap.id, 'INCLUDED'
FROM edge_solution_packages pkg
CROSS JOIN edge_technical_capabilities cap
WHERE pkg.code = 'PKG_PHARMACY_CHAIN'
  AND cap.code IN (
    'identity','pharmacy','inventory','pos','sales','pharmacy.batch','pharmacy.expiry',
    'purchasing','stock_transfers','reporting'
  )
  AND NOT EXISTS (
    SELECT 1 FROM edge_solution_package_capabilities x
    WHERE x.package_id = pkg.id AND x.capability_id = cap.id
  );

INSERT INTO edge_solution_package_capabilities (package_id, capability_id, inclusion_type)
SELECT pkg.id, cap.id, 'INCLUDED'
FROM edge_solution_packages pkg
CROSS JOIN edge_technical_capabilities cap
WHERE pkg.code = 'PKG_WHOLESALE'
  AND cap.code IN (
    'identity','pharmacy','inventory','sales','pharmacy.batch','pharmacy.expiry',
    'purchasing','warehouse','b2b_sales','reporting'
  )
  AND NOT EXISTS (
    SELECT 1 FROM edge_solution_package_capabilities x
    WHERE x.package_id = pkg.id AND x.capability_id = cap.id
  );

INSERT INTO edge_solution_package_capabilities (package_id, capability_id, inclusion_type)
SELECT pkg.id, cap.id, 'INCLUDED'
FROM edge_solution_packages pkg
CROSS JOIN edge_technical_capabilities cap
WHERE pkg.code = 'PKG_DISTRIBUTION'
  AND cap.code IN (
    'identity','pharmacy','inventory','pharmacy.batch','pharmacy.expiry',
    'purchasing','warehouse','b2b_sales','stock_transfers','reporting','api'
  )
  AND NOT EXISTS (
    SELECT 1 FROM edge_solution_package_capabilities x
    WHERE x.package_id = pkg.id AND x.capability_id = cap.id
  );

-- Plans Lite → Enterprise (entitlementSnapshot filled by TS seed; metadata marker here)
INSERT INTO edge_commercial_plans (
  code, name, product_id, vertical_id, plan_tier, solution_package_id, status, metadata
)
SELECT
  pl.code,
  pl.name,
  p.id,
  v.id,
  pl.tier,
  pkg.id,
  'PUBLISHED',
  jsonb_build_object(
    'rgom', 'syntix-beachhead',
    'runSeedScriptForFullSnapshot', 'scripts/seed-rgom-syntix-pharma.ts'
  )
FROM edge_products p
JOIN edge_verticals v ON v.id = p.vertical_id
JOIN (VALUES
  ('SYNTIX_LITE', 'Syntix Pharma Lite', 'LITE', 'PKG_RETAIL_PHARMACY'),
  ('SYNTIX_PROFESSIONAL', 'Syntix Pharma Professional', 'PROFESSIONAL', 'PKG_RETAIL_PHARMACY'),
  ('SYNTIX_BUSINESS', 'Syntix Pharma Business', 'BUSINESS', 'PKG_PHARMACY_CHAIN'),
  ('SYNTIX_ENTERPRISE', 'Syntix Pharma Enterprise', 'ENTERPRISE', 'PKG_DISTRIBUTION')
) AS pl(code, name, tier, pkg_code) ON TRUE
JOIN edge_solution_packages pkg ON pkg.code = pl.pkg_code
WHERE p.code = 'SYNTIX_PHARMA'
  AND NOT EXISTS (SELECT 1 FROM edge_commercial_plans x WHERE x.code = pl.code);

-- Plan capabilities: Lite core
INSERT INTO edge_commercial_plan_capabilities (plan_id, capability_id, inclusion_type)
SELECT pl.id, cap.id, 'INCLUDED'
FROM edge_commercial_plans pl
CROSS JOIN edge_technical_capabilities cap
WHERE pl.code = 'SYNTIX_LITE'
  AND cap.code IN (
    'identity','pharmacy','inventory','pos','sales','pharmacy.batch','pharmacy.expiry'
  )
  AND NOT EXISTS (
    SELECT 1 FROM edge_commercial_plan_capabilities x
    WHERE x.plan_id = pl.id AND x.capability_id = cap.id
  );

INSERT INTO edge_commercial_plan_capabilities (plan_id, capability_id, inclusion_type, restrictions)
SELECT pl.id, cap.id, 'INCLUDED', jsonb_build_object('numericLimit', lim.limit_val)
FROM edge_commercial_plans pl
JOIN (VALUES
  ('max_organizations', 1),
  ('max_users', 5),
  ('max_warehouses', 0)
) AS lim(code, limit_val) ON TRUE
JOIN edge_technical_capabilities cap ON cap.code = lim.code
WHERE pl.code = 'SYNTIX_LITE'
  AND NOT EXISTS (
    SELECT 1 FROM edge_commercial_plan_capabilities x
    WHERE x.plan_id = pl.id AND x.capability_id = cap.id
  );

-- Professional
INSERT INTO edge_commercial_plan_capabilities (plan_id, capability_id, inclusion_type)
SELECT pl.id, cap.id, 'INCLUDED'
FROM edge_commercial_plans pl
CROSS JOIN edge_technical_capabilities cap
WHERE pl.code = 'SYNTIX_PROFESSIONAL'
  AND cap.code IN (
    'identity','pharmacy','inventory','pos','sales','pharmacy.batch','pharmacy.expiry',
    'purchasing','stock_transfers','reporting'
  )
  AND NOT EXISTS (
    SELECT 1 FROM edge_commercial_plan_capabilities x
    WHERE x.plan_id = pl.id AND x.capability_id = cap.id
  );

INSERT INTO edge_commercial_plan_capabilities (plan_id, capability_id, inclusion_type, restrictions)
SELECT pl.id, cap.id, 'INCLUDED', jsonb_build_object('numericLimit', lim.limit_val)
FROM edge_commercial_plans pl
JOIN (VALUES
  ('max_organizations', 3),
  ('max_users', 25),
  ('max_warehouses', 1)
) AS lim(code, limit_val) ON TRUE
JOIN edge_technical_capabilities cap ON cap.code = lim.code
WHERE pl.code = 'SYNTIX_PROFESSIONAL'
  AND NOT EXISTS (
    SELECT 1 FROM edge_commercial_plan_capabilities x
    WHERE x.plan_id = pl.id AND x.capability_id = cap.id
  );

-- Business
INSERT INTO edge_commercial_plan_capabilities (plan_id, capability_id, inclusion_type)
SELECT pl.id, cap.id, 'INCLUDED'
FROM edge_commercial_plans pl
CROSS JOIN edge_technical_capabilities cap
WHERE pl.code = 'SYNTIX_BUSINESS'
  AND cap.code IN (
    'identity','pharmacy','inventory','pos','sales','pharmacy.batch','pharmacy.expiry',
    'purchasing','stock_transfers','reporting','warehouse','b2b_sales','api','analytics'
  )
  AND NOT EXISTS (
    SELECT 1 FROM edge_commercial_plan_capabilities x
    WHERE x.plan_id = pl.id AND x.capability_id = cap.id
  );

INSERT INTO edge_commercial_plan_capabilities (plan_id, capability_id, inclusion_type, restrictions)
SELECT pl.id, cap.id, 'INCLUDED', jsonb_build_object('numericLimit', lim.limit_val)
FROM edge_commercial_plans pl
JOIN (VALUES
  ('max_organizations', 15),
  ('max_users', 100),
  ('max_warehouses', 5)
) AS lim(code, limit_val) ON TRUE
JOIN edge_technical_capabilities cap ON cap.code = lim.code
WHERE pl.code = 'SYNTIX_BUSINESS'
  AND NOT EXISTS (
    SELECT 1 FROM edge_commercial_plan_capabilities x
    WHERE x.plan_id = pl.id AND x.capability_id = cap.id
  );

-- Enterprise
INSERT INTO edge_commercial_plan_capabilities (plan_id, capability_id, inclusion_type)
SELECT pl.id, cap.id, 'INCLUDED'
FROM edge_commercial_plans pl
CROSS JOIN edge_technical_capabilities cap
WHERE pl.code = 'SYNTIX_ENTERPRISE'
  AND cap.code IN (
    'identity','pharmacy','inventory','pos','sales','pharmacy.batch','pharmacy.expiry',
    'purchasing','stock_transfers','reporting','warehouse','b2b_sales','api','analytics',
    'sso','governance'
  )
  AND NOT EXISTS (
    SELECT 1 FROM edge_commercial_plan_capabilities x
    WHERE x.plan_id = pl.id AND x.capability_id = cap.id
  );

INSERT INTO edge_commercial_plan_capabilities (plan_id, capability_id, inclusion_type, restrictions)
SELECT pl.id, cap.id, 'INCLUDED', jsonb_build_object('numericLimit', lim.limit_val)
FROM edge_commercial_plans pl
JOIN (VALUES
  ('max_organizations', 100),
  ('max_users', 1000),
  ('max_warehouses', 50)
) AS lim(code, limit_val) ON TRUE
JOIN edge_technical_capabilities cap ON cap.code = lim.code
WHERE pl.code = 'SYNTIX_ENTERPRISE'
  AND NOT EXISTS (
    SELECT 1 FROM edge_commercial_plan_capabilities x
    WHERE x.plan_id = pl.id AND x.capability_id = cap.id
  );

-- Add-ons
INSERT INTO edge_commercial_addons (code, name, product_id, addon_type, status, eligibility, metadata)
SELECT a.code, a.name, p.id, 'CAPABILITY', 'PUBLISHED',
  '{"compatiblePlanTiers":["PROFESSIONAL","BUSINESS","ENTERPRISE"]}'::jsonb,
  '{"rgom":"syntix-beachhead"}'::jsonb
FROM edge_products p
CROSS JOIN (VALUES
  ('ADDON_EXTRA_WAREHOUSE', 'Additional warehouse'),
  ('ADDON_API_CAPACITY', 'API capacity'),
  ('ADDON_ADVANCED_ANALYTICS', 'Advanced analytics')
) AS a(code, name)
WHERE p.code = 'SYNTIX_PHARMA'
  AND NOT EXISTS (SELECT 1 FROM edge_commercial_addons x WHERE x.code = a.code);

INSERT INTO edge_commercial_addon_capabilities (addon_id, capability_id, inclusion_type)
SELECT ad.id, cap.id, 'INCLUDED'
FROM edge_commercial_addons ad
JOIN edge_technical_capabilities cap ON (
  (ad.code = 'ADDON_EXTRA_WAREHOUSE' AND cap.code = 'warehouse')
  OR (ad.code = 'ADDON_API_CAPACITY' AND cap.code = 'api')
  OR (ad.code = 'ADDON_ADVANCED_ANALYTICS' AND cap.code = 'analytics')
)
WHERE ad.code LIKE 'ADDON_%'
  AND NOT EXISTS (
    SELECT 1 FROM edge_commercial_addon_capabilities x
    WHERE x.addon_id = ad.id AND x.capability_id = cap.id
  );

-- Pricing units (no amounts)
INSERT INTO edge_pricing_units (code, name, unit_category, status, metadata)
SELECT u.code, u.name, u.cat, 'ACTIVE', '{"rgom":"syntix-beachhead"}'::jsonb
FROM (VALUES
  ('PU_SITE', 'Per establishment / site', 'LOCATION'),
  ('PU_USER', 'Per user', 'USER'),
  ('PU_WAREHOUSE', 'Per warehouse', 'WAREHOUSE')
) AS u(code, name, cat)
WHERE NOT EXISTS (SELECT 1 FROM edge_pricing_units x WHERE x.code = u.code);

INSERT INTO edge_price_books (code, name, product_id, currency, status, metadata)
SELECT
  'PB_SYNTIX_BEACHHEAD',
  'Syntix Pharma beachhead price book',
  p.id,
  'XOF',
  'DRAFT',
  '{"rgom":"syntix-beachhead","researchStatus":"NEEDS_RESEARCH","note":"no invented prices"}'::jsonb
FROM edge_products p
WHERE p.code = 'SYNTIX_PHARMA'
  AND NOT EXISTS (SELECT 1 FROM edge_price_books b WHERE b.code = 'PB_SYNTIX_BEACHHEAD');

INSERT INTO schema_migrations (version)
VALUES ('126_edge_rgom_syntix_pharma_commercial_seed')
ON CONFLICT DO NOTHING;
