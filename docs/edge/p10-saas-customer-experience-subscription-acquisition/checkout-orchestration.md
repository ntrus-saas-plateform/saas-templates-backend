# P10 — Checkout orchestration

## Principe

P10 orchestre des **sessions** ; P6 exécute paiement / facturation. **Aucun stockage de carte.**

## Session

`edge_p10_checkout_sessions` :

- `idempotency_key` unique
- `billing_session_ref` = ref P6 (payment intent) seulement
- `metadata` scanné par `assertNoPaymentCredentials` (cardNumber, cvv, pan, clientSecret, …)

## Transitions

```
CREATED → AWAITING_PAYMENT → AUTHORIZED | CAPTURED | FAILED | …
CAPTURED → HANDOFF_READY → COMPLETED
```

## Use-cases

| Use-case | Rôle |
|----------|------|
| `CreateCheckoutSessionUseCase` | Idempotent create + outbox |
| `AttachPaymentReferenceUseCase` | Attache `paymentIntentRef` → AWAITING_PAYMENT |
| `RecordPaymentResultUseCase` | Accepte **uniquement** statuts P6 autoritatifs |
| `RevalidatePlanBeforeCheckoutUseCase` | Confirme plan P2 encore valide |

## Statuts P6 acceptés

`AUTHORIZED`, `CAPTURED`, `FAILED`, `CANCELLED`, `EXPIRED`, `AWAITING_PAYMENT`

## API

- `POST edge/acquisition/checkout`
- `POST …/checkout/:id/payment-reference`
- `POST …/checkout/:id/payment-result`
- `POST …/checkout/revalidate-plan`

## Statut

**BE orchestration DONE.** Pas d’iframe PSP / Elements dans P10. FE checkout **pending**.
