# Edge console — routes OutOfScope

Handlers Nest **volontairement hors console** admin (pas de page UI attendue).

| Runtime path | Raison | Owner |
|---|---|---|
| `POST /api/v1/edge/product-controls/callbacks/:endpointId` | Ingress M2M Business Backend → Edge | BB / control plane |
| `POST /api/v1/edge/workflow-workers/**` | Workers internes claim/heartbeat/complete | Ops lab |
| `/api/v1/edge/workflow-workers/**` | Workers (tous verbes) | Ops lab |
| `POST /api/v1/edge/integrations/p5/provisioning/**` | Intégration M2M P5 | Provisioning |
| `/api/v1/edge/integrations/p5/provisioning/**` | Intégration M2M P5 (tous verbes) | Provisioning |
| `POST /api/v1/edge/billing/webhooks/payments` | Webhook provider paiement | Billing |
| `POST /api/v1/edge/marketing/deliveries/webhooks/**` | Webhooks delivery | Marketing |
| `/api/v1/edge/marketing/deliveries/webhooks/**` | Webhooks delivery (tous verbes) | Marketing |
| `GET/POST /api/v1/edge/live-complete/status` | Lab status (badge éventuel, pas CRUD) | Lab |
| `/api/v1/edge/acquisition/public/**` | Surface publique CX (hors console admin) — pages `(acquisition-public)` | Acquisition |

Mettre à jour ce fichier dès qu’un handler est exclu de l’UI. Scripts : `npm run edge:routes:diff` / `edge:routes:check`.
