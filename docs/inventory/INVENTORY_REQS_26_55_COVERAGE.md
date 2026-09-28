# Inventory / platform ops coverage — Requirements 26–55

Status after migrations `026_inventory_ops_depth`, `027_platform_ops_depth`, and control-plane `050_inventory_ops_depth_permissions`.

| # | Capability | Status | Primary surfaces |
|---|------------|--------|------------------|
| 26 | Counts depth | **Done** (prior) | `inventory_count_sessions` extras; count APIs |
| 27 | Freeze ops matrix | **Done** (prior) | `inventory_freezes.allowed_ops` / `forbidden_ops` |
| 28–29 | Quarantine / QM | **Done** (prior) | `quality_inspections`, NC, CAPA tables |
| 30 | Recall engine | **Done** (prior) | `product_recalls` extended + recall use-cases |
| 31 | Genealogy | **Done** (prior) | `stock_lot_links` |
| 32 | Expiration policies | **Done** (prior) | `expiration_policies` |
| 33 | Storage capabilities | **Done** (prior) | location humidity/cold/secure + product storage JSON |
| 34 | Cold chain | **Done** (prior) | sensors / readings / excursions |
| 35–37 | Dormant / overstock / stockout | **Done** (prior) | `inventory_analytics_snapshots` |
| 38–39 | Replenishment / forecast | **Done** | projected position + safety stock; `DemandForecastProviderPort` (ML-decoupled) |
| 40 | Valuation layers | **Done** | `stock_cost_layers` / `stock_cost_history` |
| 41 | Pricing cost / institutional | **Done** | `cost_price`, `margin_pct`, `institutional_price`; list type `INSTITUTIONAL` |
| 42 | Alerts | **Done** | definitions + alerts APIs; `evaluate`; outbox `inventory.alert.raised.v1` |
| 43–44 | Workflow approval context | **Done** | `ApprovalContext` quantity/category/controlled/location/risk |
| 45 | Scanner resolve | **Done** | `POST /inventory/scanner/resolve` + `scanner.resolve.ts` |
| 46 | Import harden | **Done** | VALIDATED/APPROVED gate; `approved_by`; `source_format`; no skip validation |
| 47–48 | Reports / KPIs | **Done** | `/inventory/reports/*`, `/inventory/analytics/kpis` |
| 49 | Audit tamper-evident | **Done** | `prev_hash` / `row_hash` on control-plane audit_logs |
| 50 | Domain events | **Done** | count/freeze/quarantine/recall/expiration/alert/valuation in catalog |
| 51 | Event-driven | **Done** | outbox consumers; no cross-module stock coupling |
| 52 | Transactional outbox | **Done** | existing outbox + retries/DLQ (shared messaging) |
| 53 | Idempotency-Key | **Done** | RECEIVE/TRANSFER/ADJUST/RESERVE/COUNT_POST/DISPOSE/ALLOCATE |
| 54 | Concurrency | **Done** | lot `version` + `FOR UPDATE` + forbidNegative policy |
| 55 | Invariants | **Done** | `docs/inventory/INVENTORY_INVARIANTS.md` + coded engines |

## Migrations

- `migrations/tenant/026_inventory_ops_depth.sql`
- `migrations/tenant/027_platform_ops_depth.sql`
- `migrations/control-plane/050_inventory_ops_depth_permissions.sql`

## Key API routes (41–48)

- `POST /inventory/scanner/resolve`
- `GET|POST /inventory/alerts/definitions`
- `GET /inventory/alerts`
- `POST /inventory/alerts/evaluate`
- `POST /inventory/alerts/:id/ack`
- `GET /inventory/reports/stock|operations|pharma|financial`
- `GET|POST /inventory/analytics/kpis`
