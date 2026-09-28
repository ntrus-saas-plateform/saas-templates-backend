# Inventory Events

## Pattern

Critical stock mutations run inside `OutboxTransactionService.runWithOutbox(tenantId, …)` so the business write and outbox insert share one DB transaction.

## Existing / published (commercial)

Typical event names used by inventory use-cases (via `commercialEvent`):

- Stock received / reserved / allocated / transferred / adjusted
- Lot quarantined / recalled
- Recall created

(Exact type strings live in `commercial-shared/commercial-event` and use-case enqueue sites.)

## Target catalogue (extend, do not break)

```text
inventory.stock.received.v1
inventory.stock.reserved.v1
inventory.stock.allocated.v1
inventory.stock.issued.v1
inventory.stock.adjusted.v1
inventory.stock.transferred.v1
inventory.lot.quarantined.v1
inventory.lot.released.v1
inventory.lot.recalled.v1
inventory.recall.created.v1
inventory.recall.executed.v1
inventory.count.started.v1
inventory.count.posted.v1
inventory.policy.updated.v1
inventory.expiration.detected.v1
inventory.low_stock.detected.v1
inventory.recall.detected.v1
inventory.temperature_excursion.detected.v1
inventory.approval.required.v1
inventory.accounting.intent.v1
inventory.alert.raised.v1
inventory.valuation.updated.v1
```

## Consumers (downstream)

| Consumer | Reaction |
|----------|----------|
| Sales | Availability / backorder |
| Fulfillment | Pick readiness |
| Finance | Valuation / COGS signals |
| Notifications | Alerts (no direct provider coupling) |
| Analytics / read models | Refresh `rm_product_availability` |
| AI / Copilot | Read-only explain — never mutate |

## Outbox reliability

- Retries + dead-letter via existing messaging infrastructure
- Handlers must be idempotent on `eventId` / correlation
- Redis never becomes event SoT
