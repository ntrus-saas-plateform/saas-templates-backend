# 18 — P5–P9 integration contracts (remediation)

## P5 — Subscription / entitlement

| Contrat | État |
|---------|------|
| `RequestSubscriptionHandoffUseCase` → row `REQUESTED` + outbox `edge.p10.subscription.handoff.requested` | **DONE** |
| `P10SubscriptionHandoffHandler` → `CreateSubscriptionUseCase` + `CompleteSubscriptionHandoffUseCase` (idempotent, fail-closed) | **DONE** |
| P5 reste SoT entitlement / seats | **Respecté** |
| Ownership provisioning / fake CONVERTED | **Interdit** |

## P6 — Billing / payment

| Contrat | État |
|---------|------|
| Refs only (`billing_session_ref` / paymentIntentRef) | **DONE** |
| `InitiateAcquisitionPaymentUseCase` crée intent puis attache ref ; **jamais** paid sur provider SUCCEEDED | **DONE** |
| `RecordPaymentResultUseCase` = transitions autoritatives | **DONE** |
| Webhooks P6 → P10 auto / reconciliation | **Deferred** |

## P7 / P8 — IAM / tenant

- P10 **n’écrit pas** IAM tenant ni registry  
- Portal : `provisioningComplete: false` toujours jusqu’à signal autoritatif externe  
- Pas d’activation Keycloak depuis acquisition

## P9 — Operations

- Indépendant ; pas de couplage fonctionnel acquisition  
- Mig 118 peut coexister dans la chaîne control-plane

## Marketing (adjacent)

- Forms campagnes ≠ form engine P10  
- **Consent partagé** via `domain/marketing/marketing-consent.ts` (P0)

## Statut

Contrats d’intégration core **implémentés et testés** (scénarios S27–S36, unit initiate/handoff). Certification E2E multi-phase live **hors ce package**.
