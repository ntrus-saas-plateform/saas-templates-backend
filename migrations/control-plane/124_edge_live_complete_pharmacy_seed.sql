-- Migration 124: Lab seed for live-complete Pharmacy product (idempotent).
-- Inserts vertical PHARMACY + product PHARMACY_LIVE only when missing.
-- Prefer scripts/seed-live-complete-pharmacy.ts when a product id print is needed.

INSERT INTO edge_verticals (code, slug, display_name, status)
SELECT 'PHARMACY', 'pharmacy', 'Pharmacy', 'ACTIVE'
WHERE NOT EXISTS (
  SELECT 1 FROM edge_verticals WHERE code = 'PHARMACY'
);

INSERT INTO edge_products (
  code, slug, name, short_description, vertical_id,
  lifecycle_status, commercial_availability, product_type, metadata
)
SELECT
  'PHARMACY_LIVE',
  'pharmacy-live',
  'Pharmacy Live Complete',
  'Lab product for Edge live-complete Pharmacy golden path',
  v.id,
  'PUBLISHED',
  'AVAILABLE',
  'SAAS',
  '{"liveComplete":true,"lab":"pharmacy"}'::jsonb
FROM edge_verticals v
WHERE v.code = 'PHARMACY'
  AND NOT EXISTS (
    SELECT 1 FROM edge_products p
    WHERE upper(p.code) IN ('PHARMACY_LIVE', 'PHARMACY')
       OR lower(p.slug) IN ('pharmacy-live', 'pharmacy')
  );

INSERT INTO schema_migrations (version)
VALUES ('124_edge_live_complete_pharmacy_seed')
ON CONFLICT DO NOTHING;
