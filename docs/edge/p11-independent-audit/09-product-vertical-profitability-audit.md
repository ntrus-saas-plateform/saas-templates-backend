# 09 — Audit profitabilité produit / verticale (P11)

| Champ | Valeur |
|-------|--------|
| API | `POST edge/revenue/product-profitability/snapshots` |
| Permission | `platform:business:metrics:manage` |
| Verdict | Règles qualité **PASS E3** ; attribution coûts **limitée** |

## Règles use-case (E3)

`revenue.use-cases.ts` :

- `revenueDataQuality` **doit** être `MEASURED`
- Coûts : MEASURED | ESTIMATED | UNAVAILABLE
- Si coûts UNAVAILABLE → `contributionMargin` null + flag `contributionMarginNullBecauseCostsUnavailable`
- Interdit coût non-null avec UNAVAILABLE

Table : `edge_p11_product_profitability_snapshots` (migration 122).

## Gaps

| ID | Sévérité | Gap |
|----|----------|-----|
| F-P11-021 | P2 | Pas de moteur d’attribution coûts automatique depuis finance/P&L |
| F-P11-011 | P1 | Section console profitabilité produit ABSENT (~12 absentes) |
| F-P11-008 | P1 | Pas de prorata / multi-year / discounts dans marge |

## Verdict

Contrat « ne pas inventer la marge » **respecté**. Profitabilité verticale enterprise **non livrée** (ingestion manuelle snapshots + UI absente).
