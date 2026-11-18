-- RGOM-E8.3 — Geo payment methods beachhead catalog (policy seed).
-- Declarative availability for WAEMU Mobile Money + card/transfer; not PSP live proof.

INSERT INTO edge_billing_policies (code, policy_type, rules, status)
VALUES (
  'GEO_PAYMENT_BEACHHEAD',
  'PAYMENT',
  '{
    "beachhead": "syntix-waemu",
    "markets": ["CI", "SN", "BJ", "TG", "BF", "ML", "NE", "GW"],
    "currencies": ["XOF", "USD", "EUR"],
    "methods": [
      "CARD",
      "BANK_TRANSFER",
      "MOBILE_MONEY:MTN",
      "MOBILE_MONEY:ORANGE",
      "MOBILE_MONEY:WAVE",
      "MOBILE_MONEY:MOOV",
      "MANUAL"
    ],
    "source": "domain/geo-payment-methods.ts"
  }'::jsonb,
  'ACTIVE'
)
ON CONFLICT (code) DO UPDATE SET
  rules = EXCLUDED.rules,
  status = 'ACTIVE',
  updated_at = NOW();

INSERT INTO schema_migrations (version) VALUES ('129_edge_geo_payment_methods_beachhead')
ON CONFLICT DO NOTHING;
