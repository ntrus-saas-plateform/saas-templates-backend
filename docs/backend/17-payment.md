# Backend spec — Payment method (Screen 17)

"Mode de paiement" — pick how to settle an order's outstanding balance. A full-screen
route (`/payment?id={orderId}`) that slots into the flow **cart → payment →
confirmation** (the cart's "Valider la commande" now pushes here; "Confirmer le
paiement" `router.replace`s to the confirmation).

> **Provisional** — part of the Commander/ordering flow Edgar will rework
> ([[commander-future-changes]]). Only cash (pay-at-pickup) and third-party insurance
> are live in the mock; Mobile Money and card are "Bientôt" (disabled).

Client is **mock-first**: `src/features/payment/api/paymentApi.ts` (`USE_MOCK`).
View-model: `src/features/payment/types.ts`. Method **labels/icons are client-side**
(i18n `payment.*`); the API only returns availability + amount.

All responses use the envelope `{ data, message, success }` (see `src/types/api.ts`).

---

## GET `/orders/{orderId}/payment`

Requires auth. Returns the amount due and which methods are available for this order.

**200 Response `data`** (`PaymentContext`)
```jsonc
{
  "orderId": "CMD-2026-0542",
  "pharmacyName": "Pharmacie du Centre",
  "amountDue": 4.75,
  "methods": [
    { "id": "cash",      "enabled": true,  "badge": "recommended" },
    { "id": "mobile",    "enabled": false, "badge": "soon" },
    { "id": "insurance", "enabled": true },
    { "id": "card",      "enabled": false, "badge": "soon" }
  ],
  "defaultMethod": "cash"
}
```
`id` ∈ `cash | mobile | insurance | card`; `badge` ∈ `recommended | soon`.

## POST `/orders/{orderId}/payment`

Confirm the chosen method. Body `{ "method": "cash" }`.

**200 Response `data`** (`ConfirmPaymentResult`)
```jsonc
{ "orderId": "CMD-2026-0542", "paid": false }
```
`paid` is `false` for cash (settled at pickup) — the order proceeds to preparation
either way. For online methods (later) this initiates/settles the charge and returns
`paid: true` (or a payment-intent to complete client-side).

## Rejections

| code | when |
|---|---|
| 401 | not authenticated |
| 404 | unknown order id |
| 409 | order already paid / not payable |
| 422 | method not available for this order |
