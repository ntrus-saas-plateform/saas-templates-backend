-- RGOM-E7.6 / E8.4 — Expand DUNNING_DEFAULT rules for grace / restriction / suspend / reactivate.
-- Legacy keys (graceDays, maxRetries) preserved; new keys are additive.

UPDATE edge_billing_policies
SET
  rules = COALESCE(rules, '{}'::jsonb) || jsonb_build_object(
    'graceDays', COALESCE((rules->>'graceDays')::int, 7),
    'maxRetries', COALESCE((rules->>'maxRetries')::int, 3),
    'restrictDuringGrace', COALESCE((rules->>'restrictDuringGrace')::boolean, true),
    'suspendAfterGrace', COALESCE((rules->>'suspendAfterGrace')::boolean, true),
    'suspendOnEscalate', COALESCE((rules->>'suspendOnEscalate')::boolean, true),
    'reactivateOnResolve', COALESCE((rules->>'reactivateOnResolve')::boolean, true),
    'restrictionMode', COALESCE(rules->>'restrictionMode', 'PAST_DUE')
  ),
  updated_at = NOW()
WHERE code = 'DUNNING_DEFAULT';

INSERT INTO edge_billing_policies (code, policy_type, rules, status)
VALUES (
  'DUNNING_DEFAULT',
  'DUNNING',
  '{
    "graceDays": 7,
    "maxRetries": 3,
    "restrictDuringGrace": true,
    "suspendAfterGrace": true,
    "suspendOnEscalate": true,
    "reactivateOnResolve": true,
    "restrictionMode": "PAST_DUE"
  }'::jsonb,
  'ACTIVE'
)
ON CONFLICT (code) DO NOTHING;

INSERT INTO schema_migrations (version) VALUES ('128_edge_dunning_policy_lifecycle_rules')
ON CONFLICT DO NOTHING;
