-- Migration 125: Vague 2 lab seed — Restaurant vertical + RESTAURANT_LIVE (idempotent).
-- Prefer scripts/seed-live-complete-restaurant.ts when a product id print is needed.

INSERT INTO edge_verticals (code, slug, display_name, status)
SELECT 'RESTAURANT', 'restaurant', 'Restaurant', 'ACTIVE'
WHERE NOT EXISTS (
  SELECT 1 FROM edge_verticals WHERE code = 'RESTAURANT'
);

INSERT INTO edge_products (
  code, slug, name, short_description, vertical_id,
  lifecycle_status, commercial_availability, product_type, metadata
)
SELECT
  'RESTAURANT_LIVE',
  'restaurant-live',
  'Restaurant Live Complete',
  'Lab product for Edge Vague 2 Restaurant golden path',
  v.id,
  'PUBLISHED',
  'AVAILABLE',
  'SAAS',
  '{"liveComplete":true,"lab":"restaurant","vague":2}'::jsonb
FROM edge_verticals v
WHERE v.code = 'RESTAURANT'
  AND NOT EXISTS (
    SELECT 1 FROM edge_products p
    WHERE upper(p.code) IN ('RESTAURANT_LIVE', 'RESTAURANT')
       OR lower(p.slug) IN ('restaurant-live', 'restaurant')
  );

INSERT INTO schema_migrations (version)
VALUES ('125_edge_vague2_restaurant_seed')
ON CONFLICT DO NOTHING;
