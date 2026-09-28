# Backend spec — Order tracking (Screen 16)

"Suivi de commande" — live status for an order. A full-screen route
(`/order-tracking?id={orderId}`), reached from the Home `ActiveOrderCard` and from
Screen 15's "Suivre ma commande". Dark status header, a status timeline (with the
preparer on the current step), the itemized articles, and the fulfilling pharmacy
(with a refresh affordance that re-polls).

> **Provisional** — part of the Commander/ordering flow Edgar will rework
> ([[commander-future-changes]]).

Client is **mock-first**: `src/features/orders/api/ordersApi.ts` (`USE_MOCK`).
View-model: `OrderTracking` in `src/features/orders/types.ts`.

All responses use the envelope `{ data, message, success }` (see `src/types/api.ts`).

---

## GET `/orders/{orderId}/tracking`

Requires auth. Returns the order's status timeline, items, and pharmacy. Polled on
pull / the refresh button; a push notification or websocket can drive live updates
later.

**200 Response `data`** (`OrderTracking`)
```jsonc
{
  "id": "CMD-2026-0542",
  "status": "preparing",              // domain OrderStatus
  "placedAtLabel": "aujourd'hui, 13:42",
  "steps": [
    { "key": "received",  "label": "Commande reçue", "timeLabel": "13:42", "sublabel": "Auto.", "state": "done" },
    { "key": "preparing", "label": "En préparation", "timeLabel": "13:50", "state": "current",
      "handler": { "initials": "MD", "name": "Marie D.", "role": "Préparatrice en pharmacie" } },
    { "key": "ready",     "label": "Prête",   "timeLabel": "~14:15", "sublabel": "Estimation", "state": "pending" },
    { "key": "pickedup",  "label": "Retirée", "sublabel": "En attente", "state": "pending" }
  ],
  "lines": [
    { "id": "trt_1", "name": "Doliprane 1000mg", "quantity": 2, "tile": "green", "icon": "tablet" }
    // …
  ],
  "pharmacy": { "name": "Pharmacie du Centre", "address": "12 rue Lafayette, 75009 Paris" }
}
```

**Step `state`** is one of `done | current | pending`. The client colours the rail
by progress (emerald up to and including the `current` step's leading half) and
renders the node accordingly (done = check, current = check + halo, pending = dot).
Exactly one step should be `current` while the order is active; once `pickedup`,
all are `done`.

**`timeLabel`** is a display string (the server localizes / formats it — absolute
times for past steps, `~HH:MM` estimates for future ones, absent when unknown).

---

## Relationship to other screens

Same underlying `Order` as the confirmation ([[15-order-confirmation]]) and the Home
`ActiveOrderCard`. `status` here mirrors the domain `Order.status`; the `steps` array
is a presentation projection of the order's status history + ETA.

## Rejections

| code | when |
|---|---|
| 401 | not authenticated |
| 403 | order belongs to another profile/tenant |
| 404 | unknown order id |
