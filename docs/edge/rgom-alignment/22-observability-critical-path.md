# 22 — Observability chemin critique (E12 beachhead)

## Metrics (minimum)

| Signal | Source | Alert |
|--------|--------|-------|
| Entitlement publish failures | Edge logs / outbox | >0 on paid→ready |
| Drift scan dirty count | `entitlements/drift-scan` | >0 unresolved 24h |
| Dunning PAST_DUE / SUSPEND | billing collections | spike vs baseline |
| Payment confirm SUCCEEDED rate | billing intents | drop |
| Cash compute UNAVAILABLE ratio | P11 cash engine | unexplained rise |
| Adoption ingest errors | `/edge/cs/adoption-events` | unknown codes |

## Logs

CorrelationId sur provision, publish, billing confirm, dunning, CS ingest.

## Dashboards

Revenue Overview (honest) + Billing cash-truth + CS health — pas de totaux inventés.
