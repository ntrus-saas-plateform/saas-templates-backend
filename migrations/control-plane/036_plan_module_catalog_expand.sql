-- Migration 036: Expand plan module catalog for product surface areas

WITH p AS (SELECT id, code FROM plans)
INSERT INTO plan_modules (plan_id, module_key, enabled)
SELECT p.id, m.module_key, m.enabled
FROM p
CROSS JOIN LATERAL (
  VALUES
    ('core', true),
    ('inventory', CASE WHEN p.code IN ('STANDARD', 'ENTERPRISE') THEN true ELSE false END),
    ('sales', CASE WHEN p.code IN ('STANDARD', 'ENTERPRISE') THEN true ELSE false END),
    ('purchasing', CASE WHEN p.code IN ('STANDARD', 'ENTERPRISE') THEN true ELSE false END),
    ('crm', CASE WHEN p.code IN ('STANDARD', 'ENTERPRISE') THEN true ELSE false END),
    ('pos', CASE WHEN p.code IN ('STANDARD', 'ENTERPRISE') THEN true ELSE false END),
    ('accounting', CASE WHEN p.code = 'ENTERPRISE' THEN true ELSE false END),
    ('hr', CASE WHEN p.code = 'ENTERPRISE' THEN true ELSE false END),
    ('payroll', CASE WHEN p.code = 'ENTERPRISE' THEN true ELSE false END),
    ('supply_chain', CASE WHEN p.code = 'ENTERPRISE' THEN true ELSE false END),
    ('reporting', CASE WHEN p.code IN ('STANDARD', 'ENTERPRISE') THEN true ELSE false END),
    ('analytics', CASE WHEN p.code = 'ENTERPRISE' THEN true ELSE false END),
    ('documents', CASE WHEN p.code IN ('STANDARD', 'ENTERPRISE') THEN true ELSE false END),
    ('workflow', CASE WHEN p.code = 'ENTERPRISE' THEN true ELSE false END)
) AS m(module_key, enabled)
ON CONFLICT (plan_id, module_key) DO NOTHING;

INSERT INTO schema_migrations (version) VALUES ('036_plan_module_catalog_expand') ON CONFLICT DO NOTHING;
