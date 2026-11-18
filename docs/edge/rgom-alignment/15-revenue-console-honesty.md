# 15 — Revenue console honesty (E10)

**Statut :** ACTIVE — scopes documentés (≠ claim 30/30 sections)

## Principe

UNAVAILABLE ≠ 0. MEASURED cash uniquement avec lignée P6 / engine (`assertCashMetricSnapshotProvenance`).

## Sections console FE (`EdgeRevenueModule`) — PRESENT

| Tab | Permission | Scope |
|-----|------------|-------|
| Overview | `platform:revenue:read` | Snapshots stockés ; pas de totaux inventés |
| Metrics | `platform:revenue:read` | Definitions + snapshots |
| MRR | `platform:revenue:read` | `POST …/mrr/compute` |
| Cash | `platform:revenue:read` | `POST …/cash/compute` (engine) |
| Retention | `platform:revenue:read` | GRR exclut expansion ; NRR inclut |
| Forecasts | `platform:revenue:forecast` | Named PRUDENT/CENTRAL/AMBITIEUX = ESTIMATED |
| Renewals | `platform:revenue:read` | Intelligence read-only P5 |
| Assurance | `platform:revenue:reconcile` | Leakage / scan |
| Commissions | `platform:commission:calculate` | Calc ≠ payout |
| Alerts / Targets / Reports | business:* | PARTIAL vs mandat 30 sections |

## Explicitement ABSENT / API_ONLY (pas de faux dashboard)

- Executive / Marketing / Sales / CS / Billing **role dashboards** dédiés 30/30 — non livrés ; Overview revenue est le beachhead.
- Partner payout treasury UI — hors calc/approve.
- FX / multi-year / discounts full pack — hors beachhead.

## Preuve tests

```bash
pnpm exec vitest run src/modules/edge/domain/revenue-operations
```
