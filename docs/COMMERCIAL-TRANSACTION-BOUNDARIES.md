# Commercial Transaction Boundaries

## Target: Confirm Order

A single durable transaction should include:

1. **Order** transition to `CONFIRMED` (versioned) with frozen line price snapshots  
2. **Reservation** rows for each line (ACTIVE)  
3. **Outbox** event `sales.order.confirmed.v1`  
4. **Audit** trail for the confirm action  

Ideal boundary: `Order + Reservation + Outbox + Audit` in one DB transaction (same tenant pool client).

## Current status: PARTIAL

As of the sales confirm use-case:

- ATP checks and **`inventoryEngine.reserve(...)` run before** `outbox.runWithOutbox(...)`.
- Order transition + outbox enqueue run **inside** the outbox transaction.
- Therefore reservation is **outside** the order/outbox TX today → **PARTIAL** vs the target boundary.

Failure mode to watch: reserve succeeds then confirm TX fails (orphaned reservations) — jobs / release paths must reconcile.

## Other boundaries (summary)

| Operation | Expectation |
|-----------|-------------|
| Allocate FEFO | Allocations + soft ledger in one TX |
| Receive / adjust / issue | Lot mutation + inventory_ledger append in one TX |
| Post invoice | Invoice + lines immutable insert in one TX |
| Capture payment | Payment + invoice amount_paid (+ optional order status) |
| AI forecast write | `demand_forecasts` and/or `commercial_explain_snapshots` only — **no** stock TX |

## Guidance

Prefer passing the same `PoolClient` into inventory + sales repositories when tightening confirm. Until then, document PARTIAL and keep reservation expiry / release jobs healthy.
