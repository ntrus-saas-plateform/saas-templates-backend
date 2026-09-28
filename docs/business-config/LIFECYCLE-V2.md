# Business Config Vague 2 — Configuration lifecycle

## Scope

Vague 2 adds **draft → activate → rollback**, **full dry-run**, **safe disable**, and
**approved profile migration** (never auto-switch). PostgreSQL only.

## Schema

Migration `033_business_config_lifecycle.sql`:

- `tenant_business_configuration_versions` — immutable snapshots (`ACTIVE` / `DRAFT` / `SUPERSEDED` / `ROLLBACK_POINT`)
- `business_config_migration_plans` — `PROPOSED` → `APPROVED` → `APPLIED` (or `REJECTED` / `CANCELLED`)

Permissions `054_business_config_lifecycle_permissions.sql`:

- `business-config:activate`
- `business-config:rollback`
- `business-config:migrate`

## Lifecycle rules

| Action | Writes tenant config | Materializes commercial/inventory/features | Runtime BusinessContext |
|--------|----------------------|--------------------------------------------|-------------------------|
| Save draft | `status=DRAFT` | **No** | Still last **ACTIVE** snapshot (or legacy empty) |
| Activate | `status=ACTIVE` + version bump | **Yes** | New ACTIVE |
| Assign (compat) | `status=ACTIVE` immediately | **Yes** | New ACTIVE |
| Rollback | restore snapshot → ACTIVE | **Yes** | Restored ACTIVE |

Optimistic concurrency: every mutation accepts `expectedVersion` and returns `CONFLICT` on mismatch.

## Safe disable

`DisableCapability` + dry-run / migration analysis use `SafeDisableEvaluator` +
`PgBusinessConfigRuntimeGuard`:

- Dependent ENABLED capabilities
- Open `sales_orders` (not COMPLETED/CANCELLED) for inventory/sales-sensitive caps
- Active `commercial_workflow_instances` (`PENDING` / `IN_PROGRESS`)
- Insurance claims: always 0 until engine exists (placeholder)

## Profile migration (Retail → Pharmacy)

1. `POST /business-config/migration-plans` `{ toProfile }` → analysis + diff + blockers (`PROPOSED`)
2. `POST .../approve` — refuses if error blockers remain
3. `POST .../apply` — **requires APPROVED**; saves draft then activates (optional `activate:false`)

No automatic profile switch.

## APIs (additions)

- `POST /business-config/draft`
- `POST /business-config/activate`
- `POST /business-config/rollback`
- `GET /business-config/versions`
- `GET /business-config/diff?profileCode=&fromVersion=&toVersion=`
- `POST /business-config/validate` — **full dry-run** (graph + runtime blockers + diff)
- `POST/GET /business-config/migration-plans`
- `POST /business-config/migration-plans/:id/approve|apply`

Events: `business.config.draft.saved.v1`, `business.config.activated.v1`, `business.config.rolled_back.v1`.

## UI

Settings → Business profile: draft / activate / assign-live / dry-run / rollback / migration plans.

## Tests

- Domain: `configuration-lifecycle.spec.ts` (diff, safe-disable, Pharmacy/Supermarket/Restaurant materialize)
- Prior Vague 1: validator, materializer, CapabilityGuard

## Gap register (post–Vague 2)

| Gap | Wave | Note |
|-----|------|------|
| Deep E2E against live multi-tenant DB | 2.1 | Domain scenarios covered; full Nest e2e optional |
| VerticalExtensionRegistry | 3 | — |
| MCP / Okapi why | 3 | Explain endpoint exists; MCP later |
| HOTEL/CLINIC packs | 4 | Stubs remain |
| Insurance claim engine | later | Safe-disable stub returns 0 |
