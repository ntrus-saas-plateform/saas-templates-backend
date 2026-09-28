# Backend spec — Mon panier / cart (Screen 13)

The review-and-checkout basket, reached from the catalog's floating `CartBar`
(`/cart`, a full-screen route that covers the tab bar). It shows the fulfilling
pharmacy, each line with its visual tile + quantity, the member's insurance
coverage, and the fee breakdown, ending in "Valider la commande".

> **Provisional.** The ordering/Commander flow (catalog → choose-pharmacy → cart)
> is a first pass and will be reworked — see [[commander-future-changes]]. The
> client cart is currently split between a lightweight zustand store
> (`src/store/cartStore.ts`, holds `{ productId, productName, quantity, unitPrice }`)
> and this screen's richer **mock VM** (`fetchCart`). Unifying them — the store
> becoming the source of truth that the backend hydrates — is part of that rework.

Client is **mock-first**: `src/features/cart/api/cartApi.ts` (`USE_MOCK`).
View-models: `src/features/cart/types.ts`.

All responses use the envelope `{ data, message, success }` (see `src/types/api.ts`).

---

## GET `/cart`

Requires auth. Hydrates the caller's persisted cart into a full basket: the chosen
pharmacy, each line with display metadata + line pricing, the applicable insurance
coverage, and the fee breakdown. Pharmacy + insurance are resolved server-side from
the user's chosen pharmacy and active mutuelle.

**200 Response `data`** (`CartView`)
```jsonc
{
  "pharmacy": { "id": "ph_centre", "name": "Pharmacie du Centre", "distanceKm": 0.4, "open": true },
  "lines": [
    {
      "id": "trt_1",
      "name": "Doliprane 1000mg",
      "descriptor": "Boîte de 8",
      "tile": "green",          // pastel tile color: green|yellow|blue|pink
      "icon": "tablet",         // tablet|capsule|bottle|toggle
      "rx": false,
      "unitPrice": 2.18,
      "quantity": 2
    }
    // …
  ],
  "insurance": {
    "insurer": "Harmonie Mutuelle",
    "partner": true,            // in-network with the chosen pharmacy
    "covered": 8.83,            // amount the insurer takes on
    "balanceDue": 4.75          // member's remaining share when insurance is applied
  },
  "subtotal": 13.58,            // Σ unitPrice × quantity
  "dispensingFee": 2.04,        // "Honoraires de dispensation"
  "balanceDue": 4.75            // final amount due with insurance applied
}
```

**Notes**
- `subtotal` is recomputed client-side from the (optimistic) line quantities so the
  footer stays live while editing. `dispensingFee`, `covered`, and the insured
  `balanceDue` come from the server (they depend on molecule reimbursement rates and
  the mutuelle contract, not just the running total).
- When the insurance toggle is **off**, the client shows the un-insured balance
  (`subtotal + dispensingFee`); when **on**, it shows the server's `balanceDue`.

## PATCH `/cart/lines/{lineId}`

Set a line quantity (stepper). Body `{ "quantity": 3 }`; `0` removes the line.
Returns the recomputed `CartView`. (Client is optimistic; this reconciles fees.)

## POST `/cart/checkout`

Validate the order ("Valider la commande"). Body `{ "useInsurance": true }`.
Creates the `Order` (pharmacy-scoped, `tenantId` server-assigned), empties the cart,
and returns the new order id. Rx lines require an attached/validated prescription —
absent one the server returns `422` listing the offending `lineId`s.

---

## Rejections

| code | when |
|---|---|
| 401 | not authenticated |
| 404 | no active cart |
| 409 | a line's pharmacy stock changed (out of stock) since it was added |
| 422 | checkout blocked — Rx line without a validated prescription |
