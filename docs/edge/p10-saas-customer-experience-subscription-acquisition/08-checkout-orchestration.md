# 08 — Checkout orchestration (remediation)

## Principe

P10 orchestre des **sessions** ; P6 exécute paiement. **Aucun champ / colonne credentials carte.**

## Transitions

```
CREATED → AWAITING_PAYMENT → AUTHORIZED | CAPTURED | FAILED | …
CAPTURED → HANDOFF_READY → COMPLETED
```

## Use-cases

| Use-case | Rôle |
|----------|------|
| `CreateCheckoutSessionUseCase` | Idempotent (`edge_p10_idempotency_keys`) |
| `RevalidatePlanBeforeCheckoutUseCase` | Confirme termes P2 |
| `AttachPaymentReferenceUseCase` | Attache `paymentIntentRef` |
| `RecordPaymentResultUseCase` | Statuts P6 autoritatifs seulement |
| **`InitiateAcquisitionPaymentUseCase`** | Crée intent P6 (`CreatePaymentIntentUseCase`) puis attache ref — **ne marque jamais paid** même si provider `SUCCEEDED` |

## API

`POST edge/acquisition/checkout` · `…/payment-reference` · `…/payment-result` · `checkout/revalidate-plan` · initiate payment (DTO `InitiateAcquisitionPaymentDto`)  
Public : status checkout sans carte (`/acquire/checkout/:id`).

## Statut

Orchestration + initiate P6 **DONE**. Webhooks P6 push / reconciliation auto **deferred**.
