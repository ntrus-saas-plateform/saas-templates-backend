# P11 — SaaS Business & Revenue Operations · Implementation summary

**Status :** PARTIALLY IMPLEMENTED  
**Date :** 2026-11-16  
**Branche :** `feature/console`  
**Migrations :** `122_edge_p11_revenue_operations_foundation.sql` + `123_edge_p11_alerts_unit_econ_renewal.sql`

## Scope

| Domaine | État |
|---------|------|
| Migration 122 (permissions + tables) | **DONE** |
| Migration 123 (alert policies, unit econ, mandate-named alerts/decisions/reports) | **DONE** |
| Domain calculators (MRR, retention, assurance, unit-econ, renewal, forecast helpers) | **DONE** |
| Application use cases (metrics, overview, MRR, forecast, leakage, commission, unit-econ, alerts, targets, reports) | **DONE** |
| Infra `PgRevenueRepository` + live/stub projection + assurance adapter | **DONE** (partial OK) |
| Presentation controller `edge/revenue/**` + `edge/business/**` + auth matrix | **DONE** |
| Mandate-named docs 03/06–26 stubs | **DONE** (existing differently-named files retained) |
| Frontend console `/edge/revenue` | **DONE** (MVP) |
| FE vitest + Playwright smoke | **DONE** |

## Hard rules (non-negotiable)

1. P11 is **READ/ANALYTICS + workflows** for commissions / forecasts / risks / alerts.
2. **NEVER** create invoices, payments, subscriptions, or tenants.
3. **No duplicate ledger** — soft refs to P5/P6 only.
4. **contracted ≠ invoiced ≠ collected**.
5. **GRR excludes expansion**.
6. Every metric snapshot must include `definition_version`, `source_provenance`, `data_quality` (`MEASURED|ESTIMATED|UNAVAILABLE`), `currency`, `as_of`.
7. Missing snapshots → `UNAVAILABLE` (not silent zero). Never invent financial amounts or costs as production truth.

## Permissions

- `platform:business:read|manage|planning|targets:manage|reports:manage|metrics:manage|governance:manage`
- `platform:revenue:read|forecast|approve|reconcile|export`
- `platform:commission:read|calculate|approve`

## Outbox

Tenant constant: `edge-p11-revenue-operations` (`EDGE_P11_OUTBOX_TENANT`).

## Deferred

Full forecast models, FX/multi-market rollups, partner payouts, Testcontainers, live P6 recognition, rich commission inventory APIs — see `22` and verdict in `26`.
