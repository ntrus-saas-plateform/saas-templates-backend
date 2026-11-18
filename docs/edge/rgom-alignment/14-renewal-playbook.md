# 14 — Renewal playbook pré-échéance

**Statut :** ACTIVE — RGOM-E9.3  
**Objectif :** Renouveler sans silent entitlement change ; lier health + delinquency + Aha.

## Fenêtre

| Jours avant échéance | Action |
|----------------------|--------|
| J-45 | Health score + Aha completion + churn risk |
| J-30 | Offre renewal (P5 renewals OFFERED) si health MID/HIGH et non delinquent |
| J-14 | High-touch si health LOW / churn HIGH|CRITICAL |
| J-7 | Collections first si PAST_DUE / SUSPENDED — pas de save offer tant que billing non résolu |
| J0 | Confirm renewal commercial → pas de bump modules |

## Inputs API

- `POST /edge/cs/health-score`
- `GET /edge/cs/adoption-events?subscriptionId=`
- `POST /edge/cs/churn-risk`
- `GET /edge/revenue/renewals/intelligence` (P11 read-only)
- Subscription renewals P5 (`POST .../renewals`, `.../confirm`)

## Règles

1. Delinquency / suspension → collections avant retention.
2. Expansion detected at renewal → quote / plan change, never silent grant.
3. UNAVAILABLE health ≠ score 0 — documenter PARTIAL.
