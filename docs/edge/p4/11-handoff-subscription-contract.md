# P4 → Subscription / Provisioning — Handoff Contract

## Principle

P4 prepares and transmits a **sales handoff package**. It does **not**:

- create tenants
- create subscriptions
- grant technical entitlements
- mark provisioning complete without confirmation

## Trigger

`POST /edge/sales/orders/:id/handoff` after sales order is `CONFIRMED` (or already `HANDOFF_PENDING`).

Server verifies:

- commercial account present
- product present
- commercial terms / amount present
- executed contract when required
- accepted quote when required

## Package payload (v1)

```json
{
  "accountId": "uuid",
  "salesOrderId": "uuid",
  "orderNumber": "SO-…",
  "opportunityId": "uuid|null",
  "contractId": "uuid|null",
  "quoteId": "uuid|null",
  "productId": "uuid|null",
  "currency": "USD",
  "totalAmount": "string",
  "commercialTerms": {},
  "offerConfiguration": {},
  "correlationId": "uuid",
  "note": "P4 does not create tenants or subscriptions"
}
```

## Events

| Event | Meaning |
|-------|---------|
| `sales.handoff.requested.v1` | Package emitted (outbox) |
| `sales.handoff.accepted.v1` | Downstream domain accepted |
| `sales.provisioning.status_received.v1` | Confirmation / pending from responsible system |

## Idempotency

- Unique `correlation_id` on handoff
- Unique active handoff per order (partial unique index)
- Attempt rows keyed by `idempotency_key`

## Confirmation

Only `POST /edge/sales/handoffs/:id/provisioning-status` with `confirmed: true` (and optional external refs) may set `PROVISIONING_CONFIRMED` / order `FULFILLED`. Claiming fulfilled without confirmation is rejected.
