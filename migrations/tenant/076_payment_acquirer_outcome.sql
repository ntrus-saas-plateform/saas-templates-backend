-- Records whether an acquirer was contacted and whether its response approved the tender.
-- acquirer_approved stays false unless the outcome is ACQUIRER_APPROVED.

ALTER TABLE commercial_payments
  ADD COLUMN IF NOT EXISTS acquirer_contacted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS acquirer_approved boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS acquirer_outcome text NOT NULL DEFAULT 'NOT_REQUIRED';

ALTER TABLE commercial_payments DROP CONSTRAINT IF EXISTS commercial_payments_acquirer_outcome_check;
ALTER TABLE commercial_payments
  ADD CONSTRAINT commercial_payments_acquirer_outcome_check
  CHECK (acquirer_outcome IN (
    'NOT_REQUIRED',
    'EXTERNAL_REFERENCE_ONLY',
    'ACQUIRER_APPROVED',
    'ACQUIRER_DECLINED',
    'ACQUIRER_UNREACHABLE'
  ));

ALTER TABLE commercial_payments DROP CONSTRAINT IF EXISTS commercial_payments_acquirer_approved_check;
ALTER TABLE commercial_payments
  ADD CONSTRAINT commercial_payments_acquirer_approved_check
  CHECK (acquirer_approved = false OR acquirer_outcome = 'ACQUIRER_APPROVED');

INSERT INTO schema_migrations (version) VALUES ('076_payment_acquirer_outcome')
ON CONFLICT DO NOTHING;
