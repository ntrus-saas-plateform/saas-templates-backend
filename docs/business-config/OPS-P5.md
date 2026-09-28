# Business Config — P5 Ops Runbook

Production readiness extras beyond code proofs (X.45 Failure Safety).

## Migrations

Apply **tenant** migrations through `041_capability_conflicts_seed.sql` and control-plane `053`–`058` before enabling multi-vertical profiles in prod.

```bash
pnpm migrate:control
pnpm migrate:tenant <tenant-id>
```

## Environment (production)

| Variable | Value | Why |
|----------|-------|-----|
| `AUTH_PERMISSION_DENY_BY_DEFAULT` | unset (defaults true in prod/staging) or `true` | Undecorated routes → 403 |
| `BUSINESS_CONFIG_LEGACY_CAPABILITY_BYPASS` | `false` / unset | CapabilityGuard fail-closed without profile |
| `OUTBOX_POLL_INTERVAL_MS` | e.g. `5000` | Broker recovery cadence |
| Redis | Required for cache + outbox leader lock; **reads fail-open** if Redis dies | BC resolve falls back to Postgres |

## Broker down / outbox

1. Capability enable/disable writes **state + audit + outbox row** in one Postgres transaction.
2. If RabbitMQ is down, `OutboxPublisher` skips the cycle (`isConnected() === false`) or `markFailed` / eventually `DEAD_LETTER`.
3. Events remain in `outbox_events` (`PENDING` / `FAILED`) until broker recovers — **no silent loss**.
4. Replay dead letters via existing outbox replay APIs (idempotent consumers required).

**Verify:** stop broker → enable capability → row in `outbox_events` with `business.capability.enabled.v1` → start broker → status `PUBLISHED`.

## Redis down

- `CacheService.get/set/del` fail-open (null / no-op).
- `ResolveBusinessContextUseCase` loads from Postgres and continues.
- Outbox leader `setNx` fails closed → no dual-publish race under split brain without Redis.

**Verify:** block Redis → `GET /business-context` still 200 with correct profile/caps.

## Backup / restore

| Asset | Backup | Restore note |
|-------|--------|--------------|
| Control-plane DB | PITR / nightly dump | Tenants registry + orgs |
| Per-tenant DB | PITR / dump including `tenant_business_configurations`, `tenant_capabilities`, `outbox_events`, inventory policies | Restore org configs **before** traffic |
| Redis | Optional / ephemeral | Safe to flush; BC rebuilds from DB |

After restore: run `POST /business-config/policies/reconcile` (optionally `repair: true`) to heal Config↔inventory SoT drift.

## Five-vertical smoke (HTTP / Docker)

**Automated (local Docker):**

```bash
TESTCONTAINERS=true pnpm exec vitest run --config ./vitest.config.e2e.ts test/e2e/multi-vertical-five-tenant.e2e-spec.ts
```

Harness: `test/helpers/multi-vertical-*.ts` — five orgs (PHARMACY / SUPERMARKET / RESTAURANT / BOUTIQUE / WHOLESALE), Redis mocked fail-open, broker `isConnected: false`.

| Check | Expect |
|-------|--------|
| Distinct `business-context` per org | 200 × 5 profiles |
| Pharmacy product-sale Rx gate | 201 + PRESCRIPTION |
| Restaurant product-sale Rx gate | 403 |
| Restaurant kitchen / pharmacy kitchen | 201 / 403 (+ real `GET /kitchen/queue`) |
| Wholesale CRM opportunity gate | 201 (`OPPORTUNITY_MANAGEMENT`) |
| Restaurant CRM opportunity gate | 403 |
| Pharmacy CRM base / boutique credit | 201 / 403 |
| Wholesale CRM lead create + list | 2xx |
| Restaurant transition on wholesale lead | 403 or 404 |
| Wholesale procurement RFQ / three-way | 201 (`RFQ`, `THREE_WAY_MATCH`) |
| MCP `capability_enable` with only `mcp:invoke` | 403 |
| Enable with stale `expectedVersion` | 409 |
| Redis-down context | 200 |
| Broker-down capability enable | outbox row `PENDING` |

**Manual staging:** same checks against a real stack; create or assign the five profiles first.

## Metrics to alert

- `business_context_resolve_total{result="empty"}` spike
- `business_policy_drift_total`
- `outbox_failed_total` / dead letter growth
- Redis `ping` false for > N minutes (cache degraded, not outage)
