-- Migration 120: Allow NOT_PROVIDED on edge_marketing_lead_consents.state
-- 077 CHECK only permitted GRANTED / WITHDRAWN / DENIED.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'edge_marketing_lead_consents_state_check'
      AND conrelid = 'edge_marketing_lead_consents'::regclass
  ) THEN
    ALTER TABLE edge_marketing_lead_consents
      DROP CONSTRAINT edge_marketing_lead_consents_state_check;
  ELSIF EXISTS (
    SELECT 1
    FROM pg_constraint c
    WHERE c.conrelid = 'edge_marketing_lead_consents'::regclass
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%state%'
  ) THEN
    EXECUTE (
      SELECT format('ALTER TABLE edge_marketing_lead_consents DROP CONSTRAINT %I', c.conname)
      FROM pg_constraint c
      WHERE c.conrelid = 'edge_marketing_lead_consents'::regclass
        AND c.contype = 'c'
        AND pg_get_constraintdef(c.oid) ILIKE '%state%'
      LIMIT 1
    );
  END IF;
END $$;

ALTER TABLE edge_marketing_lead_consents
  ADD CONSTRAINT edge_marketing_lead_consents_state_check
  CHECK (state IN ('GRANTED', 'WITHDRAWN', 'DENIED', 'NOT_PROVIDED'));

INSERT INTO schema_migrations (version) VALUES ('120_edge_marketing_consent_not_provided')
ON CONFLICT DO NOTHING;
