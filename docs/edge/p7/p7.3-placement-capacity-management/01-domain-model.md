# P7.3 — Domain model

Placement & capacity are **decision/intent** records only. No tenant create, Keycloak, BB calls, or workflow execution.

## Aggregates

| Aggregate | Table | Role |
|-----------|-------|------|
| Placement request | `edge_p7_placement_requests` | Durable ask bound to P7.1 auth + P7.2 registry refs |
| Placement decision | `edge_p7_placement_decisions` | Engine outcome + selected target |
| Candidate evaluation | `edge_p7_placement_candidate_evaluations` | Per-candidate hard/score audit |
| Capacity inventory | `edge_p7_capacity_inventory` | Declared/observed headroom per env+resource |
| Capacity reservation | `edge_p7_capacity_reservations` | HELD→COMMITTED/RELEASED/EXPIRED holds |
| Placement policy | `edge_p7_placement_policies` | Scope, hard gates, scoring weights |
| History | `edge_p7_placement_history` | Append-only transitions |

## Status vocabularies

- **Request / decision:** `PENDING|EVALUATING|PLACED|REQUIRES_REVIEW|NO_CAPACITY|NO_COMPATIBLE_TARGET|REJECTED|EXPIRED|CANCELLED|SUPERSEDED`
- **Reservation:** `HELD|COMMITTED|RELEASED|EXPIRED|CANCELLED|FAILED`
- **Inventory:** `ACTIVE|STALE|SUSPENDED|RETIRED`
- **Policy:** `DRAFT|ACTIVE|DEPRECATED|RETIRED`

## Ports

- `PlacementAuthorizationViewPort` — fail-closed P7.1 projection (`ACCEPTED` + `ALLOW` + `VERIFIED` + `NOT_REVOKED` + not expired).
- `PlacementRepositoryPort` — CRUD/list + `reserveCapacityWithLock` + `appendHistory`.

## Domain files

`src/modules/edge/domain/placement/` — types, ports, `capacity.ts`, `placement-engine.ts`, events.
