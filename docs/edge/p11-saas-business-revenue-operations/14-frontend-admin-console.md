# 14 — Frontend admin console

## Surfaces

| File | Role |
|------|------|
| `types/edge-revenue-operations.ts` | FE types |
| `lib/api/edge.ts` section P11 | API client |
| `components/edge/revenue-operations/edge-revenue-module.tsx` | Tabbed UI |
| `app/(edge-console)/edge/revenue/page.tsx` | Route |
| `edge-shell.tsx` | Nav Revenue |

## Tabs

Overview | Metrics | MRR | Retention | Forecasts | Assurance | Commissions | Reports

## UX rules

- Show MEASURED / ESTIMATED / UNAVAILABLE badges
- Overview UNAVAILABLE → `EdgeEmptyState` (never invent numbers)
- Publish metric affordance when `platform:business:metrics:manage`
