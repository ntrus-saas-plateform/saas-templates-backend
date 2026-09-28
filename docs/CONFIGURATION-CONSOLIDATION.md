# Configuration consolidation (Tenant / Org / Commercial / Inventory)

## Verdict

Radical SoT map after wiring (2026-09):

| Concern | Source of truth | Consumers |
|---------|-----------------|-----------|
| **Business vertical / capabilities** | `tenant_business_configurations` + `tenant_capabilities` (module `business-config`) | `BusinessContext`, `@RequiresCapability`, Settings Business profile |
| ATP / insufficient stock | `commercial_org_config.default_fulfillment_policy` + channel `fulfillment_policy` overlay | `ConfirmSalesOrder` via `mergeFulfillmentPolicy` |
| Reservation TTL | `commercial_org_config.reservation_timeout_minutes` (= orchestration `RESERVATION`) | Confirm sets `expires_at`; expire job; saga RESERVE step |
| Lot allocation FEFO/FIFO | `commercial_org_config.allocation_strategy` → syncs `inventory_policies.enable_fefo` | `AllocateSalesOrder` + inventory allocate |
| Negative stock / lot med / approvals | `inventory_policies` | Inventory engine only |
| Commercial feature flags | `commercial_org_config.enable_*` → syncs `features.*` | FeatureFlagService + UI Commercial page |
| Saga / anomaly timeouts | `orchestration_timeout_config` | `StartSaga` / `AdvanceSaga` / `RetrySaga` / `DetectProcessAnomalies` |
| Identity security, branding, privacy | `tenant_settings` / `organization_settings` | ConfigurationResolver |
| Defaults WH / POS / price list | `organizations.operational_settings` | Org CRUD / display |

**BusinessProfile sits above org SoTs:** assigning a profile materializes defaults into
`commercial_org_config`, `inventory_policies`, `features.*`, and `modules.*`. Engines
never branch on industry strings.

## Deprecated (ignored at runtime)

- `settings.commerce.allowNegativeStock`
- `settings.inventory.allowNegativeStock`
- `settings.inventory.valuationMethod` (as allocation SoT)

UI hides these in the field catalog; edit **Inventory policies** / **Commercial (org)** instead.

## APIs (org-scoped)

- `GET /api/v1/business-context`
- `GET /api/v1/business-profiles`, `POST /api/v1/business-config/assign-profile`
- `GET/POST /api/v1/business-config/capabilities...`
- `GET/PUT /api/v1/commercial-config`
- `GET/PUT /api/v1/inventory/policies`
- `GET/POST /api/v1/orchestration/timeouts`

See also: [business-config/ARCHITECTURE.md](./business-config/ARCHITECTURE.md).

## Frontend

Settings → Operations:

- Business profile
- Commercial (org)
- Inventory policies
- Process timeouts

## Fan-out on commercial upsert

`UpsertOrgConfigUseCase` writes:

1. `commercial_org_config`
2. `inventory_policies.enable_fefo` when `allocationStrategy` changes
3. `orchestration_timeout_config.RESERVATION` when `reservationTimeoutMinutes` changes
4. `features.enable_*` (+ `commerce.loyalty` / `commerce.pos` aliases) when flags change

`UpsertTimeoutConfig(RESERVATION)` writes back `commercial_org_config.reservation_timeout_minutes` (port only, no recursive fan-out).

## Fan-out on business profile assign

`AssignBusinessProfileUseCase` writes tenant business config, then the same org SoTs
(commercial + inventory + features/modules) and invalidates Redis `BusinessContext`.

Vague 2 lifecycle: **draft** does not materialize SoTs; **activate** / **rollback** /
**approved migration apply** do. See [business-config/LIFECYCLE-V2.md](./business-config/LIFECYCLE-V2.md).

Vague 3: product vertical extensions (`product_vertical_extensions`) + offline POS
snapshots + HTTP MCP (`/mcp`) + Okapi explain. See [business-config/EXTENSIONS-V3.md](./business-config/EXTENSIONS-V3.md).

Vague 4: marketplace packs (`licensing_packs` / `org_pack_subscriptions`) + warehouse
capability overrides. See [business-config/PACKS-V4.md](./business-config/PACKS-V4.md).

## Channel overlay rules

Channel wins only if it sets `insufficientStockPolicy` / `atpShortfallPolicy` / `atpPolicy` or `allocation_policy.strategy`. Otherwise org defaults apply.
