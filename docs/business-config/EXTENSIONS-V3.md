# Business Config Vague 3 — Extensions, offline POS, MCP, Okapi

## Scope

| Item | Status |
|------|--------|
| `VerticalExtensionRegistry` + `product_vertical_extensions` | Done |
| Deep POS/UI config + versioned offline snapshots | Done |
| Nest MCP tools (read + guarded mutations) | Done |
| Okapi structured capability “why” | Done |

**Still does not** put `if (businessType === 'PHARMACY')` in Sales/Inventory. Product core is not expanded — satellite payloads only.

## Schema

Migration `034_vertical_extensions_and_offline.sql`:

- `vertical_extension_definitions` — contracts (PHARMACY/SUPERMARKET/RETAIL/RESTAURANT/WHOLESALE seeds; Phase 1 commerce adds BOOKSTORE/STATIONERY/COSMETICS_RETAIL)
- `product_vertical_extensions` — `(org, product, vertical, key)` → JSON payload
- `tenant_offline_config_snapshots` — versioned POS/UI + capabilities checksum
- Phase 1 commerce (`066`): `product_isbn_index (organization_id, isbn, product_id)` — dedicated uniqueness SoT (JSONB ISBN in `book.metadata` alone is not unique-constrained)

Permissions `055_vertical_extensions_mcp_permissions.sql`:

- `vertical-extension:read|update`
- `offline-config:read|publish`
- `mcp:invoke`

Control-plane `071_commerce_profiles_permissions.sql`: `catalog:book.manage`, `catalog:cosmetic.manage`.

## Vertical extensions

Registry validates writes against:

1. Registered `(verticalCode, extensionKey)`
2. Definition status (SUSPENDED/DEPRECATED refused; EXPERIMENTAL warned)
3. `requiredCapabilities` must be ENABLED on ACTIVE tenant config

Commerce Phase 1 contracts (`066`):

| Vertical | Key | Required caps | Payload highlights |
|----------|-----|---------------|--------------------|
| BOOKSTORE | `book.metadata` | BOOKSTORE, ISBN | isbn13, authors[], publisher, edition, language, genre, format, series, pageCount |
| STATIONERY | `stationery.attributes` | STATIONERY | brand, color, size, paperWeight, pages, binding, packQuantity |
| COSMETICS_RETAIL | `cosmetic.attributes` | COSMETICS_RETAIL, COSMETIC_PRODUCT | brand, shade, color, finish, fragrance, size/volume, skinType |
| RETAIL_STORE | `retail.variants` | PRODUCT_VARIANTS | axes[], optionValues — **PARTIAL** (Vague B); no SKU matrix |

HTTP (catalog): `/catalog/books/*`, `/catalog/cosmetics/*`, `PUT /catalog/products/:id/variants` — `@RequiresCapability` + catalog perms.

Returns bridge (Vague B): authorize commercial return → `CreateReturnShipment` when `RETURNS_LOGISTICS` ENABLED and `warehouseId` set.

MCP tools: `bookstore.*`, `cosmetics.*` (permission map + capability gates; mutations via existing CONFIRM/EXECUTE policy).

APIs:

- `GET /business-config/vertical-extensions?verticalCode=`
- `GET/PUT /business-config/products/:productId/extensions`

## Deep POS / UI + offline

- `GET /business-config/pos-configuration/deep` — normalized tenders/receipts/printers/layout + `offlineSnapshotVersion`
- `GET /business-config/ui-configuration/deep`
- `POST /business-config/offline-snapshots/publish`
- `GET /business-config/offline-snapshots[/latest|/:version]`
- Activate auto-publishes an offline snapshot (best-effort)

Checksum: deterministic FNV-1a over configVersion + POS + UI + sorted capabilities.

## Okapi

`GET /business-config/capabilities/:code/explain` returns structured:

```json
{
  "capabilityCode": "FEFO",
  "enabled": true,
  "available": true,
  "status": "AVAILABLE",
  "profileCode": "PHARMACY",
  "summary": "...",
  "reasons": [{ "code": "ENABLED", "message": "..." }],
  "narrative": "Capability FEFO: ENABLED.\\n- [ENABLED] ..."
}
```

Reason codes: `ENABLED`, `DEPENDENCY_MISSING`, `CONFLICT`, `UNSUPPORTED_VERTICAL`, `EXPERIMENTAL`, `SUSPENDED`, `DEPRECATED`, `DISABLED`, `NO_PROFILE`, `NOT_LICENSED`, `NOT_REGISTERED`.

## MCP (`src/modules/mcp`)

HTTP (Nest), not a separate package — same tenancy/RBAC as the rest of the platform.

- `GET /mcp/tools?mutations=false` — catalog
- `POST /mcp/tools/call` `{ "name": "capability_explain", "arguments": { "capabilityCode": "FEFO" } }`

Read tools: context, explain, profiles, capabilities, extensions, offline snapshot, deep POS.  
Mutation tools: draft, capability enable/disable, extension upsert, offline publish — all go through existing use cases (safe-disable, expectedVersion, capability gates).

Permission: `mcp:invoke`.

## Gap register (post–Vague 3 / Vague 5)

| Gap | Wave | Note |
|-----|------|------|
| Migrate pharma columns off `products` into extensions | **5 DONE** | `039` drop + create/update dual-write + read hydrate; hot-path flags stay |
| Full JSON Schema validation library | later | Lightweight property checks today |
| Stdio MCP transport for Cursor | optional | HTTP `/mcp` first |
| HOTEL / CLINIC / HOSPITAL packs + marketplace | 4 DONE | See [PACKS-V4.md](./PACKS-V4.md) |
| SurrealDB | **N/A** | Explicit non-goal — PostgreSQL only |
