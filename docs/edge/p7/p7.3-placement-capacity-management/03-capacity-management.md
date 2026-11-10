# P7.3 — Capacity management

## Inventory

`edge_p7_capacity_inventory` tracks per `(environment, resource_type, measurement_source)`:

- Buckets: `total`, `unavailable`, `reserved`, `allocated`.
- Generated `available = total - unavailable - reserved - allocated` (CHECK ≥ 0).
- Resource types: `CPU|MEMORY|STORAGE|DATABASE|CONNECTION|TENANT_SLOT|RUNTIME_INSTANCE|BANDWIDTH`.
- Sources: `DECLARED|OBSERVED`. Freshness via `valid_until`.

Helpers (`capacity.ts`): `computeAvailable`, `assertNonNegative`, `isFresh`, `validateQuantities`.

## Reservations

`reserveCapacityWithLock` (port contract):

1. Lock inventory rows for required resource types (`FOR UPDATE`).
2. Verify fresh + available ≥ required for each type.
3. Increment `reserved_capacity` with optimistic version check.
4. Insert reservation `HELD` with TTL (`expires_at`).
5. Fail closed (`CONFLICT`) on insufficient capacity — no overbook.

Lifecycle: `HELD` → `COMMITTED` (confirm) | `RELEASED` | `EXPIRED` | `CANCELLED` | `FAILED`.

## Permissions

- `platform:capacity:read|manage|reserve|release`
- `platform:placement:read|request|evaluate|confirm|cancel`
- `platform:placement_policy:read|manage`

`EDGE_PLATFORM_SUPER_ADMIN` all; `EDGE_PLATFORM_OPERATOR` read + placement mutate + capacity manage/reserve/release + policy read.
