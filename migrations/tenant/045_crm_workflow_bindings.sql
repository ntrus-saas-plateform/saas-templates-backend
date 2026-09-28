-- Migration 045: CRM workflow bindings on profiles that already include CRM

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
    SELECT '{"processCode":"LEAD","workflowTemplateCode":"LEAD_QUALIFICATION_V1","workflowVersion":1}'::jsonb
    UNION ALL
    SELECT '{"processCode":"OPPORTUNITY","workflowTemplateCode":"OPPORTUNITY_APPROVAL_V1","workflowVersion":1}'::jsonb
    UNION ALL
    SELECT '{"processCode":"CUSTOMER_MERGE","workflowTemplateCode":"CUSTOMER_MERGE_V1","workflowVersion":1}'::jsonb
    UNION ALL
    SELECT '{"processCode":"CAMPAIGN","workflowTemplateCode":"CAMPAIGN_LAUNCH_V1","workflowVersion":1}'::jsonb
  ) x
),
updated_at = NOW()
WHERE default_capabilities @> '["CRM"]'::jsonb
   OR default_modules @> '["customer"]'::jsonb;

INSERT INTO schema_migrations (version) VALUES ('045_crm_workflow_bindings')
ON CONFLICT DO NOTHING;
