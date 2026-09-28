# Business Config Architecture (Vague 1)

## Purpose

Compose multi-vertical behavior on top of the existing ERP Core without duplicating
Inventory, Commercial, Accounting, or Keycloak SoTs.

```text
BusinessProfile
  → enable Capabilities (+ modules/features)
  → materialize Policies into commercial_org_config + inventory_policies
  → bind Workflow templates
  → expose UI/POS config snapshot
```

**Forbidden:** `if (businessType === 'PHARMACY')` inside Sales / Inventory engines.
**Forbidden:** a second store for FEFO / negative stock / ATP.

## Resolution cascade

```text
Platform AVAILABLE
  → Plan licensed (modules.*)
  → Tenant/Org ENABLED (tenant_capabilities)
  → User permission (RBAC)
  → Policy (commercial_org_config / inventory_policies)
```

Capability ≠ Feature flag ≠ Permission ≠ Module — four distinct axes.

## Module layout

`src/modules/business-config/`

| Layer | Responsibility |
|-------|----------------|
| Domain | `CapabilityCompatibilityValidator`, `ProfileMaterializer`, types |
| Application | Assign / Enable / Disable / Validate / ResolveBusinessContext |
| Infrastructure | PG repository, Redis `BusinessContext` cache |
| Presentation | REST under `/api/v1` |

## Persistence (tenant PG)

Migration `032_business_config.sql`:

- `capability_definitions` + deps/conflicts
- `business_profiles` (+ versions)
- `tenant_business_configurations` (optimistic `version`)
- `tenant_capabilities`, `tenant_workflow_bindings`
- `tenant_ui_configuration` / `tenant_pos_configuration`
- `business_config_audit`

Permissions: `053_business_config_permissions.sql`
(`business-config:read|update`, `capability:enable|disable`).

## Materialization

`AssignBusinessProfile` writes:

1. Tenant business configuration + capability states
2. `inventory_policies` (FEFO, negative stock, lot/expiry med flags)
3. `commercial_org_config` (allocation, ATP, timeouts, commercial flags)
4. `features.*` and `modules.*` via settings repository
5. Outbox: `business.profile.assigned.v1`, `business.context.invalidated.v1`
6. Cache invalidate `business-context:{tenantId}:{organizationId}:v{n}`

## Runtime consumers

| Consumer | Behavior |
|----------|----------|
| `GET /business-context` | Immutable snapshot |
| `GET /platform/me/capabilities` | Merges `businessProfile`, `enabledCapabilities`, feature flags |
| `@RequiresCapability('FEFO')` + `CapabilityGuard` | 403 if profile assigned and capability off; **legacy tenants** (`configVersion === 0`) are not blocked |
| Sales / Inventory | Continue reading commercial/inventory policies only |

## Cache

- Key: `business-context:{tenantId}:{organizationId}:v{configVersion}`
- TTL 300s via `CacheService`
- Invalidated on assign / enable / disable / POS/UI updates

## Vague 2–4 gaps (honest)

| Gap | Wave | Severity |
|-----|------|----------|
| Draft / activate / rollback / full dry-run | **2 DONE** | See [LIFECYCLE-V2.md](./LIFECYCLE-V2.md) |
| Safe disable with open orders / workflows | **2 DONE** | Insurance claims still stubbed |
| Profile migration Retail→Pharmacy (approval) | **2 DONE** | Never auto-switch |
| VerticalExtensionRegistry / product extensions | **3 DONE** | See [EXTENSIONS-V3.md](./EXTENSIONS-V3.md) |
| Deep POS/UI + offline snapshots | **3 DONE** | — |
| MCP tools + Okapi why | **3 DONE** | HTTP `/mcp` |
| HOTEL / CLINIC / HOSPITAL packs + regulatory | **4 DONE** | See [PACKS-V4.md](./PACKS-V4.md) |
| Marketplace licensing packs | **4 DONE** | — |
| Warehouse capability overrides | **4 DONE** | — |
| licensedModules hard-gate + regulatory/locale on BC | **4.1 DONE** | See [MASTER-PROMPT-COVERAGE.md](./MASTER-PROMPT-COVERAGE.md) |
| Profile templates §§22–36 + sales capability gate | **4.2 DONE** | Migration `037`; workflow by-process; confirm-order gates |
| Vertical engines Insurance / Kitchen / PMS (PG) | **5 DONE** | Module `vertical-ops`; migration `038`; **no SurrealDB** |
| Drop clinical columns off Product core | **5 DONE** | Migration `039`; hydrate from `product_vertical_extensions` |
| Deep multi-tenant Nest e2e (§122) | **PARTIAL** | See [DOD-121.md](./DOD-121.md) |
| Master prompt full DoD §121 | **PARTIAL** | Checklist claimed honestly — not 100% green |

Capabilities with real engines: **INSURANCE**, **KITCHEN**, **TABLES**, **PMS**,
**ROOM_SERVICE**, **MINIBAR** → `AVAILABLE`. Remaining EXPERIMENTAL (e.g. MODIFIERS,
BEDS, HOUSEKEEPING, RECIPES, WEIGHTED) stay blocked on **manual** enable.
