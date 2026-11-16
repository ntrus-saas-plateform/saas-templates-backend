# 12 — Analytics & attribution (remediation)

## Events

- `edge_p10_analytics_events` — `event_name`, soft refs, `properties` JSONB
- `stripSensitiveProperties` — password, card*, cvv, pan, secrets, document content
- `edge_p10_attribution_records` — channel, campaign, UTM, marketing soft-ref

## API

| Route | Auth |
|-------|------|
| `POST edge/acquisition/analytics/events` | `manage` |
| `GET edge/acquisition/analytics/funnel` | `analytics:read` |
| `POST …/public/analytics/events` | Public + throttle + limiter |

## Funnel / overview

`GetConversionFunnelUseCase` et overview counts = agrégats **réels** enregistrés — pas de taux inventés.

## Evidence

P10-S39 (strip secrets) Pass ; Playwright chemin proxy analytics autorisé.

## Statut

Ingest + funnel counts **DONE**. BI / dashboards avancés **deferred**.
