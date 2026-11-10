# P7.3 — API Contract

Base prefix: `/api/v1` (global Nest prefix). Controllers:

- `EdgePlacementController` → `@Controller('edge/placement')`
- `EdgeCapacityController` → `@Controller('edge/capacity')`

## Placement

| Method | Path | Permission | Notes |
|--------|------|------------|-------|
| GET | `/edge/placement/requests` | `platform:placement:read` | Pagination `limit` 1–100 |
| POST | `/edge/placement/requests` | `platform:placement:request` | **Idempotency-Key** header or body required. Commercial identity copied from P7.1 auth view — body must not supply account/product/subscription |
| GET | `/edge/placement/requests/:id` | `platform:placement:read` | |
| POST | `/edge/placement/requests/:id/evaluate` | `platform:placement:evaluate` | Runs placement engine; on `PLACED` holds capacity (`HELD`) |
| POST | `/edge/placement/requests/:id/confirm` | `platform:placement:confirm` | `HELD` → `COMMITTED`. **No P7.4 workflow** |
| POST | `/edge/placement/requests/:id/cancel` | `platform:placement:cancel` | Releases HELD reservations atomically |
| POST | `/edge/placement/requests/:id/re-evaluate` | `platform:placement:evaluate` | Supersedes prior decisions then evaluates |
| GET | `/edge/placement/decisions/:id` | `platform:placement:read` | |
| GET | `/edge/placement/decisions/:id/candidates` | `platform:placement:read` | |
| GET | `/edge/placement/history` | `platform:placement:read` | |
| GET/POST/PATCH | `/edge/placement/policies` | `platform:placement_policy:read` / `:manage` | |

## Capacity

| Method | Path | Permission |
|--------|------|------------|
| GET/POST/PATCH | `/edge/capacity/inventory` | `platform:capacity:read` / `:manage` |
| GET | `/edge/capacity/reservations` | `platform:capacity:read` |
| GET | `/edge/capacity/reservations/:id` | `platform:capacity:read` |
| POST | `/edge/capacity/reservations/:id/release` | `platform:capacity:release` |
| POST | `/edge/capacity/reservations/:id/expire` | `platform:capacity:release` |

## Validation

- Global `ValidationPipe`: whitelist + forbidNonWhitelisted + transform.
- DTOs: `src/modules/edge/presentation/dto/placement.dto.ts`.
- PATCH DTOs require `expectedVersion` (optimistic concurrency).
