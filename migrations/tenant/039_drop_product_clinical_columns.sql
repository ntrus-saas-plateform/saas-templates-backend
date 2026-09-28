-- Vague 5.1: drop clinical narrative columns from products (hot-path flags remain)
-- Clinical data lives in product_vertical_extensions (pharma.clinical / pharma.storage).
-- Ensure backfill from 036 ran before this migration.

-- Re-backfill any remaining clinical rows (idempotent)
INSERT INTO product_vertical_extensions
  (organization_id, product_id, vertical_code, extension_key, payload, schema_version)
SELECT
  p.organization_id,
  p.id,
  'PHARMACY',
  'pharma.clinical',
  jsonb_strip_nulls(jsonb_build_object(
    'dosage', p.dosage,
    'strength', p.strength,
    'pharmaceuticalForm', p.pharmaceutical_form,
    'administrationRoute', p.administration_route,
    'activeIngredients', p.active_ingredients,
    'therapeuticClass', p.therapeutic_class,
    'atcCode', p.atc_code,
    'regulatoryInfo', p.regulatory_info
  )),
  1
FROM products p
WHERE (
  p.dosage IS NOT NULL
  OR p.strength IS NOT NULL
  OR p.pharmaceutical_form IS NOT NULL
  OR p.administration_route IS NOT NULL
  OR p.atc_code IS NOT NULL
  OR p.therapeutic_class IS NOT NULL
)
ON CONFLICT (organization_id, product_id, vertical_code, extension_key) DO UPDATE SET
  payload = product_vertical_extensions.payload || EXCLUDED.payload,
  updated_at = NOW();

INSERT INTO product_vertical_extensions
  (organization_id, product_id, vertical_code, extension_key, payload, schema_version)
SELECT
  p.organization_id,
  p.id,
  'PHARMACY',
  'pharma.storage',
  jsonb_strip_nulls(jsonb_build_object(
    'handlingRequirements', p.handling_requirements
  )),
  1
FROM products p
WHERE p.handling_requirements IS NOT NULL
ON CONFLICT (organization_id, product_id, vertical_code, extension_key) DO UPDATE SET
  payload = product_vertical_extensions.payload || EXCLUDED.payload,
  updated_at = NOW();

ALTER TABLE products DROP COLUMN IF EXISTS dosage;
ALTER TABLE products DROP COLUMN IF EXISTS strength;
ALTER TABLE products DROP COLUMN IF EXISTS pharmaceutical_form;
ALTER TABLE products DROP COLUMN IF EXISTS administration_route;
ALTER TABLE products DROP COLUMN IF EXISTS active_ingredients;
ALTER TABLE products DROP COLUMN IF EXISTS therapeutic_class;
ALTER TABLE products DROP COLUMN IF EXISTS atc_code;
ALTER TABLE products DROP COLUMN IF EXISTS regulatory_info;
ALTER TABLE products DROP COLUMN IF EXISTS handling_requirements;

COMMENT ON TABLE products IS
  'Core product — clinical narrative in product_vertical_extensions; hot-path compliance flags remain on row';
