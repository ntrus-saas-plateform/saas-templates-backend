-- H-04: seed capability conflicts (validator path was dead without rows)
INSERT INTO capability_definitions
  (code, name, description, category, status, required_modules, supported_verticals)
VALUES
  ('ALLOW_NEGATIVE_STOCK', 'Allow negative stock', 'Conflicts with FEFO-safe operations', 'INVENTORY', 'AVAILABLE', '["inventory"]'::jsonb, '["RETAIL_STORE","SUPERMARKET","GROCERY","WHOLESALE","BOUTIQUE"]'::jsonb)
ON CONFLICT (code) DO NOTHING;

INSERT INTO capability_conflicts (capability_code, conflicts_with_code) VALUES
  ('ALLOW_NEGATIVE_STOCK', 'FEFO'),
  ('FEFO', 'ALLOW_NEGATIVE_STOCK'),
  ('WEIGHTED_PRODUCTS', 'PRESCRIPTION'),
  ('PRESCRIPTION', 'WEIGHTED_PRODUCTS'),
  ('KITCHEN', 'DISPENSING'),
  ('DISPENSING', 'KITCHEN')
ON CONFLICT DO NOTHING;
