# P10 — Customer journey

## Agrégats

- `edge_p10_journey_definitions` — `definition` JSONB
- `edge_p10_journey_instances` — step courant + context
- `edge_p10_journey_events` — append-only

## Use-cases

| Use-case | API |
|----------|-----|
| `GetOrCreateJourneyInstanceUseCase` | (application layer ; start via repo) |
| `GetJourneyByApplicationUseCase` | `GET edge/acquisition/journeys/:applicationId` |
| `AdvanceJourneyUseCase` | `POST edge/acquisition/journeys/:id/advance` (`governance:manage`) |

Events : `edge.p10.journey.started`, `edge.p10.journey.step.advanced`.

## Limites

- Pas de moteur BPMN / timers / wait-states
- Definitions CRUD API console limitée (pas de full designer)
- FE journey builder **pending**

## Statut

**Core instance advance DONE.**
