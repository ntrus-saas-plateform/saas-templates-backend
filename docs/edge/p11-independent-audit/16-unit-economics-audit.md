# 16 — Audit unit economics (P11)

| Champ | Valeur |
|-------|--------|
| Domain | `unit-economics-calculator.ts` |
| Table | `edge_revenue_unit_economics_snapshots` (123) |
| API | `POST edge/revenue/unit-economics/snapshots` |
| Verdict | Calculateur pur **PASS E2** ; données d’entrée **externes/manuelles** |

## Comportement (E2)

Specs :

- CAC/LTV/payback quand inputs présents → MEASURED
- spend null / customers 0 → UNAVAILABLE (pas de ratio inventé)

## Persistance

`pg-revenue.repository.ts` INSERT `edge_revenue_unit_economics_snapshots` avec champs `*_data_quality` séparés.

## Gaps

| ID | Sévérité | Gap |
|----|----------|-----|
| F-P11-028 | P2 | Pas d’ingestion automatique marketing spend / COGS |
| F-P11-011 | P1 | Section unit economics console absente |
| F-P11-007 | P1 | Pas de FX pour LTV multi-currency |

## Verdict

Math unit economics **honnête**. Pipeline données enterprise **FAIL**.
