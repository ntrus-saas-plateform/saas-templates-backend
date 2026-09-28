-- Vague 4.2 / §§22–36: profile template enrichment, BARCODE + pharmacy caps, light base_profile

ALTER TABLE business_profiles
  ADD COLUMN IF NOT EXISTS base_profile_code VARCHAR(80) NULL
    REFERENCES business_profiles(code);

-- New reusable capabilities (compose into profiles — no industry ifs)
INSERT INTO capability_definitions
  (code, name, description, category, status, required_modules, supported_verticals)
VALUES
  ('BARCODE', 'Barcode', 'Barcode / scanner operations', 'COMMERCE', 'AVAILABLE', '["pos","catalog"]'::jsonb, '["PHARMACY","SUPERMARKET","GROCERY","RETAIL_STORE","BOUTIQUE","RESTAURANT"]'::jsonb),
  ('PATIENT', 'Patient', 'Patient identity on customer', 'HEALTHCARE', 'AVAILABLE', '["customer","pharmacy"]'::jsonb, '["PHARMACY","CLINIC","HOSPITAL","HEALTHCARE_RETAIL"]'::jsonb),
  ('QUARANTINE', 'Quarantine', 'Quarantine stock holds', 'INVENTORY', 'AVAILABLE', '["inventory"]'::jsonb, '["PHARMACY","SUPERMARKET","RESTAURANT","HEALTHCARE_RETAIL"]'::jsonb),
  ('QUALITY', 'Quality', 'Quality holds / CAPA hooks', 'INVENTORY', 'AVAILABLE', '["inventory"]'::jsonb, '["PHARMACY","HEALTHCARE_RETAIL","HOSPITAL"]'::jsonb),
  ('PHARMACIST_VALIDATION', 'Pharmacist validation', 'Pharmacist review gate', 'HEALTHCARE', 'EXPERIMENTAL', '["pharmacy"]'::jsonb, '["PHARMACY"]'::jsonb),
  ('SUBSTITUTION', 'Substitution', 'Therapeutic / generic substitution', 'HEALTHCARE', 'AVAILABLE', '["catalog","pharmacy"]'::jsonb, '["PHARMACY"]'::jsonb),
  ('GENERIC_PRODUCTS', 'Generic products', 'Generic / brand linkage', 'HEALTHCARE', 'AVAILABLE', '["catalog"]'::jsonb, '["PHARMACY","HEALTHCARE_RETAIL"]'::jsonb),
  ('REGULATORY_DOCUMENTS', 'Regulatory documents', 'Regulatory document refs on product', 'HEALTHCARE', 'AVAILABLE', '["catalog"]'::jsonb, '["PHARMACY","CLINIC","HOSPITAL"]'::jsonb),
  ('RESERVATIONS', 'Reservations', 'Table / resource reservations', 'RESTAURANT', 'EXPERIMENTAL', '["pos"]'::jsonb, '["RESTAURANT","CAFE","HOTEL"]'::jsonb),
  ('MODIFIERS', 'Modifiers', 'POS modifiers / options', 'RESTAURANT', 'EXPERIMENTAL', '["pos","catalog"]'::jsonb, '["RESTAURANT","CAFE"]'::jsonb),
  ('FOOD_COST', 'Food cost', 'Recipe food-cost analytics', 'RESTAURANT', 'EXPERIMENTAL', '["inventory","catalog"]'::jsonb, '["RESTAURANT","CAFE"]'::jsonb)
ON CONFLICT (code) DO NOTHING;

INSERT INTO capability_dependencies (capability_code, depends_on_code) VALUES
  ('PATIENT', 'CRM'),
  ('DISPENSING', 'PATIENT'),
  ('PHARMACIST_VALIDATION', 'DISPENSING'),
  ('QUARANTINE', 'INVENTORY'),
  ('QUALITY', 'INVENTORY'),
  ('SUBSTITUTION', 'INVENTORY'),
  ('GENERIC_PRODUCTS', 'INVENTORY'),
  ('RESERVATIONS', 'TABLES'),
  ('MODIFIERS', 'POS'),
  ('FOOD_COST', 'RECIPES')
ON CONFLICT DO NOTHING;

-- Light inheritance metadata (composition preferred over deep trees)
UPDATE business_profiles SET base_profile_code = 'HEALTHCARE_RETAIL', version = version + 1
WHERE code = 'PHARMACY' AND base_profile_code IS NULL;
UPDATE business_profiles SET base_profile_code = 'RETAIL_STORE', version = version + 1
WHERE code IN ('SUPERMARKET', 'GROCERY', 'BOUTIQUE') AND base_profile_code IS NULL;
UPDATE business_profiles SET base_profile_code = 'WHOLESALE', version = version + 1
WHERE code = 'DISTRIBUTION' AND base_profile_code IS NULL;
UPDATE business_profiles SET base_profile_code = 'RESTAURANT', version = version + 1
WHERE code = 'CAFE' AND base_profile_code IS NULL;

-- Enrich PHARMACY template (compose capabilities — no embedded business rules)
UPDATE business_profiles SET
  version = GREATEST(version, 2),
  default_capabilities = '[
    "INVENTORY","SALES","PURCHASING","POS","CRM","WAREHOUSE",
    "PATIENT","PRESCRIPTION","DISPENSING","INSURANCE",
    "LOT_TRACKING","SERIAL_TRACKING","EXPIRATION","FEFO","RECALL","QUARANTINE","QUALITY",
    "COLD_CHAIN","CONTROLLED_PRODUCTS","BARCODE",
    "PHARMACIST_VALIDATION","SUBSTITUTION","GENERIC_PRODUCTS","REGULATORY_DOCUMENTS","LOYALTY"
  ]'::jsonb,
  default_modules = '["inventory","sales","purchasing","pos","customer","catalog","pricing","pharmacy","loyalty","warehouse"]'::jsonb,
  default_features = '{
    "pharmacy.dispensing":true,
    "pharmacy.controlled_substances":true,
    "pharmacy.patient":true,
    "inventory.batch_tracking":true,
    "inventory.expiration":true,
    "inventory.recall":true,
    "inventory.quarantine":true,
    "enable_loyalty":true,
    "commerce.pos":true
  }'::jsonb,
  default_policy_bundle = '{
    "inventory":{
      "allowNegativeStock":false,
      "enableFefo":true,
      "requireLotForMedication":true,
      "requireExpirationForMedication":true,
      "quarantineReturns":true
    },
    "commercial":{
      "allocationStrategy":"FEFO",
      "defaultFulfillmentPolicy":"CANCEL",
      "reservationTimeoutMinutes":30,
      "enableLoyalty":true,
      "enableMobilePos":true
    }
  }'::jsonb,
  default_workflow_bindings = '[
    {"processCode":"SALES_ORDER","workflowTemplateCode":"SALES_APPROVAL_V1","workflowVersion":1},
    {"processCode":"PRESCRIPTION","workflowTemplateCode":"PRESCRIPTION_WORKFLOW_V1","workflowVersion":1},
    {"processCode":"INSURANCE_CLAIM","workflowTemplateCode":"INSURANCE_CLAIM_WORKFLOW_V1","workflowVersion":1}
  ]'::jsonb,
  default_pos_configuration = '{
    "schemaVersion":1,
    "enabledModes":["SCAN","PRODUCT","LOT","EXPIRY","PRESCRIPTION","INSURANCE","COPAY","PAYMENT"],
    "scannerMode":"BARCODE",
    "offlineMode":true,
    "customerCapture":true,
    "paymentMethods":["CASH","CARD","INSURANCE"],
    "receiptTemplate":"PHARMACY_DEFAULT",
    "discountRules":[],
    "tenders":[
      {"code":"CASH","label":"Cash","enabled":true},
      {"code":"CARD","label":"Card","enabled":true},
      {"code":"INSURANCE","label":"Insurance","enabled":true}
    ],
    "receipt":{"templateCode":"PHARMACY_DEFAULT","printOnSale":true,"emailCopy":false},
    "layout":{"columns":3,"quickKeys":["PRESCRIPTION","LOT","PAYMENT"]}
  }'::jsonb,
  default_ui_configuration = '{
    "schemaVersion":1,
    "navigation":["catalog","inventory","sales","pos","customers","purchasing","pharmacy"],
    "highlight":["prescription","controlled","cold_chain"],
    "density":"COMFORTABLE",
    "defaultLanding":"pos",
    "featureTiles":[
      {"code":"prescription","requiresCapability":"PRESCRIPTION"},
      {"code":"dispensing","requiresCapability":"DISPENSING"},
      {"code":"insurance","requiresCapability":"INSURANCE"},
      {"code":"recall","requiresCapability":"RECALL"}
    ],
    "forms":[{"code":"product_pharma","requiresCapability":"DISPENSING"}],
    "columns":[{"view":"products","fields":["lot","expiry","controlled"]}],
    "actions":[{"code":"validate_rx","requiresCapability":"PHARMACIST_VALIDATION"}]
  }'::jsonb,
  updated_at = NOW()
WHERE code = 'PHARMACY';

UPDATE business_profiles SET
  version = GREATEST(version, 2),
  default_capabilities = '[
    "INVENTORY","SALES","PURCHASING","POS","CRM","WAREHOUSE",
    "LOT_TRACKING","EXPIRATION","FEFO","BARCODE","WEIGHTED_PRODUCTS",
    "PROMOTIONS","LOYALTY","MULTI_STORE","DELIVERY"
  ]'::jsonb,
  default_pos_configuration = '{
    "schemaVersion":1,
    "enabledModes":["SCAN","PROMOTION","LOYALTY","WEIGHTED","PAYMENT"],
    "scannerMode":"BARCODE",
    "offlineMode":true,
    "customerCapture":true,
    "paymentMethods":["CASH","CARD"],
    "receiptTemplate":"SUPERMARKET_DEFAULT",
    "tenders":[
      {"code":"CASH","label":"Cash","enabled":true},
      {"code":"CARD","label":"Card","enabled":true}
    ],
    "layout":{"columns":4,"quickKeys":["WEIGHTED","LOYALTY","PAYMENT"]}
  }'::jsonb,
  default_ui_configuration = '{
    "schemaVersion":1,
    "navigation":["catalog","inventory","sales","pos","customers","promotions","purchasing"],
    "highlight":["promotions","loyalty","weighted"],
    "density":"COMPACT",
    "defaultLanding":"pos",
    "featureTiles":[
      {"code":"weighted","requiresCapability":"WEIGHTED_PRODUCTS"},
      {"code":"loyalty","requiresCapability":"LOYALTY"},
      {"code":"promotions","requiresCapability":"PROMOTIONS"}
    ]
  }'::jsonb,
  updated_at = NOW()
WHERE code = 'SUPERMARKET';

UPDATE business_profiles SET
  version = GREATEST(version, 2),
  default_capabilities = '[
    "INVENTORY","SALES","PURCHASING","POS","CRM",
    "RECIPES","INGREDIENTS","KITCHEN","TABLES","RESERVATIONS","MODIFIERS",
    "WASTE","FOOD_COST","LOT_TRACKING","EXPIRATION","FEFO","DELIVERY","BARCODE"
  ]'::jsonb,
  default_workflow_bindings = '[
    {"processCode":"SALES_ORDER","workflowTemplateCode":"SALES_APPROVAL_V1","workflowVersion":1},
    {"processCode":"RESTAURANT_ORDER","workflowTemplateCode":"RESTAURANT_ORDER_WORKFLOW_V1","workflowVersion":1}
  ]'::jsonb,
  default_pos_configuration = '{
    "schemaVersion":1,
    "enabledModes":["TABLE","ORDER","MODIFIER","KITCHEN","PAYMENT"],
    "scannerMode":"MANUAL",
    "offlineMode":true,
    "customerCapture":false,
    "paymentMethods":["CASH","CARD"],
    "receiptTemplate":"RESTAURANT_DEFAULT",
    "layout":{"columns":3,"quickKeys":["TABLE","MODIFIER","KITCHEN","PAYMENT"]}
  }'::jsonb,
  default_ui_configuration = '{
    "schemaVersion":1,
    "navigation":["pos","kitchen","inventory","purchasing","recipes","customers"],
    "highlight":["tables","kitchen","waste"],
    "defaultLanding":"pos",
    "featureTiles":[
      {"code":"tables","requiresCapability":"TABLES"},
      {"code":"kitchen","requiresCapability":"KITCHEN"},
      {"code":"recipes","requiresCapability":"RECIPES"}
    ]
  }'::jsonb,
  updated_at = NOW()
WHERE code = 'RESTAURANT';

UPDATE business_profiles SET
  version = GREATEST(version, 2),
  default_capabilities = '[
    "INVENTORY","SALES","PURCHASING","POS","CRM",
    "LOYALTY","PROMOTIONS","PRODUCT_VARIANTS","BARCODE","MULTI_STORE"
  ]'::jsonb,
  default_pos_configuration = '{
    "schemaVersion":1,
    "enabledModes":["SCAN","PAYMENT","LOYALTY","VARIANTS"],
    "scannerMode":"BARCODE",
    "offlineMode":true,
    "customerCapture":true,
    "paymentMethods":["CASH","CARD"],
    "receiptTemplate":"RETAIL_DEFAULT",
    "layout":{"columns":3,"quickKeys":["VARIANT","LOYALTY","PAYMENT"]}
  }'::jsonb,
  updated_at = NOW()
WHERE code = 'RETAIL_STORE';

UPDATE business_profiles SET
  version = GREATEST(version, 2),
  default_capabilities = '[
    "INVENTORY","SALES","PURCHASING","POS","CRM",
    "LOYALTY","PROMOTIONS","PRODUCT_VARIANTS","BARCODE"
  ]'::jsonb,
  default_pos_configuration = '{
    "schemaVersion":1,
    "enabledModes":["SCAN","PAYMENT","LOYALTY","VARIANTS"],
    "scannerMode":"BARCODE",
    "offlineMode":true,
    "customerCapture":true,
    "paymentMethods":["CASH","CARD"],
    "receiptTemplate":"RETAIL_DEFAULT",
    "layout":{"columns":3,"quickKeys":["VARIANT","LOYALTY","PAYMENT"]}
  }'::jsonb,
  updated_at = NOW()
WHERE code = 'BOUTIQUE';

UPDATE business_profiles SET
  version = GREATEST(version, 2),
  default_capabilities = '[
    "INVENTORY","SALES","PURCHASING","CRM","WAREHOUSE",
    "CREDIT","PRICE_LISTS","B2B","BULK","MULTI_STORE","DELIVERY"
  ]'::jsonb,
  default_workflow_bindings = '[
    {"processCode":"SALES_ORDER","workflowTemplateCode":"SALES_APPROVAL_V1","workflowVersion":1},
    {"processCode":"DELIVERY","workflowTemplateCode":"DELIVERY_WORKFLOW_V1","workflowVersion":1}
  ]'::jsonb,
  default_pos_configuration = '{
    "schemaVersion":1,
    "enabledModes":["ORDER","PAYMENT","CREDIT","BULK"],
    "scannerMode":"BARCODE",
    "offlineMode":false,
    "customerCapture":true,
    "paymentMethods":["TRANSFER","CARD","CREDIT"],
    "receiptTemplate":"WHOLESALE_INVOICE"
  }'::jsonb,
  default_ui_configuration = '{
    "schemaVersion":1,
    "navigation":["catalog","inventory","sales","customers","purchasing","pricing","fulfillment"],
    "highlight":["credit","price_lists","b2b"],
    "defaultLanding":"sales",
    "featureTiles":[
      {"code":"credit","requiresCapability":"CREDIT"},
      {"code":"price_lists","requiresCapability":"PRICE_LISTS"},
      {"code":"bulk","requiresCapability":"BULK"}
    ]
  }'::jsonb,
  updated_at = NOW()
WHERE code = 'WHOLESALE';

-- Ensure WAREHOUSE capability exists as alias-friendly module marker
INSERT INTO capability_definitions
  (code, name, description, category, status, required_modules, supported_verticals)
VALUES
  ('WAREHOUSE', 'Warehouse', 'Warehouse operations module surface', 'CORE', 'AVAILABLE', '["inventory"]'::jsonb, '["*"]'::jsonb)
ON CONFLICT (code) DO NOTHING;
