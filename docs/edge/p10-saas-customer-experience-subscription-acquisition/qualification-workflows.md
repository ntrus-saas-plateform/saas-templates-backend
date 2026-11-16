# P10 — Qualification workflows

## Objectif

Décider si une application peut avancer vers checkout / handoff, avec séparation des devoirs.

## Agrégats

- `QualificationRecord` — un par application (`uq_edge_p10_qualification_application`)
- `ReviewAssignment` — REVIEWER / APPROVER / DOCUMENT_REVIEWER / QUALIFIER

## Transitions

```
PENDING → IN_PROGRESS → APPROVED | REJECTED | CONDITIONAL
CONDITIONAL → APPROVED | REJECTED | WITHDRAWN
```

## Use-cases

| Use-case | Permission typique |
|----------|-------------------|
| `StartQualificationUseCase` | `review` |
| `DecideQualificationUseCase` | `approve` |
| `assertSeparationOfDuties` | disponible en policy (self-approve interdit quand appelé) |

## API

- `POST edge/acquisition/qualification/start`
- `POST edge/acquisition/qualification/:id/decide`

## Statut

**BE core DONE.**  
Pas de file d’attente SLA / auto-assign intelligent / UI review queue FE.
