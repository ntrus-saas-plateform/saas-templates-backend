# Organization Architecture

## Model

Each application organization has:

- `id` — application UUID (APIs, preferences)
- `keycloak_organization_id` — Keycloak Organizations API id
- `slug` — alias used in `organization:<slug>` OAuth scope
- `code` — optional unique business code per tenant
- `parent_id` — hierarchy (max depth 8, cycle-checked)
- `is_primary` — at most one primary org per tenant
- Typed `address` / `contact`, `opening_hours`, `operational_settings` (JSONB)

Membership is stored in control-plane `user_organization_memberships` with statuses
`INVITED | ACTIVE | SUSPENDED | REMOVED | EXPIRED`, plus employment fields
(`department`, `position`, `manager_user_id`, `resource_scopes`).

## Hierarchy

```
Tenant
├── Head Office (primary)
├── Bujumbura
│   ├── Pharmacy
│   └── Warehouse
└── Gitega
```

APIs:

- `GET /organizations?scope=tenant&tree=true` — flat list with `parentId` for UI trees
- `GET /organizations?parentId=` — roots only
- Create/update accept `parentId`, `code`, `isPrimary`, address/ops payloads

## Settings cascade

```
Platform default → Tenant settings → Organization override → User preference
```

Only keys marked `overrideable` in `SETTING_DEFINITIONS` can be overridden at org scope
(localization, currency, tax, commerce, sales, purchasing, inventory, pos, documents,
notifications, workflow, hr, accounting, …).

## Operational shell (tenant DB)

Per-organization resources (CRUD shell; not full inventory/POS engines):

- `org_warehouses` (+ zones/locations)
- `org_pos_terminals`, `org_cash_registers`
- `org_workflows` (+ steps: approvers, thresholds, SLA)

Routes under `/api/v1/organizations/:organizationId/{warehouses|pos-terminals|cash-registers|workflows}`.

## Keycloak as source of active org

1. User selects organization at Keycloak login (scope `organization`) or refreshes token after in-app switch.
2. JWT carries organization claims (KC 26 object or legacy strings).
3. `ActiveOrganizationResolver` maps to application UUID and validates membership.

## In-app switch

`POST /api/v1/platform/organizations/switch`:

1. Validates membership in app DB
2. `setUserActiveOrganization` on Keycloak
3. Emits `platform.organization.switched.v1`
4. Returns `requiresTokenRefresh: true` and `tokenRefreshScope: organization:<slug>`

## Sync on mutations

`KeycloakOrganizationSyncService` (feature flag `features.keycloakSync`):

- Org create/update → KC Organizations API (name/slug only; hierarchy stays in app DB)
- Membership grant/revoke → KC org members

## Reconciliation

`ReconcileKeycloakUseCase` detects drift (placeholder KC ids, missing memberships). Scheduled job + `POST /v1/admin/reconciliation/run`.

See [KEYCLOAK-INTEGRATION.md](./KEYCLOAK-INTEGRATION.md).
