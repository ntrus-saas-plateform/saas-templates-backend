# 27 — Vague 2 cash engine (INVOICED / COLLECTED / RECEIVABLES)

Closes **F-P11-001** code path (executable engines + provenance gate). Does **not** auto-certify P11 ACCEPTED (Gate A push + lab packs still open).

## Calculator

- Domain: `cash-revenue-calculator.ts`
- Use case: `ComputeCashRevenueUseCase`
- HTTP: `POST /api/v1/edge/revenue/cash/compute` (`platform:revenue:read`)
- Loads P6 via `listInvoicesForExport` / `listPaymentIntentsForExport` when refs not supplied

## Rules

| Metric | Source | Eligibility |
|--------|--------|-------------|
| `INVOICED_REVENUE` | Issued invoices | ISSUED / PARTIALLY_PAID / PAID / OVERDUE / DISPUTED |
| `COLLECTED_REVENUE` | Succeeded payments | SUCCEEDED (or PAID) only — never unpaid |
| `RECEIVABLES` | Open invoice balances | ISSUED / PARTIALLY_PAID / OVERDUE / DISPUTED |

Empty feeds → `UNAVAILABLE` (never silent MEASURED zero).

## Snapshot gate

`RecordMetricSnapshotUseCase` rejects `INVOICED_REVENUE` / `COLLECTED_REVENUE` / `RECEIVABLES` unless:

```json
{ "source": "engine" }
```

or `calculator: "cash-revenue-calculator"`.

Persisted engine snapshots always set both.
