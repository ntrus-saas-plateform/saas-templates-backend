# Security & RBAC (P1.18)

## Reuse of P0

- Realm `edge-admin` (not ERP `platform`)
- `EdgeAuthGuard` → global role assignments only
- `EdgeWorkspaceGuard` → GLOBAL + single vertical (never merges multiple verticals)
- `EdgeOptionalWorkspaceGuard` → optional workspace enrichment for catalog APIs
- Cookies `okapi_edge_*` remain isolated from ERP BFF

## Permissions seeded in 074

| Code | Intent |
|------|--------|
| `platform:products:read/create/update/lifecycle/publish` | Product governance |
| `platform:taxonomy:read/manage` | Market segments |
| `platform:profiles:manage` | Business profile templates |
| `platform:operating_models:manage` | Operating models |
| `platform:capabilities:read/manage` | Capability registry/mappings |
| `platform:backends:read/manage` | Backend registry/bindings |
| `platform:contracts:manage` | Integration contracts |
| `platform:readiness:evaluate` | Readiness engine |
| `platform:publication:approve` | Catalog publication |

Role grants: SUPER_ADMIN (all), PLATFORM_OPERATOR (ops set), VERTICAL_OWNER / VERTICAL_ADMIN (scoped subsets).

## Isolation invariants

1. Restaurant vertical admin cannot update Pharmacy products (enforced in product use-cases).
2. Multi-vertical membership does not grant global rights.
3. UI permission gates are not the security boundary — APIs enforce permissions + vertical scope.
4. Tenant entitlement engine is out of scope for P1.

## Audit

Governance mutations continue to use `edge_audit_events` / AuditWriter patterns from P0 where wired.
