# 17 — Audit devise & géographie (P11)

| Champ | Valeur |
|-------|--------|
| FX engine | **ABSENT** |
| Verdict | **FAIL** capacités multi-market |

## Evidence

- `normalizeToMonthlyMrr` / MRR calculator : filtre `currency` optionnel ; skip autres devises (`skippedLineCount`) — **pas de conversion**.
- Registry : `currencyTreatment: NATIVE | CONVERT_TO_REPORTING | UNITLESS` — `CONVERT_TO_REPORTING` **déclaratif seulement**.
- Live projection : skip si currency mismatch.
- Tables snapshots : `currency VARCHAR(3)` natif.

| ID | Sévérité | Gap |
|----|----------|-----|
| **F-P11-007** | P1 | Aucun moteur FX / taux historiques / rollup reporting currency |
| F-P11-029 | P2 | Pas de dimensions géographie / market pack UI |
| F-P11-011 | P1 | Section currency/market reporting absente console |

## Verdict

Multi-currency enterprise **non prêt**. Risque de totaux mono-devise présentés comme globaux si opérateurs agrègent mal.
