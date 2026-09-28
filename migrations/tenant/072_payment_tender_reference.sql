-- External tender reference is stored. This does not approve the payment with an acquirer.

ALTER TABLE commercial_payments
  ADD COLUMN IF NOT EXISTS external_reference text;

ALTER TABLE commercial_payments DROP CONSTRAINT IF EXISTS commercial_payments_method_check;

ALTER TABLE commercial_payments
  ADD CONSTRAINT commercial_payments_method_check
  CHECK (method IN (
    'CASH', 'CARD', 'MOBILE_MONEY', 'BANK_TRANSFER', 'WALLET', 'CREDIT', 'MIXED',
    'TERMINAL', 'ONLINE', 'STORE_CREDIT'
  ));

INSERT INTO schema_migrations (version) VALUES ('072_payment_tender_reference')
ON CONFLICT DO NOTHING;
