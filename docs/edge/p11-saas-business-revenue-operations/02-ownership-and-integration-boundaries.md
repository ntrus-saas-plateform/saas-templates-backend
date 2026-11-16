# 02 — Ownership & integration boundaries

## What P11 owns

- Metric definition registry & published versions
- Metric / profitability / commercial performance **snapshots** (analytics store)
- Revenue targets, forecasts, scenarios
- Revenue risks, leakage cases, reconciliations, anomalies
- Commission plans, rules, accruals, **immutable** calculations & approvals
- Partner performance snapshots, cohorts / retention snapshots
- Business periods, reports, decisions, actions, alerts, audit, idempotency

## What P11 must NEVER do

| Forbidden | Owner |
|-----------|--------|
| Create/update invoices or payment intents | P6 |
| Create/collect payments or store payment credentials | P6 |
| Create/modify subscriptions or entitlements | P5 |
| Provision or mutate tenants / IAM | P7/P8 |
| Invent product prices or commercial plans | P1/P2 |
| Seed fake financial amounts as production truth | — |

## Soft references only

P11 stores UUID **refs** such as:

- `subscription_ref_id` (P5)
- `invoice_ref_id` / payment refs in provenance (P6)
- `product_ref_id` / `commercial_plan_ref_id` (P1/P2)
- `customer_account_ref_id` / `commercial_account_ref_id`

No hard FKs into P5/P6 operational tables in migration 122.

## Integration direction

```
P5 subscription lines ──projection──▶ P11 MRR calculator / snapshots
P6 invoice/payment refs ──provenance──▶ P11 INVOICED/COLLECTED/RECEIVABLES snapshots
P11 ──✗──▶ never writes back invoices/subscriptions/tenants
```

Projection input port defaults to a **stub** returning `[]` → overview/metrics stay `UNAVAILABLE` until a real adapter is wired.
