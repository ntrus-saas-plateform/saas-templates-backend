# 08 — Audit rétention & customer economics (P11)

| Champ | Valeur |
|-------|--------|
| Source | `retention-calculator.ts` + use-cases retention snapshots |
| Verdict GRR/NRR | **PASS E2** formules ; customer economics **partiel** |

## GRR — PASS E2

- Formule : `(starting − contraction − churned) / starting`
- Expansion **exclue** (notes + specs `excludes expansion`)
- Inputs null → pct null (UNAVAILABLE), pas zéro silencieux

## NRR — PASS E2

- Inclut expansion ; reactivation expansion-like par défaut (`includeReactivationInNrr`)
- Specs : inclusion/exclusion reactivation, missing → null

## Application

`revenue.use-cases.ts` `createRetentionSnapshots` persiste GRR/NRR avec `dataQuality` MEASURED|UNAVAILABLE selon pct.

API : `GET edge/revenue/retention`, `POST edge/revenue/retention/snapshots`.

## Customer economics

| Capacité | Statut | Evidence |
|----------|--------|----------|
| Cohorts table | SCHEMA | `edge_p11_revenue_cohorts` |
| Customer profitability snapshots | SCHEMA + possible write path | `edge_p11_customer_profitability_snapshots` |
| Logo churn calculator | **ABSENT** | Registry only → [F-P11-009](./34-findings-and-risk-register.md) |
| Cohort UI | ABSENT console | [F-P11-011](./34-findings-and-risk-register.md) |

## Frontend

Onglet Retention : fallback overview GRR/NRR si endpoint échoue (`edge-revenue-module.tsx`) — honnête sur UNAVAILABLE ; pas de fabrication.

## Verdict

Formules rétention **certifiables au niveau unitaire**. Customer economics / logo churn / cohorts E2E **non certifiés**.
