-- Vague 3: vertical product extensions + offline POS/UI snapshots

CREATE TABLE IF NOT EXISTS vertical_extension_definitions (
  vertical_code VARCHAR(40) NOT NULL,
  extension_key VARCHAR(80) NOT NULL,
  label VARCHAR(200) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  json_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
  required_capabilities JSONB NOT NULL DEFAULT '[]'::jsonb,
  status VARCHAR(40) NOT NULL DEFAULT 'AVAILABLE'
    CHECK (status IN ('AVAILABLE', 'EXPERIMENTAL', 'DEPRECATED', 'SUSPENDED')),
  schema_version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (vertical_code, extension_key)
);

CREATE TABLE IF NOT EXISTS product_vertical_extensions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  product_id UUID NOT NULL,
  vertical_code VARCHAR(40) NOT NULL,
  extension_key VARCHAR(80) NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  schema_version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, product_id, vertical_code, extension_key)
);

CREATE INDEX IF NOT EXISTS idx_pve_product
  ON product_vertical_extensions (product_id);
CREATE INDEX IF NOT EXISTS idx_pve_org_vertical
  ON product_vertical_extensions (organization_id, vertical_code);

CREATE TABLE IF NOT EXISTS tenant_offline_config_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  snapshot_version INT NOT NULL,
  config_version INT NOT NULL,
  business_profile VARCHAR(80),
  pos_configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
  ui_configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
  enabled_capabilities JSONB NOT NULL DEFAULT '[]'::jsonb,
  feature_flags JSONB NOT NULL DEFAULT '{}'::jsonb,
  checksum VARCHAR(128),
  created_by VARCHAR(128),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, snapshot_version)
);

CREATE INDEX IF NOT EXISTS idx_offline_snap_org
  ON tenant_offline_config_snapshots (organization_id, snapshot_version DESC);

-- Seed extension contracts (no business logic — catalog only)
INSERT INTO vertical_extension_definitions
  (vertical_code, extension_key, label, description, json_schema, required_capabilities, status, schema_version)
VALUES
  (
    'PHARMACY', 'pharma.clinical', 'Pharmacy clinical attributes',
    'Non-core Rx attributes kept off products table',
    '{"type":"object","properties":{"atcCode":{"type":"string"},"genericName":{"type":"string"},"requiresPrescription":{"type":"boolean"},"controlledSchedule":{"type":"string"}}}'::jsonb,
    '["DISPENSING","PRESCRIPTION"]'::jsonb, 'AVAILABLE', 1
  ),
  (
    'PHARMACY', 'pharma.storage', 'Pharmacy storage',
    'Cold chain / storage satellite payload',
    '{"type":"object","properties":{"coldChain":{"type":"boolean"},"minTempC":{"type":"number"},"maxTempC":{"type":"number"}}}'::jsonb,
    '["COLD_CHAIN"]'::jsonb, 'AVAILABLE', 1
  ),
  (
    'SUPERMARKET', 'grocery.plu', 'Weighted PLU',
    'Scale / PLU attributes for weighed goods',
    '{"type":"object","properties":{"pluCode":{"type":"string"},"pricePerKg":{"type":"boolean"}}}'::jsonb,
    '["WEIGHTED_PRODUCTS","POS"]'::jsonb, 'EXPERIMENTAL', 1
  ),
  (
    'RETAIL_STORE', 'retail.variants', 'Retail variant axes',
    'Size/color variant metadata without bloating product core',
    '{"type":"object","properties":{"axes":{"type":"array","items":{"type":"string"}},"optionValues":{"type":"object"}}}'::jsonb,
    '["PRODUCT_VARIANTS"]'::jsonb, 'EXPERIMENTAL', 1
  ),
  (
    'RESTAURANT', 'fnb.recipe', 'Recipe / BOM link',
    'Recipe reference and yield — engine may be PARTIAL',
    '{"type":"object","properties":{"recipeCode":{"type":"string"},"yieldPortions":{"type":"number"},"prepMinutes":{"type":"number"}}}'::jsonb,
    '["RECIPES"]'::jsonb, 'EXPERIMENTAL', 1
  ),
  (
    'RESTAURANT', 'fnb.modifiers', 'Menu modifiers',
    'POS modifier groups for F&B',
    '{"type":"object","properties":{"modifierGroups":{"type":"array"}}}'::jsonb,
    '["POS","RECIPES"]'::jsonb, 'EXPERIMENTAL', 1
  ),
  (
    'WHOLESALE', 'b2b.moq', 'B2B MOQ / bulk',
    'Minimum order quantity and pack tiers',
    '{"type":"object","properties":{"moq":{"type":"number"},"packSize":{"type":"number"},"tierBreaks":{"type":"array"}}}'::jsonb,
    '["BULK","B2B"]'::jsonb, 'EXPERIMENTAL', 1
  )
ON CONFLICT (vertical_code, extension_key) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  json_schema = EXCLUDED.json_schema,
  required_capabilities = EXCLUDED.required_capabilities,
  status = EXCLUDED.status,
  schema_version = EXCLUDED.schema_version,
  updated_at = NOW();
