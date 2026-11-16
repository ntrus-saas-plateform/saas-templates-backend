# P10 — Document collection

## Objectif

Collecter des **références** documentaires liées à une application — pas de blob binaire dans P10.

## Tables

- `edge_p10_document_requirements` — code, type, required, `condition_rules`
- `edge_p10_document_references` — `storage_ref`, checksum, status (pas de credentials)
- `edge_p10_document_reviews` — ACCEPTED / REJECTED / NEEDS_RESUBMIT

## Use-cases

| Use-case | Comportement |
|----------|--------------|
| `CreateDocumentRequirementUseCase` | Crée exigence |
| `RegisterDocumentUploadUseCase` | Enregistre ref ; outbox **sans** storage key/URL dans payload |
| `ReviewDocumentUseCase` | Décision + transition status + SoD-friendly review |

## Transitions

`UPLOADED` → `PENDING_REVIEW` → `ACCEPTED` \| `REJECTED` (policy `assertDocumentTransition`).

## API

- `POST edge/acquisition/document-requirements`
- `POST edge/acquisition/documents`
- `POST edge/acquisition/documents/:id/review` (`documents:review`)

## Limites

- Pas d’upload multipart natif P10 — caller fournit `storageRef` (object store externe).
- Pas de scan antivirus / OCR dans ce module.
- FE upload UX **pending**.

## Statut

**BE core DONE.**
