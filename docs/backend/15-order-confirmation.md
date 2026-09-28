# Backend spec — Order confirmation (Screen 15)

"Commande confirmée !" — the post-checkout receipt. Shown via `router.replace` right
after the cart's "Valider la commande" (`/order-confirmed?id={orderId}`, a full-screen
route with **no back to the cart**). Success badge, itemized receipt with the
insurance breakdown, a pickup estimate, then "Suivre ma commande" / "Retour à l'accueil".

> **Provisional** — part of the Commander/ordering flow Edgar will rework
> ([[commander-future-changes]]). "Suivre ma commande" currently routes to Home (the
> `ActiveOrderCard` surfaces the order); it will point at the dedicated order-tracking
> screen once that exists.

Client is **mock-first**: `src/features/orders/api/ordersApi.ts` (`USE_MOCK`).
View-model: `OrderConfirmation` in `src/features/orders/types.ts` (added alongside the
legacy `Order`/`OrderItem` DTOs used by `services/endpoints/orders.ts`).

All responses use the envelope `{ data, message, success }` (see `src/types/api.ts`).

---

## GET `/orders/{orderId}/confirmation`

Requires auth. Returns the receipt view for a just-created order: its lines, the
dispensing-fee breakdown, the insurance coverage applied, and the pickup ETA. Derived
server-side from the `Order` + its `InsuranceEvaluation`.

**200 Response `data`** (`OrderConfirmation`)
```jsonc
{
  "id": "CMD-2026-0542",
  "pharmacyName": "Pharmacie du Centre",
  "status": "preparing",           // OrderStatus (domain): placed|preparing|ready|pickedup|cancelled
  "lines": [
    { "id": "trt_1", "quantity": 2, "name": "Doliprane 1000mg", "lineTotal": 4.36 }
    // …
  ],
  "dispensingFee": 2.04,           // "Honoraires de dispensation"
  "dispensingFeeNote": "1,02€ × 2 boîtes sur ordonnance · pris en charge à 70%",
  "subtotalWithFees": 15.62,       // sous-total + honoraires
  "insurer": "Harmonie",
  "covered": 10.87,                // insurer share (shown as −10.87€)
  "balanceDue": 4.75               // "Reste à payer"
}
```
(plus `etaMinutes: 30` for the pickup estimate.)

**Consistency note:** unlike the cart screen's mockup, these figures reconcile
(`subtotalWithFees − covered = balanceDue`, i.e. `15.62 − 10.87 = 4.75`). The server
is the source of truth for `covered`/`balanceDue` (molecule reimbursement × mutuelle
contract), so the client just renders them.

---

## Relationship to checkout

This screen assumes the order already exists — checkout (`POST /cart/checkout`, see
[[13-cart]] `docs/backend/13-cart.md`) returns the `orderId`, and the client
`router.replace`s here with it. The cart is cleared client-side on validate.

## Rejections

| code | when |
|---|---|
| 401 | not authenticated |
| 403 | order belongs to another profile/tenant |
| 404 | unknown order id |
