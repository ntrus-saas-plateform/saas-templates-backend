# P10 — Intégration P6 (billing / payment)

## Règle d’or

P6 est l’autorité paiement / facturation. P10 ne stocke que des **références** (`billing_session_ref` / `paymentIntentRef`) et des **statuts P6** autoritatifs.

## Points d’intégration

| Action P10 | Donnée échangée |
|------------|-----------------|
| Attach payment reference | `paymentIntentRef` → `billing_session_ref` |
| Record payment result | `p6Status` ∈ set autorisé |
| Checkout events | `external_ref` optionnel |

## Interdits (enforcés)

`assertNoPaymentCredentials` refuse metadata contenant : cardNumber, cvv/cvc, pan, paymentToken, password, secret, clientSecret, …

Migration 117 : commentaire SQL explicite — **pas** de colonnes credentials.

## Non livré

- Adapter HTTP live vers APIs billing P6
- Webhooks P6 → P10 (caller pousse `payment-result`)
- Retry / reconciliation billing automatique

## Statut

**Refs-only contract DONE.** Adapter runtime P6 **pending / external**.
