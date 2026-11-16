# P9.1 — Service Catalog

## Scope

Canonical operational catalog of Edge platform services with ownership and dependencies.

## Persistence

Migration `115_edge_p9_service_catalog.sql`:

- `edge_p9_services`
- `edge_p9_service_dependencies`
- `edge_p9_service_activity`

## Observation honesty

`observation_status` ∈ CONFIGURED | DISCOVERED | OBSERVED | VERIFIED | UNAVAILABLE | UNKNOWN  

Promotion to **VERIFIED** requires `metadata.verificationSource`.

## API

| Method | Path | Permission |
|--------|------|------------|
| GET | `edge/operations/services` | `platform:service_catalog:read` |
| POST | `edge/operations/services` | `platform:service_catalog:manage` |
| GET | `edge/operations/services/:id` | `platform:service_catalog:read` |
| PATCH | `edge/operations/services/:id` | `platform:service_catalog:manage` |
| POST | `edge/operations/services/:id/dependencies` | `platform:service_catalog:manage` |
| DELETE | `edge/operations/services/:id/dependencies` | `platform:service_catalog:manage` |
| GET | `edge/operations/overview` | `platform:operations:overview:read` |

Overview (P9.1) returns catalog counts only; incidents/alerts marked `UNAVAILABLE`.

## Console

`/edge/operations` — list, register, overview honesty banners.
