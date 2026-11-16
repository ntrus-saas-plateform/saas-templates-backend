# 11 — Customer communications (remediation)

## Modèle

`edge_p10_communications` — channels `EMAIL|SMS|WHATSAPP|IN_APP|WEBHOOK|OTHER`  
Statuts : `QUEUED` → `SENT` → `ACCEPTED` → `DELIVERED|FAILED|CANCELLED`

## Use-cases / API

- `QueueAcquisitionCommunicationUseCase` — QUEUED + outbox `edge.p10.communication.queued`
- `MarkCommunicationStatusUseCase` — statut / `providerRef`
- `POST/PATCH edge/acquisition/communications`
- Adapter notification : enqueue dispatch ≠ revendiquer `DELIVERED`

## Limites

Pas d’envoi SMTP/SMS réel dans P10 ; templates = `template_ref` string ; delivery = adapter externe.

## Statut

Queue + tracking **DONE** ; delivery adapters prod **deferred**.
