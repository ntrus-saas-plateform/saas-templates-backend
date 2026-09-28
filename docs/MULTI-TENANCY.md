# Multi-Tenancy

## Hierarchy

```
PLATFORM
 ├── Tenant A (PostgreSQL Database A)
 │    ├── Organization A1
 │    └── Organization A2
 └── Tenant B (PostgreSQL Database B)
      └── Organization B1
```

## Rules

1. **Tenant = data isolation boundary** — each tenant has its own PostgreSQL database
2. **Organization = branch within tenant** — mapped to Keycloak Organizations
3. **Tenant ID from JWT only** — never trusted from headers, query params, or body
4. **Organization membership verified** — user must belong to the active organization
5. **Cross-tenant access impossible** — tenant pools are isolated, organization queries scoped by tenant_id

## Tenant Lifecycle

| Status | Access |
|--------|--------|
| PROVISIONING | Denied |
| ACTIVE | Full access |
| READ_ONLY | Read only |
| SUSPENDED | Denied |
| DEACTIVATING | Denied |
| ARCHIVED | Denied |
| DELETED | Denied |

## Tenant Resolution Flow

```
JWT token
  → extract tenant_id claim
  → TenantRegistry.findById(tenantId)
  → validate tenant status
  → set TenantContext.tenantId
  → TenantDatabaseManager.getPool(tenantId)
```

## Organization Context

Users with multiple organizations can switch via:

```
POST /api/v1/platform/organizations/switch
{ "organizationId": "..." }
```

Validation chain:
1. Organization exists in tenant
2. Organization status is ACTIVE
3. User is member of organization

## DB-per-Tenant

```
tenantId → TenantRegistry → database connection info → SecretProvider → pg.Pool
```

Connection pools are cached per tenant with eviction of idle pools.
