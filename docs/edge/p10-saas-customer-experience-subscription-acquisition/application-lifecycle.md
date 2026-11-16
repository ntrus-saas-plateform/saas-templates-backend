# P10 — Application lifecycle

## Agrégat

`edge_p10_applications` + answers + events append-only.

## Statuts

`DRAFT` → `SUBMITTED` → `IN_REVIEW` → (`DOCUMENTS_PENDING` | `QUALIFICATION_PENDING`) → `APPROVED` → `CHECKOUT_READY` → `COMPLETED`  
Alternatives : `REJECTED` | `WITHDRAWN` | `EXPIRED`

Transitions appliquées via `assertApplicationTransition`.

## Use-cases

| Use-case | Effet |
|----------|-------|
| `CreateApplicationDraftUseCase` | Draft lié prospect + form version |
| `SaveApplicationAnswersUseCase` | Valide schema + upsert answers |
| `SubmitApplicationUseCase` | DRAFT → SUBMITTED + outbox |
| `TransitionApplicationReviewUseCase` | Transitions review |
| `RequestMissingInformationUseCase` | Vers `DOCUMENTS_PENDING` |

## API

- `GET/POST edge/acquisition/applications`
- `POST …/:id/answers`
- `POST …/:id/submit`
- `POST …/:id/transition`
- `POST …/:id/request-information`

## Statut

**BE lifecycle core DONE.** Portail candidat FE `/acquire` **pending**.
