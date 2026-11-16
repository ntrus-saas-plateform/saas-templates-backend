-- Migration 121: Expand edge_p10_applications.status CHECK for P10 mandate statuses
-- while keeping legacy values (IN_REVIEW, DOCUMENTS_PENDING, APPROVED, CHECKOUT_READY, COMPLETED).

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'edge_p10_applications_status_check'
      AND conrelid = 'edge_p10_applications'::regclass
  ) THEN
    ALTER TABLE edge_p10_applications
      DROP CONSTRAINT edge_p10_applications_status_check;
  ELSIF EXISTS (
    SELECT 1
    FROM pg_constraint c
    WHERE c.conrelid = 'edge_p10_applications'::regclass
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%status%'
      AND pg_get_constraintdef(c.oid) ILIKE '%SUBMITTED%'
  ) THEN
    EXECUTE (
      SELECT format('ALTER TABLE edge_p10_applications DROP CONSTRAINT %I', c.conname)
      FROM pg_constraint c
      WHERE c.conrelid = 'edge_p10_applications'::regclass
        AND c.contype = 'c'
        AND pg_get_constraintdef(c.oid) ILIKE '%status%'
        AND pg_get_constraintdef(c.oid) ILIKE '%SUBMITTED%'
      LIMIT 1
    );
  END IF;
END $$;

ALTER TABLE edge_p10_applications
  ADD CONSTRAINT edge_p10_applications_status_check
  CHECK (status IN (
    -- Mandate statuses
    'DRAFT',
    'SUBMITTED',
    'UNDER_REVIEW',
    'INFORMATION_REQUIRED',
    'INFORMATION_RECEIVED',
    'QUALIFIED',
    'DISQUALIFIED',
    'QUOTATION_PENDING',
    'QUOTATION_ISSUED',
    'ACCEPTED',
    'REJECTED',
    'CHECKOUT_PENDING',
    'CONVERTED',
    'EXPIRED',
    'WITHDRAWN',
    -- Legacy / backward-compatible statuses
    'IN_REVIEW',
    'DOCUMENTS_PENDING',
    'QUALIFICATION_PENDING',
    'APPROVED',
    'CHECKOUT_READY',
    'COMPLETED'
  ));

INSERT INTO schema_migrations (version) VALUES ('121_edge_p10_application_status_expansion')
ON CONFLICT DO NOTHING;
