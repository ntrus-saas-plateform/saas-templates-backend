# 13 — API contracts & RBAC

Controller: `revenue-operations.controller.ts`

| Method | Path | Permission |
|--------|------|------------|
| GET | `edge/revenue/overview` | `platform:revenue:read` |
| GET | `edge/revenue/metrics/definitions` | `platform:revenue:read` |
| POST | `edge/revenue/metrics/definitions` | `platform:business:metrics:manage` |
| POST | `edge/revenue/metrics/definitions/:id/publish` | `platform:business:metrics:manage` |
| POST | `edge/revenue/metrics/snapshots` | `platform:business:metrics:manage` |
| POST | `edge/revenue/mrr/compute` | `platform:revenue:read` |
| POST | `edge/revenue/forecasts` (+ scenarios) | `platform:revenue:forecast` |
| POST | `edge/revenue/leakage-cases` (+ transition) | `platform:revenue:reconcile` |
| POST/GET | `edge/revenue/commission/*` | commission calculate/read |
| GET/POST | `edge/business/audit` | `platform:business:governance:manage` |
| GET | `edge/business/overview` | `platform:business:read` |

BFF: `/api/edge-backend/revenue/*`, `/api/edge-backend/business/*`, optional `/api/edge-backend/commission/*` aliases on FE client.
