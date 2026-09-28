# Inventory API Spec

Base prefix: `/api/v1`  
Auth: Bearer JWT (staff). Module gate: `inventory` or `organizations` as noted.

## Existing inventory routes

See Discovery doc. Keep as-is; add Idempotency-Key header support on mutating commands.

### Idempotency-Key (Phase 2)

Header: `Idempotency-Key: <string ≤128>`  
Applies to: `POST /inventory/receive`, `/transfers`, `/adjustments`, `/reserve`  
Behavior: same key + same payload hash → replay stored response (200/201); same key + different payload → `409 CONFLICT`.

## Org-ops location APIs (Phase 2)

Under `organizations/:organizationId`:

| Method | Path | Permission |
|--------|------|------------|
| GET | `/warehouses/:warehouseId/zones` | `organizations:read` |
| POST | `/warehouses/:warehouseId/zones` | `organizations:update` |
| PATCH | `/warehouses/:warehouseId/zones/:zoneId` | `organizations:update` |
| DELETE | `/warehouses/:warehouseId/zones/:zoneId` | `organizations:update` |
| GET | `/warehouses/:warehouseId/locations` | `organizations:read` |
| POST | `/warehouses/:warehouseId/zones/:zoneId/locations` | `organizations:update` |
| PATCH | `/warehouses/:warehouseId/locations/:locationId` | `organizations:update` |
| DELETE | `/warehouses/:warehouseId/locations/:locationId` | `organizations:update` |

Optional inventory alias (Phase 2+): `GET /inventory/locations?warehouseId=` for pickers (read-only).

## Policies (Phase 2)

| Method | Path | Permission |
|--------|------|------------|
| GET | `/inventory/policies` | `inventory:read` |
| PUT | `/inventory/policies` | `inventory:adjust` |

Query: `organizationId` required (or from active org context).

## Cycle counts (Phase 2)

| Method | Path | Permission |
|--------|------|------------|
| POST | `/inventory/counts` | `inventory:adjust` |
| GET | `/inventory/counts` | `inventory:read` |
| GET | `/inventory/counts/:id` | `inventory:read` |
| POST | `/inventory/counts/:id/start` | `inventory:adjust` |
| POST | `/inventory/counts/:id/lines` | `inventory:adjust` |
| POST | `/inventory/counts/:id/complete` | `inventory:adjust` |
| POST | `/inventory/counts/:id/post` | `inventory:adjust` |
| POST | `/inventory/counts/:id/cancel` | `inventory:adjust` |

## Error codes (domain)

| Code | When |
|------|------|
| `INSUFFICIENT_STOCK` | Reserve/allocate/transfer exceeds available |
| `LOT_EXPIRED` / `LOT_RECALLED` | Allocation blocked |
| `LOCATION_INCOMPATIBLE` | Product requirements vs location capabilities |
| `IDEMPOTENCY_CONFLICT` | Key reused with different body |
| `COUNT_ALREADY_CLOSED` | Illegal transition |
| `FREEZE_ACTIVE` | Mutation blocked by count freeze |
| `APPROVAL_REQUIRED` | Policy threshold (future wiring) |

## Pagination

List endpoints: `page`, `limit`, stable `ORDER BY created_at DESC, id`.
