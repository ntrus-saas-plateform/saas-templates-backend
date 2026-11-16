# P10 — Communications

## Modèle

`edge_p10_communications` — channel EMAIL | SMS | WHATSAPP | IN_APP | WEBHOOK | OTHER  
Statuts : QUEUED → SENT → ACCEPTED → DELIVERED | FAILED | CANCELLED

## Use-cases

- `QueueAcquisitionCommunicationUseCase` — crée QUEUED + outbox `edge.p10.communication.queued`
- `MarkCommunicationStatusUseCase` — met à jour statut / `providerRef`

## API

- `POST edge/acquisition/communications`
- `PATCH edge/acquisition/communications/:id/status`

## Limites honnêtes

- **Pas** d’envoi SMTP/SMS réel dans P10 — queue + tracking seulement
- Delivery = statut poussé par adapter externe
- Templates = `template_ref` string, pas de moteur template

## Statut

**Tracking queue DONE ; delivery adapters NOT STARTED.**
