# 27 — Audit performance & fiabilité (P11)

| Champ | Valeur |
|-------|--------|
| Gate G | **FAIL** |
| Load tests | **Non exécutés** |

## Observations code (E3) — risques perf

| Observation | Risque | ID |
|-------------|--------|-----|
| Live projection `limit: 500` ACTIVE subs | Sous-couverture / pagination absente | F-P11-020 P2 |
| Overview agrège snapshots SQL | OK pour MVP ; pas de preuve latence p95 | F-P11-015 P1 |
| Evaluate alerts / assurance scans | Pas de budgets timeout/load | F-P11-015 P1 |
| Idempotency keys table | Structure OK ; chaos/retry E4 absent | F-P11-023 P2 |

## Non exécuté

- Load / soak / stress
- SLO error budget
- Chaos dependency P5/P6 down

## Verdict

**FAIL** fiabilité enterprise. Aucune preuve quantitative cet audit.
