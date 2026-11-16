# 06 — Audit calcul MRR / ARR (P11)

| Champ | Valeur |
|-------|--------|
| Source | `domain/revenue-operations/mrr-calculator.ts` |
| Tests | `mrr-calculator.spec.ts` |
| Verdict partiel | **PASS E2** sur normalisation ; gaps dérivation mouvements |

## Règles vérifiées (E2)

| Règle | Résultat | Evidence spec |
|-------|----------|---------------|
| MONTHLY as-is | PASS | `keeps monthly amounts as-is` |
| ANNUAL/YEARLY ÷ 12 | PASS | `divides annual/yearly by 12` |
| QUARTERLY ÷ 3 | PASS | `divides quarterly by 3` |
| WEEKLY × (52/12) | PASS (code) | `normalizeToMonthlyMrr` |
| OTHER → NaN (pas d’assumption silencieuse) | PASS | `returns NaN for unsupported periods` |
| Empty input → UNAVAILABLE not zero | PASS | `returns UNAVAILABLE (not zero) for empty input` |
| Free trials exclus par défaut | PASS | specs dédiées |
| ARR = MRR_ENDING × 12 (bucket) | PASS E3 | `mrr-calculator.ts` résultat `arrEnding` |

## `isCollectedEligible`

```typescript
return String(paymentStatus ?? '').toUpperCase() === 'PAID';
```

**PASS E2** — unpaid/pending/undefined ≠ collected. **Ne constitue pas** un moteur COLLECTED_REVENUE ([F-P11-001](./34-findings-and-risk-register.md)).

## Gaps

| ID | Sévérité | Gap |
|----|----------|-----|
| F-P11-006 | P1 | Expansion/contraction requièrent `movementType` pré-classifié ; scénario 100→150 non testé comme dérivation |
| F-P11-007 | P1 | Pas de FX / multi-currency consolidation |
| F-P11-008 | P1 | Pas de discounts, refunds, prorata, multi-year amortization dans le calculateur |
| F-P11-005 | P1 | Live adapter ne produit pas les buckets mouvement riches |

## Verdict

Calculateur pur MRR/ARR : **solide E2** pour normaliser et agréger lignes déjà classifiées. **Non certifié** comme moteur de mouvement SaaS end-to-end sans dérivation et pack tests 1–25 ([F-P11-002](./34-findings-and-risk-register.md)).
