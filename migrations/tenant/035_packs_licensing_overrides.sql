-- Vague 4: packs HOTEL/CLINIC/HOSPITAL, marketplace licensing, warehouse overrides

-- ========== New capabilities ==========
INSERT INTO capability_definitions (code, name, description, category, status, required_modules, supported_verticals) VALUES
  ('ADMISSIONS', 'Admissions', 'Patient / guest admission workflows', 'HEALTHCARE', 'EXPERIMENTAL', '["customer"]', '["CLINIC","HOSPITAL"]'),
  ('BEDS', 'Beds / wards', 'Bed and ward management', 'HEALTHCARE', 'EXPERIMENTAL', '["inventory"]', '["HOSPITAL","CLINIC"]'),
  ('CLINICAL_ORDERS', 'Clinical orders', 'Clinical order capture (non-Rx engine)', 'HEALTHCARE', 'EXPERIMENTAL', '["sales"]', '["CLINIC","HOSPITAL"]'),
  ('REGULATORY_AUDIT', 'Regulatory audit', 'Regulatory audit trail & retention', 'COMPLIANCE', 'AVAILABLE', '["identity"]', '["PHARMACY","CLINIC","HOSPITAL","HOTEL"]'),
  ('ROOM_SERVICE', 'Room service', 'In-room F&B / amenity orders', 'HOSPITALITY', 'EXPERIMENTAL', '["pos","sales"]', '["HOTEL"]'),
  ('HOUSEKEEPING', 'Housekeeping', 'Housekeeping task boards', 'HOSPITALITY', 'EXPERIMENTAL', '["inventory"]', '["HOTEL"]'),
  ('PMS', 'Property management', 'Hotel PMS integration surface', 'HOSPITALITY', 'EXPERIMENTAL', '["customer"]', '["HOTEL"]'),
  ('MINIBAR', 'Minibar', 'Minibar inventory & posting', 'HOSPITALITY', 'EXPERIMENTAL', '["inventory","pos"]', '["HOTEL"]')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  status = EXCLUDED.status,
  required_modules = EXCLUDED.required_modules,
  supported_verticals = EXCLUDED.supported_verticals,
  updated_at = NOW();

INSERT INTO capability_dependencies (capability_code, depends_on_code) VALUES
  ('ADMISSIONS', 'CRM'),
  ('BEDS', 'INVENTORY'),
  ('CLINICAL_ORDERS', 'SALES'),
  ('ROOM_SERVICE', 'POS'),
  ('HOUSEKEEPING', 'INVENTORY'),
  ('PMS', 'CRM'),
  ('MINIBAR', 'INVENTORY'),
  ('MINIBAR', 'POS')
ON CONFLICT DO NOTHING;

-- Expand vertical support for existing caps
UPDATE capability_definitions
SET supported_verticals = '["PHARMACY","SUPERMARKET","RETAIL_STORE","BOUTIQUE","RESTAURANT","CAFE","HOTEL","CLINIC","HOSPITAL"]'::jsonb,
    updated_at = NOW()
WHERE code = 'POS';

UPDATE capability_definitions
SET supported_verticals = '["PHARMACY","SUPERMARKET","RESTAURANT","HEALTHCARE_RETAIL","CLINIC","HOSPITAL"]'::jsonb,
    updated_at = NOW()
WHERE code = 'LOT_TRACKING';

UPDATE capability_definitions
SET supported_verticals = '["PHARMACY","SUPERMARKET","RESTAURANT","GROCERY","CLINIC","HOSPITAL"]'::jsonb,
    updated_at = NOW()
WHERE code IN ('EXPIRATION', 'FEFO');

UPDATE capability_definitions
SET supported_verticals = '["PHARMACY","HEALTHCARE_RETAIL","CLINIC","HOSPITAL"]'::jsonb,
    updated_at = NOW()
WHERE code = 'COLD_CHAIN';

UPDATE capability_definitions
SET supported_verticals = '["SUPERMARKET","RETAIL_STORE","PHARMACY","WHOLESALE","HOSPITAL","HOTEL"]'::jsonb,
    updated_at = NOW()
WHERE code = 'MULTI_STORE';

-- Enrich CLINIC / HOSPITAL / HOTEL profiles (no longer stubs-only)
UPDATE business_profiles SET
  description = 'Outpatient clinic pack: lot/FEFO, Rx capture, admissions, regulatory audit',
  default_capabilities = '["INVENTORY","SALES","CRM","LOT_TRACKING","EXPIRATION","FEFO","PRESCRIPTION","INSURANCE","ADMISSIONS","CLINICAL_ORDERS","REGULATORY_AUDIT"]'::jsonb,
  default_modules = '["inventory","sales","customer","catalog","pharmacy"]'::jsonb,
  default_features = '{"pharmacy.dispensing":false,"inventory.batch_tracking":true,"inventory.expiration":true}'::jsonb,
  default_policy_bundle = '{"inventory":{"allowNegativeStock":false,"enableFefo":true,"requireLotForMedication":true,"requireExpirationForMedication":true},"commercial":{"allocationStrategy":"FEFO","defaultFulfillmentPolicy":"CANCEL"}}'::jsonb,
  default_pos_configuration = '{"schemaVersion":1,"enabledModes":["ORDER","PAYMENT"],"offlineMode":false,"scannerMode":"BARCODE"}'::jsonb,
  default_ui_configuration = '{"navigation":["customers","catalog","inventory","admissions"],"highlight":["prescription"]}'::jsonb,
  updated_at = NOW()
WHERE code = 'CLINIC';

UPDATE business_profiles SET
  description = 'Hospital pack: multi-store, cold chain, beds, admissions, regulatory',
  default_capabilities = '["INVENTORY","PURCHASING","CRM","LOT_TRACKING","EXPIRATION","FEFO","COLD_CHAIN","PRESCRIPTION","INSURANCE","MULTI_STORE","ADMISSIONS","BEDS","CLINICAL_ORDERS","REGULATORY_AUDIT","CONTROLLED_PRODUCTS"]'::jsonb,
  default_modules = '["inventory","purchasing","customer","catalog","pharmacy"]'::jsonb,
  default_features = '{"inventory.multi_warehouse":true,"inventory.batch_tracking":true,"inventory.expiration":true,"pharmacy.controlled_substances":true}'::jsonb,
  default_policy_bundle = '{"inventory":{"allowNegativeStock":false,"enableFefo":true,"requireLotForMedication":true,"requireExpirationForMedication":true,"quarantineReturns":true},"commercial":{"allocationStrategy":"FEFO","defaultFulfillmentPolicy":"PARTIAL_FULFILLMENT"}}'::jsonb,
  default_pos_configuration = '{"schemaVersion":1,"enabledModes":["ORDER","PAYMENT"],"offlineMode":false}'::jsonb,
  default_ui_configuration = '{"navigation":["inventory","purchasing","customers","wards"],"highlight":["cold_chain","controlled"]}'::jsonb,
  updated_at = NOW()
WHERE code = 'HOSPITAL';

UPDATE business_profiles SET
  description = 'Hotel pack: POS, PMS, room service, housekeeping, minibar',
  default_capabilities = '["INVENTORY","SALES","POS","PURCHASING","CRM","PMS","ROOM_SERVICE","HOUSEKEEPING","MINIBAR","MULTI_STORE","REGULATORY_AUDIT"]'::jsonb,
  default_modules = '["inventory","sales","pos","purchasing","customer","catalog"]'::jsonb,
  default_features = '{"commerce.pos":true,"enable_mobile_pos":true}'::jsonb,
  default_policy_bundle = '{"inventory":{"allowNegativeStock":false,"enableFefo":false},"commercial":{"allocationStrategy":"FIFO","defaultFulfillmentPolicy":"CANCEL","enableMobilePos":true}}'::jsonb,
  default_pos_configuration = '{"schemaVersion":1,"enabledModes":["POS","ROOM_SERVICE","PAYMENT"],"offlineMode":true,"scannerMode":"BARCODE","offlineSnapshotPolicy":"ON_ACTIVATE"}'::jsonb,
  default_ui_configuration = '{"navigation":["pos","rooms","housekeeping","inventory","customers"],"highlight":["room_service"]}'::jsonb,
  updated_at = NOW()
WHERE code = 'HOTEL';

INSERT INTO business_profile_versions (profile_code, version, snapshot)
SELECT code, version + 1, to_jsonb(business_profiles.*) - 'created_at' - 'updated_at'
FROM business_profiles
WHERE code IN ('CLINIC', 'HOSPITAL', 'HOTEL')
ON CONFLICT (profile_code, version) DO NOTHING;

UPDATE business_profiles SET version = version + 1
WHERE code IN ('CLINIC', 'HOSPITAL', 'HOTEL');

-- Extension contracts for new verticals
INSERT INTO vertical_extension_definitions
  (vertical_code, extension_key, label, description, json_schema, required_capabilities, status, schema_version)
VALUES
  ('CLINIC', 'clinic.admission', 'Clinic encounter', 'Outpatient encounter metadata',
   '{"type":"object","properties":{"encounterType":{"type":"string"},"specialty":{"type":"string"}}}'::jsonb,
   '["ADMISSIONS"]'::jsonb, 'EXPERIMENTAL', 1),
  ('HOSPITAL', 'hospital.ward', 'Ward / bed link', 'Ward placement for stock delivery',
   '{"type":"object","properties":{"wardCode":{"type":"string"},"bedId":{"type":"string"}}}'::jsonb,
   '["BEDS"]'::jsonb, 'EXPERIMENTAL', 1),
  ('HOSPITAL', 'hospital.formulary', 'Hospital formulary', 'Formulary flags without bloating product core',
   '{"type":"object","properties":{"formularyCode":{"type":"string"},"restricted":{"type":"boolean"}}}'::jsonb,
   '["CONTROLLED_PRODUCTS"]'::jsonb, 'AVAILABLE', 1),
  ('HOTEL', 'hotel.room', 'Room amenity SKU', 'Room / amenity linkage for minibar',
   '{"type":"object","properties":{"roomType":{"type":"string"},"minibarEligible":{"type":"boolean"}}}'::jsonb,
   '["MINIBAR","PMS"]'::jsonb, 'EXPERIMENTAL', 1)
ON CONFLICT (vertical_code, extension_key) DO UPDATE SET
  label = EXCLUDED.label,
  json_schema = EXCLUDED.json_schema,
  required_capabilities = EXCLUDED.required_capabilities,
  status = EXCLUDED.status,
  updated_at = NOW();

-- ========== Marketplace licensing packs ==========
CREATE TABLE IF NOT EXISTS licensing_packs (
  code VARCHAR(80) PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  pack_kind VARCHAR(40) NOT NULL
    CHECK (pack_kind IN ('PROFILE', 'ADDON', 'REGULATORY', 'VERTICAL')),
  target_profile_code VARCHAR(80),
  industry VARCHAR(80),
  version INT NOT NULL DEFAULT 1,
  status VARCHAR(40) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'DEPRECATED', 'DRAFT')),
  capability_codes JSONB NOT NULL DEFAULT '[]'::jsonb,
  module_keys JSONB NOT NULL DEFAULT '[]'::jsonb,
  feature_flags JSONB NOT NULL DEFAULT '{}'::jsonb,
  policy_bundle_patch JSONB NOT NULL DEFAULT '{}'::jsonb,
  regulatory_configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
  required_plan_modules JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS org_pack_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  pack_code VARCHAR(80) NOT NULL REFERENCES licensing_packs(code),
  pack_version INT NOT NULL DEFAULT 1,
  status VARCHAR(40) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('TRIAL', 'ACTIVE', 'SUSPENDED', 'CANCELLED', 'EXPIRED')),
  source VARCHAR(40) NOT NULL DEFAULT 'MARKETPLACE'
    CHECK (source IN ('MARKETPLACE', 'MANUAL', 'PLAN_BUNDLE', 'MIGRATION')),
  licensed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  installed_config_version INT,
  actor_id VARCHAR(128),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, pack_code)
);

CREATE INDEX IF NOT EXISTS idx_org_pack_subs_org
  ON org_pack_subscriptions (organization_id, status);

-- ========== Warehouse capability overrides ==========
CREATE TABLE IF NOT EXISTS warehouse_capability_overrides (
  organization_id UUID NOT NULL,
  warehouse_id UUID NOT NULL,
  capability_code VARCHAR(80) NOT NULL REFERENCES capability_definitions(code),
  effect VARCHAR(20) NOT NULL
    CHECK (effect IN ('ENABLE', 'DISABLE', 'FORCE_POLICY')),
  policy_patch JSONB NOT NULL DEFAULT '{}'::jsonb,
  reason TEXT,
  actor_id VARCHAR(128),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (warehouse_id, capability_code)
);

CREATE INDEX IF NOT EXISTS idx_wh_cap_overrides_org
  ON warehouse_capability_overrides (organization_id);

-- Pack seeds
INSERT INTO licensing_packs (
  code, name, description, pack_kind, target_profile_code, industry, version, status,
  capability_codes, module_keys, feature_flags, policy_bundle_patch,
  regulatory_configuration, required_plan_modules, metadata
) VALUES
(
  'CLINIC_CORE', 'Clinic Core', 'Outpatient clinic vertical pack',
  'PROFILE', 'CLINIC', 'CLINIC', 1, 'ACTIVE',
  '["INVENTORY","SALES","CRM","LOT_TRACKING","EXPIRATION","FEFO","PRESCRIPTION","INSURANCE","ADMISSIONS","CLINICAL_ORDERS","REGULATORY_AUDIT"]'::jsonb,
  '["inventory","sales","customer","catalog","pharmacy"]'::jsonb,
  '{"pharmacy.dispensing":false,"inventory.batch_tracking":true}'::jsonb,
  '{"inventory":{"enableFefo":true,"allowNegativeStock":false,"requireLotForMedication":true}}'::jsonb,
  '{"regime":"OUTPATIENT","retentionYears":7,"auditRequired":true}'::jsonb,
  '["identity","customer"]'::jsonb,
  '{"marketplace":true,"tier":"standard"}'::jsonb
),
(
  'HOSPITAL_CORE', 'Hospital Core', 'Hospital multi-store + cold chain pack',
  'PROFILE', 'HOSPITAL', 'HOSPITAL', 1, 'ACTIVE',
  '["INVENTORY","PURCHASING","CRM","LOT_TRACKING","EXPIRATION","FEFO","COLD_CHAIN","PRESCRIPTION","INSURANCE","MULTI_STORE","ADMISSIONS","BEDS","CONTROLLED_PRODUCTS","REGULATORY_AUDIT"]'::jsonb,
  '["inventory","purchasing","customer","catalog","pharmacy"]'::jsonb,
  '{"inventory.multi_warehouse":true,"pharmacy.controlled_substances":true}'::jsonb,
  '{"inventory":{"enableFefo":true,"allowNegativeStock":false,"quarantineReturns":true}}'::jsonb,
  '{"regime":"INPATIENT","retentionYears":10,"narcoticsLog":true}'::jsonb,
  '["identity","customer"]'::jsonb,
  '{"marketplace":true,"tier":"enterprise"}'::jsonb
),
(
  'HOTEL_CORE', 'Hotel Core', 'Hotel PMS + room service pack',
  'PROFILE', 'HOTEL', 'HOTEL', 1, 'ACTIVE',
  '["INVENTORY","SALES","POS","PURCHASING","CRM","PMS","ROOM_SERVICE","HOUSEKEEPING","MINIBAR","MULTI_STORE"]'::jsonb,
  '["inventory","sales","pos","purchasing","customer","catalog"]'::jsonb,
  '{"commerce.pos":true}'::jsonb,
  '{"inventory":{"enableFefo":false},"commercial":{"allocationStrategy":"FIFO","enableMobilePos":true}}'::jsonb,
  '{"regime":"HOSPITALITY","guestDataRetentionDays":365}'::jsonb,
  '["identity","customer","commerce"]'::jsonb,
  '{"marketplace":true,"tier":"standard"}'::jsonb
),
(
  'REG_CONTROLLED_SUBSTANCES', 'Regulatory: Controlled substances',
  'Addon regulatory pack for narcotics / controlled products',
  'REGULATORY', NULL, 'HEALTHCARE', 1, 'ACTIVE',
  '["CONTROLLED_PRODUCTS","REGULATORY_AUDIT","LOT_TRACKING"]'::jsonb,
  '["inventory","pharmacy"]'::jsonb,
  '{"pharmacy.controlled_substances":true}'::jsonb,
  '{"inventory":{"requireLotForMedication":true,"quarantineReturns":true}}'::jsonb,
  '{"controlledSubstances":true,"scheduleTracking":true,"dualControl":true}'::jsonb,
  '["identity"]'::jsonb,
  '{"marketplace":true,"addon":true}'::jsonb
),
(
  'REG_COLD_CHAIN_GDP', 'Regulatory: Cold chain GDP',
  'GDP-style cold chain regulatory addon',
  'REGULATORY', NULL, 'HEALTHCARE', 1, 'ACTIVE',
  '["COLD_CHAIN","EXPIRATION","FEFO","REGULATORY_AUDIT"]'::jsonb,
  '["inventory"]'::jsonb,
  '{"inventory.expiration":true}'::jsonb,
  '{"inventory":{"enableFefo":true,"requireExpirationForMedication":true}}'::jsonb,
  '{"gdp":true,"temperatureExcursionLogging":true}'::jsonb,
  '["identity"]'::jsonb,
  '{"marketplace":true,"addon":true}'::jsonb
)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  capability_codes = EXCLUDED.capability_codes,
  module_keys = EXCLUDED.module_keys,
  feature_flags = EXCLUDED.feature_flags,
  policy_bundle_patch = EXCLUDED.policy_bundle_patch,
  regulatory_configuration = EXCLUDED.regulatory_configuration,
  updated_at = NOW();
