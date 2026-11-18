# 23 — RBAC Edge console matrix (beachhead)

Alignement FE gate ↔ BE `@RequireEdgePermissions` pour surfaces RGOM E7–E11.

| Surface | Permission FE/BE |
|---------|------------------|
| Subscriptions / associations | `platform:subscriptions:read` / `…:update` |
| Entitlements reconcile / drift | `platform:subscriptions:reconcile_entitlements` |
| Billing cash-truth / geo | `platform:billing:*` (read/manage per endpoint) |
| Dunning apply/notify | billing collections permissions existantes |
| Onboarding journeys | `platform:onboarding:read/start/advance/…` |
| CS aha / adoption | `platform:onboarding:read` + `advance` ingest |
| CS health / churn / expansion | `platform:subscriptions:read_analytics` |
| Revenue overview | `platform:revenue:read` (F-P11-010 — no business:read bypass) |
| Forecasts named | `platform:revenue:forecast` |
| Commission calc/approve | `platform:commission:calculate` / `approve` |
| Partner opportunity | `platform:sales:opportunities:read/create/update` |

## Mismatch policy

Auth specs `*.controller.auth.spec.ts` = preuve ; nouveau endpoint = spec + gate FE.
