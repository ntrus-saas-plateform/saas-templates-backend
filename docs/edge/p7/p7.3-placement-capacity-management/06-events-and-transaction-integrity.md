# P7.3 — Events & Transaction Integrity

## Pattern (mandatory — same as P7.2 remediation)

All mutations run inside:

```ts
outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client, enqueue) => {
  // domain writes with client
  // appendHistory(..., client)
  // await enqueue(integrationEvent)
  // await audit.create(..., client)  // failure → DEPENDENCY_UNAVAILABLE
});
```

Tenant: `edge-control-plane` (`EDGE_P7_OUTBOX_TENANT`).

## Integration events (examples)

- `p7.placement.request.created.v1`
- `p7.placement.decision.evaluated.v1`
- `p7.placement.decision.confirmed.v1`
- `p7.placement.request.cancelled.v1`
- `p7.placement.decision.superseded.v1`
- `p7.capacity.reservation.held.v1` / `.released.v1` / `.expired.v1` / `.committed.v1`
- `p7.capacity.inventory.updated.v1`
- `p7.placement.policy.updated.v1`

## Capacity reservation atomicity

`reserveCapacityWithLock(client)`:

1. Outer TX already begun
2. `SELECT … FOR UPDATE` inventory by `environment_id` + resource types
3. Verify `available >= required` per resource (no overbook)
4. `UPDATE reserved_capacity += qty` with version check
5. `INSERT` reservation `HELD`
6. Insufficient capacity → `DomainError(CONFLICT)`

Concurrent last-slot races: exactly one TX commits; the other rolls back with CONFLICT.

## Confirm vs P7.4

`ConfirmPlacementUseCase` only commits reservation (`HELD` → `COMMITTED`) and emits audit/outbox. It does **not** start workflow, infra, Keycloak, or tenant activation.
