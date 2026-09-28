-- Migration 032: Multi-vertical business configuration (capabilities + profiles)

CREATE TABLE IF NOT EXISTS capability_definitions (
  code VARCHAR(80) PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category VARCHAR(80) NOT NULL DEFAULT 'CORE',
  version INT NOT NULL DEFAULT 1,
  status VARCHAR(40) NOT NULL DEFAULT 'AVAILABLE'
    CHECK (status IN ('AVAILABLE', 'ENABLED', 'DISABLED', 'SUSPENDED', 'DEPRECATED', 'EXPERIMENTAL')),
  required_modules JSONB NOT NULL DEFAULT '[]'::jsonb,
  required_permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
  configuration_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
  supported_verticals JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS capability_dependencies (
  capability_code VARCHAR(80) NOT NULL REFERENCES capability_definitions(code) ON DELETE CASCADE,
  depends_on_code VARCHAR(80) NOT NULL REFERENCES capability_definitions(code) ON DELETE CASCADE,
  PRIMARY KEY (capability_code, depends_on_code),
  CHECK (capability_code <> depends_on_code)
);

CREATE TABLE IF NOT EXISTS capability_conflicts (
  capability_code VARCHAR(80) NOT NULL REFERENCES capability_definitions(code) ON DELETE CASCADE,
  conflicts_with_code VARCHAR(80) NOT NULL REFERENCES capability_definitions(code) ON DELETE CASCADE,
  PRIMARY KEY (capability_code, conflicts_with_code),
  CHECK (capability_code <> conflicts_with_code)
);

CREATE TABLE IF NOT EXISTS business_profiles (
  code VARCHAR(80) PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  industry VARCHAR(80) NOT NULL DEFAULT 'GENERAL',
  category VARCHAR(80) NOT NULL DEFAULT 'RETAIL',
  version INT NOT NULL DEFAULT 1,
  status VARCHAR(40) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'DEPRECATED', 'DRAFT')),
  default_capabilities JSONB NOT NULL DEFAULT '[]'::jsonb,
  default_modules JSONB NOT NULL DEFAULT '[]'::jsonb,
  default_features JSONB NOT NULL DEFAULT '{}'::jsonb,
  default_policy_bundle JSONB NOT NULL DEFAULT '{}'::jsonb,
  default_workflow_bindings JSONB NOT NULL DEFAULT '[]'::jsonb,
  default_pos_configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
  default_ui_configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS business_profile_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_code VARCHAR(80) NOT NULL REFERENCES business_profiles(code) ON DELETE CASCADE,
  version INT NOT NULL,
  snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (profile_code, version)
);

CREATE TABLE IF NOT EXISTS tenant_business_configurations (
  organization_id UUID PRIMARY KEY,
  profile_code VARCHAR(80) REFERENCES business_profiles(code),
  industry VARCHAR(80) NOT NULL DEFAULT 'GENERAL',
  business_type VARCHAR(80) NOT NULL DEFAULT 'UNKNOWN',
  status VARCHAR(40) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('DRAFT', 'ACTIVE', 'ARCHIVED')),
  version INT NOT NULL DEFAULT 1,
  enabled_modules JSONB NOT NULL DEFAULT '[]'::jsonb,
  feature_flags JSONB NOT NULL DEFAULT '{}'::jsonb,
  policy_bundle JSONB NOT NULL DEFAULT '{}'::jsonb,
  ui_configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
  pos_configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
  regulatory_configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
  localization_configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tenant_capabilities (
  organization_id UUID NOT NULL,
  capability_code VARCHAR(80) NOT NULL REFERENCES capability_definitions(code),
  state VARCHAR(40) NOT NULL DEFAULT 'ENABLED'
    CHECK (state IN ('AVAILABLE', 'ENABLED', 'DISABLED', 'SUSPENDED', 'DEPRECATED', 'EXPERIMENTAL')),
  source VARCHAR(40) NOT NULL DEFAULT 'MANUAL'
    CHECK (source IN ('PROFILE', 'MANUAL', 'ENTITLEMENT')),
  reason TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (organization_id, capability_code)
);

CREATE INDEX IF NOT EXISTS idx_tenant_capabilities_org_state
  ON tenant_capabilities (organization_id, state);

CREATE TABLE IF NOT EXISTS tenant_workflow_bindings (
  organization_id UUID NOT NULL,
  process_code VARCHAR(80) NOT NULL,
  workflow_template_code VARCHAR(120) NOT NULL,
  workflow_version INT NOT NULL DEFAULT 1,
  status VARCHAR(40) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'INACTIVE')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (organization_id, process_code)
);

CREATE TABLE IF NOT EXISTS business_config_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  action VARCHAR(80) NOT NULL,
  actor_id UUID,
  before_state JSONB,
  after_state JSONB,
  correlation_id VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_business_config_audit_org
  ON business_config_audit (organization_id, created_at DESC);

-- ========== CAPABILITY SEED ==========
INSERT INTO capability_definitions (code, name, description, category, status, required_modules, supported_verticals) VALUES
  ('INVENTORY', 'Inventory', 'Core inventory engine', 'CORE', 'AVAILABLE', '["inventory"]', '["*"]'),
  ('SALES', 'Sales', 'Sales orders and quotes', 'CORE', 'AVAILABLE', '["sales"]', '["*"]'),
  ('PURCHASING', 'Purchasing', 'Procurement', 'CORE', 'AVAILABLE', '["purchasing"]', '["*"]'),
  ('POS', 'Point of Sale', 'POS checkout', 'CORE', 'AVAILABLE', '["pos"]', '["PHARMACY","SUPERMARKET","RETAIL_STORE","BOUTIQUE","RESTAURANT","CAFE"]'),
  ('CRM', 'CRM', 'Customer relationship', 'CORE', 'AVAILABLE', '["customer"]', '["*"]'),
  ('LOT_TRACKING', 'Lot tracking', 'Batch/lot tracking', 'INVENTORY', 'AVAILABLE', '["inventory"]', '["PHARMACY","SUPERMARKET","RESTAURANT","HEALTHCARE_RETAIL"]'),
  ('SERIAL_TRACKING', 'Serial tracking', 'Serial number tracking', 'INVENTORY', 'AVAILABLE', '["inventory"]', '["PHARMACY","RETAIL_STORE"]'),
  ('EXPIRATION', 'Expiration tracking', 'Expiry dates on lots', 'INVENTORY', 'AVAILABLE', '["inventory"]', '["PHARMACY","SUPERMARKET","RESTAURANT","GROCERY"]'),
  ('FEFO', 'FEFO allocation', 'First expiry first out', 'INVENTORY', 'AVAILABLE', '["inventory"]', '["PHARMACY","SUPERMARKET","RESTAURANT","GROCERY"]'),
  ('COLD_CHAIN', 'Cold chain', 'Temperature-controlled stock', 'INVENTORY', 'AVAILABLE', '["inventory"]', '["PHARMACY","HEALTHCARE_RETAIL"]'),
  ('RECALL', 'Recall', 'Product recall workflows', 'INVENTORY', 'AVAILABLE', '["inventory"]', '["PHARMACY","SUPERMARKET","HEALTHCARE_RETAIL"]'),
  ('CONTROLLED_PRODUCTS', 'Controlled products', 'Controlled substance handling', 'HEALTHCARE', 'AVAILABLE', '["inventory","pharmacy"]', '["PHARMACY","CLINIC","HOSPITAL"]'),
  ('PRESCRIPTION', 'Prescription', 'Prescription capture', 'HEALTHCARE', 'EXPERIMENTAL', '["pharmacy"]', '["PHARMACY","CLINIC","HOSPITAL"]'),
  ('DISPENSING', 'Dispensing', 'Pharmacy dispensing', 'HEALTHCARE', 'EXPERIMENTAL', '["pharmacy"]', '["PHARMACY"]'),
  ('INSURANCE', 'Insurance', 'Insurance claims', 'HEALTHCARE', 'EXPERIMENTAL', '["pharmacy"]', '["PHARMACY","CLINIC","HOSPITAL"]'),
  ('LOYALTY', 'Loyalty', 'Loyalty points', 'COMMERCE', 'AVAILABLE', '["loyalty"]', '["*"]'),
  ('PROMOTIONS', 'Promotions', 'Promotional pricing', 'COMMERCE', 'AVAILABLE', '["pricing"]', '["*"]'),
  ('WEIGHTED_PRODUCTS', 'Weighted products', 'Scale / PLU products', 'COMMERCE', 'EXPERIMENTAL', '["catalog","pos"]', '["SUPERMARKET","GROCERY"]'),
  ('PRODUCT_VARIANTS', 'Product variants', 'Size/color variants', 'COMMERCE', 'EXPERIMENTAL', '["catalog"]', '["RETAIL_STORE","BOUTIQUE"]'),
  ('MULTI_STORE', 'Multi-store', 'Multi-location inventory', 'CORE', 'AVAILABLE', '["inventory"]', '["SUPERMARKET","RETAIL_STORE","PHARMACY","WHOLESALE"]'),
  ('CREDIT', 'Credit management', 'Customer credit limits', 'COMMERCE', 'AVAILABLE', '["sales"]', '["WHOLESALE","DISTRIBUTION","B2B"]'),
  ('PRICE_LISTS', 'Price lists', 'Customer-specific pricing', 'COMMERCE', 'AVAILABLE', '["pricing"]', '["WHOLESALE","DISTRIBUTION","RETAIL_STORE"]'),
  ('B2B', 'B2B customers', 'Business customer model', 'COMMERCE', 'AVAILABLE', '["customer","sales"]', '["WHOLESALE","DISTRIBUTION"]'),
  ('BULK', 'Bulk pricing', 'MOQ and bulk tiers', 'COMMERCE', 'EXPERIMENTAL', '["pricing","sales"]', '["WHOLESALE","DISTRIBUTION"]'),
  ('RECIPES', 'Recipes', 'Recipe / BOM food', 'RESTAURANT', 'EXPERIMENTAL', '["catalog","inventory"]', '["RESTAURANT","CAFE"]'),
  ('INGREDIENTS', 'Ingredients', 'Ingredient tracking', 'RESTAURANT', 'EXPERIMENTAL', '["inventory"]', '["RESTAURANT","CAFE"]'),
  ('KITCHEN', 'Kitchen', 'Kitchen display / production', 'RESTAURANT', 'EXPERIMENTAL', '["pos"]', '["RESTAURANT","CAFE"]'),
  ('TABLES', 'Tables', 'Table management', 'RESTAURANT', 'EXPERIMENTAL', '["pos"]', '["RESTAURANT","CAFE"]'),
  ('WASTE', 'Waste tracking', 'Food waste', 'RESTAURANT', 'EXPERIMENTAL', '["inventory"]', '["RESTAURANT","CAFE"]'),
  ('CONSIGNMENT', 'Consignment', 'Consignment stock', 'COMMERCE', 'AVAILABLE', '["inventory"]', '["RETAIL_STORE","WHOLESALE"]'),
  ('DELIVERY', 'Delivery', 'Delivery / last mile', 'LOGISTICS', 'EXPERIMENTAL', '["fulfillment"]', '["RESTAURANT","SUPERMARKET","WHOLESALE"]')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  status = EXCLUDED.status,
  required_modules = EXCLUDED.required_modules,
  supported_verticals = EXCLUDED.supported_verticals,
  updated_at = NOW();

INSERT INTO capability_dependencies (capability_code, depends_on_code) VALUES
  ('LOT_TRACKING', 'INVENTORY'),
  ('SERIAL_TRACKING', 'INVENTORY'),
  ('EXPIRATION', 'LOT_TRACKING'),
  ('FEFO', 'EXPIRATION'),
  ('FEFO', 'LOT_TRACKING'),
  ('COLD_CHAIN', 'INVENTORY'),
  ('RECALL', 'LOT_TRACKING'),
  ('CONTROLLED_PRODUCTS', 'LOT_TRACKING'),
  ('PRESCRIPTION', 'CRM'),
  ('DISPENSING', 'PRESCRIPTION'),
  ('INSURANCE', 'PRESCRIPTION'),
  ('RECIPES', 'INVENTORY'),
  ('INGREDIENTS', 'RECIPES'),
  ('KITCHEN', 'POS'),
  ('TABLES', 'POS'),
  ('WASTE', 'INVENTORY'),
  ('WEIGHTED_PRODUCTS', 'POS'),
  ('BULK', 'PRICE_LISTS'),
  ('B2B', 'SALES'),
  ('CREDIT', 'SALES')
ON CONFLICT DO NOTHING;


INSERT INTO business_profile_versions (profile_code, version, snapshot)
SELECT code, version, to_jsonb(business_profiles.*) - 'created_at' - 'updated_at'
FROM business_profiles
ON CONFLICT (profile_code, version) DO NOTHING;
