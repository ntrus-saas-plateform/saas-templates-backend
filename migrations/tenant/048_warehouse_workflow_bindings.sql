-- Migration 048: Warehouse workflow bindings for profiles with WAREHOUSE / INVENTORY

UPDATE business_profiles
SET default_workflow_bindings = (
  SELECT COALESCE(jsonb_agg(DISTINCT b), '[]'::jsonb)
  FROM (
    SELECT jsonb_array_elements(
      CASE
        WHEN jsonb_typeof(default_workflow_bindings) = 'array' THEN default_workflow_bindings
        ELSE '[]'::jsonb
      END
    ) AS b
    UNION ALL
    SELECT '{"processCode":"RECEIVING","workflowTemplateCode":"WAREHOUSE_RECEIVING_V1","workflowVersion":1}'::jsonb
    UNION ALL
    SELECT '{"processCode":"PUTAWAY","workflowTemplateCode":"WAREHOUSE_PUTAWAY_V1","workflowVersion":1}'::jsonb
    UNION ALL
    SELECT '{"processCode":"WAVE","workflowTemplateCode":"WAREHOUSE_WAVE_V1","workflowVersion":1}'::jsonb
    UNION ALL
    SELECT '{"processCode":"SHIPMENT","workflowTemplateCode":"WAREHOUSE_SHIPMENT_V1","workflowVersion":1}'::jsonb
  ) x
),
updated_at = NOW()
WHERE default_capabilities @> '["WAREHOUSE"]'::jsonb
   OR default_capabilities @> '["INVENTORY"]'::jsonb
   OR default_modules @> '["inventory"]'::jsonb;

INSERT INTO schema_migrations (version) VALUES ('048_warehouse_workflow_bindings')
ON CONFLICT DO NOTHING;
