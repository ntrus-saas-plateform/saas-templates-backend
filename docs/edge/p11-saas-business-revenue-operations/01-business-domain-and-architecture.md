# 01 — Business domain & architecture

## Bounded context

**SaaS Business & Revenue Operations (P11)** owns analytics, planning, commission workflows, leakage/reconciliation cases, and business governance over revenue metrics. It does **not** own commercial SoT (P2), subscriptions (P5), or billing/cash (P6).

## Hexagonal layout

```
presentation/  revenue-operations.controller.ts  → edge/revenue/** , edge/business/**
application/   revenue.use-cases.ts
domain/        revenue-operations/*
infrastructure/revenue-operations/pg-revenue.repository.ts
               stub-revenue-projection.adapter.ts
```

## Aggregates (foundation)

| Aggregate | Role |
|-----------|------|
| MetricDefinition (+ versions) | Versioned metric formulas; immutable published copies |
| MetricSnapshot | Point-in-time measured/estimated/unavailable values |
| RevenueForecast (+ scenarios/snapshots) | Planning; immutable after PUBLISHED |
| LeakageCase | DETECTED…CLOSED lifecycle |
| CommissionPlan / Calculation | Plans + immutable calculation snapshots |
| BusinessAuditEvent | Durable P11 audit trail |

## Data quality contract

Every stored metric/forecast/profitability snapshot carries:

- `definition_version`
- `source_provenance` (JSONB)
- `data_quality` ∈ `MEASURED | ESTIMATED | UNAVAILABLE`
- `currency`
- `as_of`

`UNAVAILABLE` ⇒ `value IS NULL`. Overview APIs never fabricate zeros.

## MRR engine

Pure domain `mrr-calculator.ts`:

- Annual → monthly `/12`
- Optional free-trial exclusion
- Unpaid never equals collected (collection is P6 `COLLECTED_REVENUE`)
