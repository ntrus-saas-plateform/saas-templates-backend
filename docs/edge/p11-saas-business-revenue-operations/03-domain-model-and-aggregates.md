# 03 — Domain model & aggregates

## Aggregates (migration 122)

| Aggregate | Persistence | Notes |
|-----------|-------------|-------|
| BusinessUnit | `edge_p11_business_units` | Hierarchy via parent_unit_id |
| RevenueStream | `edge_p11_revenue_streams` | Soft product/plan refs |
| MetricDefinition (+ Version) | `edge_p11_metric_definitions` / `_versions` | Publish → immutable version row |
| MetricSnapshot | `edge_p11_metric_snapshots` | value NULL iff UNAVAILABLE |
| RevenueTarget / Forecast / Scenario / ForecastSnapshot | planning tables | Forecast immutable after PUBLISHED |
| RevenueRisk / LeakageCase / Reconciliation / Anomaly | assurance | Soft P5/P6 UUID refs only |
| CommissionPlan / Rule / Accrual / Calculation / Approval | commission | Calculations immutable |
| Cohort / RetentionSnapshot | retention | GRR excludes expansion |
| Profitability / Commercial performance snapshots | analytics | Not a ledger |
| BusinessAuditEvent / Idempotency | governance | Durable audit |

## Invariants

1. **No duplicate ledger** — P11 stores analytics snapshots and workflow cases; cash/invoice SoT remains P6; subscriptions remain P5.
2. **contracted ≠ invoiced ≠ collected** — never collapse these into one amount field.
3. **GRR excludes expansion** (and reactivation).
4. Missing source → `data_quality=UNAVAILABLE`, `value=null`.
