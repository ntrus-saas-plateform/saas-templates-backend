# 19 — API Contracts (P8)

Base : `/api/edge/...` (proxifié frontend `/api/edge-backend/...`).

## Registry

| Method | Path | Permission |
|---|---|---|
| GET | `edge/tenants` | `platform:tenant_management:search` |
| GET | `edge/tenants/:id` | `...:read` |
| GET | `edge/tenants/:id/360` | `...:read` |
| POST | `edge/tenants` | `...:register` |
| POST | `edge/tenants/sync-from-p7` | `...:register` |
| PATCH | `edge/tenants/:id` | `...:update_metadata` |
| POST | `edge/tenants/:id/owner` | `...:assign_owner` |
| POST/DELETE | `edge/tenants/:id/tags` | `...:manage_tags` |
| POST | `edge/tenants/:id/notes` | `...:update_metadata` |
| GET | `edge/tenants/:id/activity` | `...:audit:read` |
| POST | `edge/tenants/:id/lifecycle-requests` | `...:lifecycle:request` |

## Governance hub

| Method | Path | Permission |
|---|---|---|
| GET/POST approve/reject | `edge/tenant-management/lifecycle-requests...` | lifecycle:request/approve |
| GET/POST approve/revoke/expire | `edge/tenant-management/exceptions...` | exception:* |
| GET/POST approve/reject | `edge/tenant-management/migrations...` | migration:* |
| GET/POST approve/reject | `edge/tenant-management/recoveries...` | recovery:* |
| GET/POST approve/reject | `edge/tenant-management/terminations...` | termination:* |
| POST/GET | `edge/tenant-management/reconciliation/runs\|findings` | reconciliation:execute |
| GET | `edge/tenant-management/analytics/portfolio` | analytics:read |

## Conventions

- Idempotency-Key sur commandes sensibles
- Correlation ID (généré si absent)
- Optimistic locking `expectedVersion` sur PATCH metadata
- Erreurs DomainError standard Edge
- Aucun secret dans les réponses
