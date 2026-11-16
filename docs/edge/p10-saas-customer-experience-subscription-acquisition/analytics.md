# P10 — Analytics & attribution

## Events

`edge_p10_analytics_events` — `event_name`, soft refs prospect/lead/application, `properties` JSONB  
Strip sensibles : password, card*, cvv, pan, document content, secrets (`stripSensitiveProperties`).

`edge_p10_attribution_records` — channel, campaign, utm, marketing soft-ref.

## API

| Route | Auth |
|-------|------|
| `POST edge/acquisition/analytics/events` | `manage` |
| `GET edge/acquisition/analytics/funnel` | `analytics:read` |
| `POST edge/acquisition/public/analytics/events` | Public + throttle |

## Funnel

`GetConversionFunnelUseCase` compte les events enregistrés uniquement — **pas** de taux de conversion estimé inventé.

## Overview

`getAcquisitionOverviewCounts` — agrégats DB réels.

## Statut

**Ingest + counts DONE.** BI externe / dashboards FE **pending**.
