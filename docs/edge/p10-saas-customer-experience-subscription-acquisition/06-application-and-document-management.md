# 06 — Application & document management (remediation)

## Applications

Statuts : `DRAFT` → `SUBMITTED` → `IN_REVIEW` → (`DOCUMENTS_PENDING` | `QUALIFICATION_PENDING`) → `APPROVED` → `CHECKOUT_READY` → `COMPLETED` (+ `REJECTED|WITHDRAWN|EXPIRED`).

Use-cases : Create draft · Save answers (`assertFormAnswersValid`) · Submit · Transition review · Request missing information.

## Documents

| Capacité | Implémentation |
|----------|----------------|
| Register upload | Locator privé ; payload outbox **sans** URL storage |
| Storage FS | `ACQUISITION_PRIVATE_STORAGE_ROOT` (défaut `.data/acquisition-private`) |
| Storage S3 | `ACQUISITION_S3_BUCKET` + AWS region/credentials |
| Mode pending | `ACQUISITION_STORAGE_MODE=pending` → metadata-only |
| Malware scan | ClamAV si `CLAMAV_HOST`+`CLAMAV_PORT` ; sinon `mock_*` / `SCAN_UNAVAILABLE` |
| Infected | Quarantine / WITHDRAWN — **jamais** traité CLEAN sans scan réussi |
| Review | `ReviewDocument` ACCEPTED / reject ; SoD reviewer |

## Limites

Env live Edge+ClamAV+S3 **non smoke** dans evidence pack. Upload binaire out-of-band : register valide markers FS / metadata S3 Put.

## Statut

Lifecycle + storage adapters **DONE** ; certification env réel **deferred**.
