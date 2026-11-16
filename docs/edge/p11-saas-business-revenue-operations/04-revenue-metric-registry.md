# 04 — Revenue metric registry

Canonical codes live in `src/modules/edge/domain/revenue-operations/revenue-metric-registry.ts`.

| Code | Name | Notes |
|------|------|-------|
| `MRR_ENDING` | Ending MRR | Active at period end; annual `/12` |
| `MRR_NEW` | New MRR | First paid activation |
| `MRR_EXPANSION` | Expansion MRR | Upsell / seats |
| `MRR_CONTRACTION` | Contraction MRR | Downgrade magnitude |
| `MRR_CHURNED` | Churned MRR | Cancelled/expired recurring |
| `MRR_REACTIVATION` | Reactivation MRR | Returned payers |
| `MRR_NET_NEW` | Net New MRR | New+Exp+Re − Con − Churn; any UNAVAILABLE component ⇒ UNAVAILABLE |
| `ARR_ENDING` | Ending ARR | `MRR_ENDING × 12` |
| `GRR` | Gross Revenue Retention | Ratio vs starting MRR |
| `NRR` | Net Revenue Retention | Includes expansion |
| `LOGO_CHURN` | Logo Churn Rate | Customer logos |
| `SUBSCRIPTION_CHURN` | Subscription Churn Rate | Per subscription |
| `INVOICED_REVENUE` | Invoiced Revenue | P6 issued totals (not cash) |
| `COLLECTED_REVENUE` | Collected Revenue | Succeeded payments only — **never unpaid** |
| `RECEIVABLES` | Open Receivables | AR open items as-of |

## Rules

1. Human definitions are authoritative; code formulas mirror them.
2. Missing sources → `data_quality=UNAVAILABLE`, `value=null` — **never silent zero**.
3. Snapshots require a **PUBLISHED** metric definition (`RecordMetricSnapshotUseCase`).
4. Publishing creates an immutable row in `edge_p11_metric_definition_versions`.
