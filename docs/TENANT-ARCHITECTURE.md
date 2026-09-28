# Tenant Architecture

## Identity model (Keycloak)

- **One shared Keycloak realm** for the whole platform (`KEYCLOAK_ADMIN_REALM` / issuer URLs).
- **No dedicated realm per tenant.** The column `tenants.keycloak_realm` is deprecated and unused.
- Each tenant has **one or more Keycloak Organizations** in that shared realm.
- Isolation:
  - JWT claim `tenant_id` → which tenant DB / CP scope
  - JWT org membership / active organization → which organization inside the tenant
  - Optional Host → registered domain: if Host maps to a tenant, JWT `tenant_id` **must match** or the request is **403**

Additional organizations after provision: `POST /api/v1/organizations` (mirrors Keycloak Organization when admin sync is enabled). Quotas come from the tenant plan (`max_organizations` / overrides).

## Tenant resolution

| Signal | Behavior |
|--------|----------|
| JWT `tenant_id` | Always required for authenticated tenant APIs (identity source of truth) |
| `Host` / registered domain | Lookup `tenant_domains`; if found, must equal JWT tenant or **403** |
| localhost / IP / unmapped Host | JWT only (Swagger, pure API clients) |

Env: `TENANT_BASE_DOMAIN` (e.g. `example.com`) → provision reserves `{slug}.{TENANT_BASE_DOMAIN}` as primary `SUBDOMAIN`.

Reserved subdomain labels: `www`, `api`, `admin`, `app`, `auth`, `platform`, `mail`, `cdn`, `status`, `support`, `docs`.

## Lifecycle

States: `PROVISIONING`, `FAILED`, `ACTIVE`, `READ_ONLY`, `SUSPENDED`, `LOCKED`, `DEACTIVATING`, `ARCHIVED`, `DELETED` (see `tenant-lifecycle.ts`).

| Status | Reads | Writes | Notes |
|--------|-------|--------|-------|
| `ACTIVE` | yes | yes | Normal |
| `READ_ONLY` | yes | no | `TenantWritableGuard` |
| `SUSPENDED` | optional | no | Reads if `TENANT_SUSPENDED_ALLOW_READS=true` |
| `LOCKED` | no | no | Security lockout for tenant users |
| `FAILED` | no | no | Provisioning failed; use retry |
| `PROVISIONING` | no (normal APIs) | — | Saga in progress |

## Registry

Control-plane table `tenants` + `tenant_owners` + `tenant_domains` + `plans` / `plan_modules`.

Per tenant DB placement:

| Column | Meaning |
|--------|---------|
| `database_host` / `database_port` / `database_name` | Where the tenant DB lives (dynamic) |
| `database_username` | Dedicated PostgreSQL LOGIN role (`t_<slug>_app`) |
| `database_credentials_ref` | Per-tenant secret ref (`secret:tenants/{id}/db` or `vault:tenants/{id}/db`); cluster admin still uses env `TENANT_DB_PASSWORD` |
| `plan_id` | Commercial plan (BASIC / STANDARD / ENTERPRISE) |
| `default_organization_id` | Org created at bootstrap |
| `provisioning_step` / failure fields | Saga progress |

## Provisioning saga

`POST /api/v1/admin/tenants` requires header **`Idempotency-Key`**.

Orchestrator (`TenantProvisioningOrchestrator`) steps:

`REQUESTED` → `DB_CREATED` → `MIGRATED` → `IDENTITY_CONFIGURED` → `ORG_CONFIGURED` → `ADMIN_CONFIGURED` → `READY`

On failure: keep the row, `status=FAILED`, fill `failure_step` / `failure_reason` / `retry_count` — **no silent delete**.

`POST /api/v1/admin/tenants/:id/provisioning/retry` resumes from `failure_step`.

Events: `tenant.provisioning.started|failed|completed.v1`.

After READY (when `TENANT_BASE_DOMAIN` is set): register primary subdomain.

## Capabilities & plans

`GET /api/v1/platform/me/capabilities` returns effective modules, permissions, features, orgs, plan quotas, and navigation hints.

Effective module:

```text
plan.moduleEnabled ∧ tenantFeatureFlag ∧ userHasRelatedPermission
```

Plans seed: BASIC / STANDARD / ENTERPRISE with module matrix (commerce on STANDARD+, pharmacy on ENTERPRISE).

Organization `type`: `BRANCH|STORE|OFFICE|WAREHOUSE|PHARMACY|RESTAURANT|CLINIC|OTHER`.

## Deprovisioning

`DELETE /api/v1/admin/tenants/:tenantId`

- Soft (default): status → `DELETED` (data retained)
- Hard (`?hard=true`): close pools → `DROP DATABASE` → `DROP ROLE` → `DELETED`

Does **not** delete a Keycloak realm. Organization cleanup in Keycloak is separate (reconciliation / admin).

## Ops

| Endpoint | Use case |
|----------|----------|
| `GET /v1/admin/tenants/:id/health` | DB ping, schema versions, KC org presence, primary domain |
| `POST /v1/admin/reconciliation/run` | KC + DB + domain drifts |
| `GET/POST /v1/admin/tenants/:id/domains` | Domain registry CRUD |

## APIs (summary)

| Endpoint | Use case |
|----------|----------|
| `POST /v1/admin/tenants` | Saga provision (+ Idempotency-Key) |
| `POST /v1/admin/tenants/:id/provisioning/retry` | Resume FAILED / stalled |
| `DELETE /v1/admin/tenants/:id` | Soft/hard deprovision |
| `GET /v1/admin/tenants/:id/health` | Tenant health |
| `GET/POST /v1/admin/tenants/:id/domains` | Domains |
| `GET /v1/platform/me/capabilities` | Capabilities snapshot |
| `GET/PATCH /v1/tenants/:id` | Profile |
| `POST /v1/tenants/:id/status` | Status transition |
| `POST /v1/organizations` | Add org (quota enforced) |

## JWT

`tenant_id` claim is mandatory and is the primary source for tenant scoping. Host mapping is a **cross-check**, never an override.
