# Customer / B2C Architecture

> **Phase 6 CRM Wave 1:** see [docs/crm/ARCHITECTURE.md](./crm/ARCHITECTURE.md) for leads, opportunities, campaigns, 360 projection, capabilities, and evidence audit.

## Audit summary (baseline + Wave 1)

| Area | Status |
|------|--------|
| Customer master | **Present** — GlobalCustomer / TenantCustomer / OrganizationCustomer |
| CRM engine | **Wave 1** — leads, opportunities, activities, tasks, notes, segments, scoring, campaigns, credit profile (`043`) |
| Loyalty | **Separate module** — point ledger SoT |
| User vs Customer | ApplicationUser (staff) ≠ GlobalCustomer (B2C) |


## Target model

```text
GlobalCustomer (platform-owned, control plane)
      │
      ├── GlobalCustomerIdentity (Keycloak subject optional for guests)
      │
      └── TenantCustomer (tenant-owned relationship)
              │
              └── OrganizationCustomer (establishment relationship)
```

**User ≠ Customer**

| Concept | Purpose | Auth |
|---------|---------|------|
| `ApplicationUser` | Employees, admins, POS operators | Keycloak staff client (`platform-api`), frontend `edge-frontend` cible |
| `GlobalCustomer` | B2C consumers | Keycloak `platform-b2c` client + `tenant_id` JWT claim |

**Keycloak:** single shared realm for all tenants (`KEYCLOAK_ADMIN_REALM`). Tenant isolation is via the `tenant_id` user attribute / JWT claim, not separate realms.

## Data placement

### Control plane (`migrations/control-plane/018_customer_core.sql`)

| Table | Owner |
|-------|-------|
| `global_customers` | Platform |
| `global_customer_identities` | Platform |
| `tenant_customers` | Tenant relationship metadata |
| `organization_customers` | Organization relationship |
| `global_customer_consents` | Platform (immutable history) |

### Tenant database (`migrations/tenant/004_customer_operations.sql`)

| Table | Owner |
|-------|-------|
| `customer_interactions` | Tenant CRM |
| `customer_timeline_events` | Tenant read model |

Commerce module removed — former orders/cart/loyalty were tenant tables (`005_commerce_core.sql`, dropped by `015_drop_commerce`).

Patient role on customers → **source of truth** is `tenant_customers` (`is_patient`, `patient_status`, `patient_number`, `patient_profile`). `global_customers.is_patient` is a **derived** B2C convenience (true if any non-archived tenant link is patient). Staff API: `PATCH /customers/:id/patient`, list filter `?isPatient=true`. B2C app: `GET /customer/memberships` lists all establishment links + per-tenant patient role. Plan module key `pharmacy` gates patient-care UI only (no separate Nest module).

## Security

- Tenant scope from **JWT only** (`tenant_id` claim).
- Organization links validated via `OrganizationAccessPolicyService`.
- Permissions: `customers:read|create|update|…` (migration `019_customer_permissions.sql`).
- Cross-tenant access denied at repository layer (`tenant_id` on every query).

## APIs (Phase 1 foundation)

| Method | Path | Permission |
|--------|------|------------|
| GET | `/api/v1/customers` | `customers:read` |
| POST | `/api/v1/customers` | `customers:create` |
| POST | `/api/v1/customers/guest` | `customers:create` |
| POST | `/api/v1/customers/identify` | `customers:read` |
| GET | `/api/v1/customers/:tenantCustomerId` | `customers:read` |
| POST | `/api/v1/customers/:tenantCustomerId/organizations` | `customers:update` |

### B2C auth (public)

| Method | Path | Auth |
|--------|------|------|
| POST | `/api/v1/customer-auth/register` | Public |
| POST | `/api/v1/customer-auth/login` | Public |
| POST | `/api/v1/customer-auth/password-reset` | Public |

### B2C portal (`@CustomerRoute`, JWT `platform-b2c`)

| Method | Path |
|--------|------|
| GET | `/api/v1/customer/me` |
| GET | `/api/v1/customer/memberships` |
| GET/POST | `/api/v1/customer/consents` (grant / withdraw) |
| GET/POST/PATCH/DELETE | `/api/v1/customer/addresses` |

## Events

- `customer.registered.v1`
- `customer.linked_to_organization.v1`
- `customer.consent.granted.v1`
- `customer.consent.withdrawn.v1`

Published via `RoutingEventPublisher`: customer `customer.*` events → control-plane outbox (co-located with customer tables); other events → tenant DB outbox.

## Implementation phases (remaining)

| Phase | Scope | Status |
|-------|-------|--------|
| 1 | Audit | ✅ |
| 2 | Domain core + lifecycle | ✅ Foundation |
| 3 | Use cases (create, guest, identify, link) | ✅ Foundation |
| 4 | Migrations 018–019 + tenant 004 | ✅ |
| 5 | B2C Keycloak client + customer auth guards | ✅ |
| 6 | Consent + addresses (B2C portal) | ✅ Partial (no staff admin, no preferences) |
| 7 | Duplicate detection + merge workflow | ✅ |
| 8 | Customer 360 read model | ✅ Partial (360 API + timeline read) |
| 9 | POS guest checkout integration | ✅ |
| 10 | CRM interactions API | ✅ |
| 11 | Backoffice + B2C frontend | 🔲 (out of scope — API only) |
| 12 | Pharmacy Patient boundary | ✅ |

## Anti-patterns avoided

- No single `customers` mega-table for all tenant data
- No conflation of `ApplicationUser` and `GlobalCustomer`
- No tenantId from request body for authorization
- Customer module does not own pricing, orders, or loyalty

See also: `docs/DATA-PLACEMENT.md`, `docs/AUTHORIZATION.md`.
