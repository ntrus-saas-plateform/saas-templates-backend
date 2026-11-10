# P7.3 — Migration & Persistence

## Migration

`migrations/control-plane/098_edge_p7_placement_capacity_management.sql`

Tables:

- `edge_p7_placement_policies`
- `edge_p7_placement_requests`
- `edge_p7_capacity_inventory` (generated `available_capacity`, non-negative CHECK)
- `edge_p7_placement_decisions`
- `edge_p7_capacity_reservations`
- `edge_p7_placement_candidate_evaluations`
- `edge_p7_placement_history`

Ends with:

```sql
INSERT INTO schema_migrations (version)
VALUES ('098_edge_p7_placement_capacity_management')
ON CONFLICT DO NOTHING;
```

Does **not** modify 096/097.

## Persistence adapters

| Port | Implementation |
|------|----------------|
| `PLACEMENT_REPOSITORY_PORT` | `PgPlacementRepository` |
| `PLACEMENT_AUTHORIZATION_VIEW_PORT` | `PgPlacementAuthorizationViewAdapter` (composes `ProvisioningRepositoryPort`) |

Wiring: `edge-persistence.module.ts` + `edge-application.providers.ts`.

## Optimistic locking

All mutable aggregates carry `version INTEGER`; updates use `WHERE id = $1 AND version = $2` and bump version. Conflicts surface as `DomainError(CONFLICT)`.
