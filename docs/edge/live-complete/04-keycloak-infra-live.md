# 04 — Keycloak + infra live (Phase 4 readiness)

## Use live Keycloak executors already in repo

- Wiring: `KEYCLOAK_LIVE_EXECUTOR` → `createLiveKeycloakExecutor` in `edge-application.providers.ts`.
- Implementation: `src/modules/edge/infrastructure/keycloak/live-keycloak.executor.ts` + `HttpKeycloakAdminAdapter`.
- Handlers: P7.7 Keycloak topology (`registerKeycloakHandlers`) — **no success simulation** when the live executor is absent.
- Lab: point `KEYCLOAK_ADMIN_*` at compose `keycloak` (see [`01-env-lab.example.md`](./01-env-lab.example.md)).

## Disable in-memory local-managed for lab

- `LocalManagedInfrastructureProvider` is acceptable only when admin URLs are set (`EDGE_P76_PG_ADMIN_URL` / Mongo / Surreal) so DB create/migrate hits a real engine.
- Do **not** treat empty in-memory resource maps as READY for activation.
- Prefer real Postgres tenant DBs (`postgres-tenant-a` / dedicated lab DBs) over stub observe/provision results.

## Readiness gate must require KC + DB + BB ready

P7.10 workflow `p710.readiness.evaluate` already aggregates:

- `readiness.check_infra` (DB / infra evidence)
- `readiness.check_keycloak` (topology verified via Keycloak repository)
- `readiness.check_product_control` (BB / product-control health)
- plus configuration / entitlements / experience

Activation (`p710.activation.activate`) must call `activation.require_ready_evidence` before `mark_active` / emit provisioning-completed.

**Lab rule:** READY only when **Keycloak topology + tenant DB connectivity + BB tenant ready** (`GET /control/v1/tenants/:id/ready` → HTTP 200 with `ready: true`) are all evidenced. Never invent READY on errors or missing adapters.

Portal flag `provisioningComplete` follows the same honesty: see Phase 3 `TenantRuntimeStatusPort` (control-v1 adapter when `EDGE_BB_CONTROL_BASE_URL` is set).

## Checklist

- [ ] Live Keycloak executor wired; admin URL/credentials reach compose Keycloak
- [ ] Infra provider has real `EDGE_P76_PG_ADMIN_URL` (or equivalent) — not empty local-managed READY
- [ ] BB control/v1 reachable with `EDGE_BB_CONTROL_*`
- [ ] Run readiness evaluate → aggregate READY only with KC + DB + BB evidence
- [ ] Activation blocked until require_ready_evidence passes
- [ ] Customer portal `provisioningComplete` true only after BB ready for `tenantRef`
