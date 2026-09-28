# Database

## Strategy: DB-per-Tenant + hybrid control plane

Each tenant has an isolated PostgreSQL database. The **control plane** database stores tenant registry, identity/RBAC, customer core, and the control-plane transactional outbox. **Tenant databases** store settings overrides, commerce, pharmacy, CRM timeline, and the tenant transactional outbox.

```
Control Plane DB (platform_control)
├── tenants, organizations, tenant_domains
├── plans, plan_modules
├── user_organization_memberships, user_tenant_memberships
├── application_users, invitations, roles, permissions
├── global_customers, tenant_customers, organization_customers
├── global_customer_consents, global_customer_addresses
├── control_plane_outbox_events
└── reconciliation_reports

Tenant A DB (tenant_a)              Tenant B DB (tenant_b)
├── schema_migrations               ├── schema_migrations
├── outbox_events                   ├── outbox_events
├── inbox_messages                  ├── inbox_messages
├── tenant_settings                 ├── tenant_settings
├── organization_settings           ├── organization_settings
├── customer_timeline_events        ├── customer_timeline_events
```

Patient role is stored on control-plane `tenant_customers` / `global_customers`. Commerce tables were removed (`015_drop_commerce`).

## Connection Management

`TenantDatabaseManager` handles:
- Control plane pool (`getControlPlanePool()`)
- Per-tenant pool cache (`getPool(tenantId)`) resolved **dynamically** from the tenant registry
- Dedicated LOGIN role per tenant (`database_username`) after provision; legacy rows fall back to `CONTROL_PLANE_DB_USER`
- Shared cluster password via `TENANT_DB_PASSWORD` (defaults to `CONTROL_PLANE_DB_PASSWORD`)
- Pool eviction after idle timeout + `evictPool(tenantId)` on hard deprovision
- Circuit breaker + connection/statement timeouts

## Provisioning & deprovisioning

See [TENANT-ARCHITECTURE.md](./TENANT-ARCHITECTURE.md). Summary:

1. Idempotent saga (`Idempotency-Key`) → `PROVISIONING` / step machine → `ACTIVE` or `FAILED`
2. `CREATE DATABASE` + dedicated `CREATE ROLE` on the shared cluster
3. Tenant SQL migrations
4. Default Keycloak **Organization** in the **shared** realm (not a realm-per-tenant)
5. Optional primary subdomain `{slug}.{TENANT_BASE_DOMAIN}`
6. Soft/hard deprovision via `DELETE /api/v1/admin/tenants/:id`
7. Retry: `POST /api/v1/admin/tenants/:id/provisioning/retry`

Relevant CP migrations: `026_tenant_provisioning_saga`, `027_tenant_domains`, `028_tenant_plans_modules`, `029_tenant_status_locked_failed`.

Configuration via environment:
- `DB_POOL_MAX` — max connections per pool
- `DB_POOL_IDLE_TIMEOUT_MS` — idle connection timeout
- `DB_POOL_CONNECTION_TIMEOUT_MS` — connection acquisition timeout
- `DB_STATEMENT_TIMEOUT_MS` — query timeout
- `DB_POOL_EVICTION_MS` — pool cache eviction interval
- `TENANT_BASE_DOMAIN` — optional base for provisioned subdomains
- `TENANT_SUSPENDED_ALLOW_READS` — allow GET when tenant is `SUSPENDED`

## Migrations

```bash
# Control plane
pnpm migrate:control

# Per-tenant (skips already-applied versions via schema_migrations)
pnpm migrate:tenant <tenant-id>
```

Migration files:
- `migrations/control-plane/` — platform metadata and customer core
- `migrations/tenant/` — per-tenant operational schema

Rules:
- Migrations are versioned and deterministic
- Never modify applied migrations in production
- Each tenant migration file inserts its version into `schema_migrations`
- CLI and runtime migrator both skip applied versions

## Transactions

**Control plane writes** (customer, membership, organization, user):

```typescript
await controlPlaneOutbox.runWithOutbox(tenantId, async (client, enqueue) => {
  await repository.write(..., client);
  await enqueue(integrationEvent);
});
```

**Tenant writes** (commerce, settings, platform events):

```typescript
await outboxTransaction.runWithOutbox(tenantId, async (client, enqueue) => {
  await repository.write(..., client);
  await enqueue(integrationEvent);
});
```

## Messaging reliability

- **Outbox publisher** polls tenant outbox + control-plane outbox per active tenant
- **Inbox consumer** claims before processing; `releaseClaim` on handler failure enables RabbitMQ redelivery
- **Timeline handler** deduplicates via `(tenant_id, source_event_id)` unique index (migration `007`)

## Data Integrity

- UUID primary keys
- UTC timestamps (`created_at`, `updated_at`)
- Foreign keys with ON DELETE constraints
- CHECK constraints on status enums
- UNIQUE constraints on slug/tenant and event idempotency keys

## Tenant Provisioning

Control plane only — data plane services never provision databases:

```
TenantDatabaseProvisioner → CREATE DATABASE → TenantDatabaseMigrator → ACTIVE
```

Runtime migrator (`PgTenantDatabaseMigrator`) and CLI (`scripts/migrate-tenant.ts`) share the same `schema_migrations` skip semantics.
