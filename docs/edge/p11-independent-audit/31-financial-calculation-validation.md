# 31 — Validation des calculs financiers (P11)

| Champ | Valeur |
|-------|--------|
| Gate C | **FAIL** |
| Gate D | **FAIL** |
| Verdict | Îlots E2 PASS ; pack mandaté FAIL |

## Matrice de validation adversarial

| Contrôle | Résultat | Niveau | Evidence |
|----------|----------|--------|----------|
| MRR monthly/annual normalize | **PASS** | E2 | `mrr-calculator.spec.ts` |
| GRR exclut expansion | **PASS** | E2 | `retention-calculator.spec.ts` |
| NRR inclut expansion | **PASS** | E2 | idem |
| UNAVAILABLE ≠ silent zero | **PASS** | E2 | MRR empty, GRR/NRR null inputs, forecast <2 pts |
| `isCollectedEligible` PAID only | **PASS** | E2 | guard only |
| Executable COLLECTED from P6 | **FAIL** | E3 | registry + guard ; **no calculator** → **F-P11-001** |
| Executable INVOICED from P6 | **FAIL** | E3 | **F-P11-001** |
| Expansion derivation 100→150 | **FAIL** | E2/E3 | pré-classifié requis → **F-P11-006** |
| Logo churn calculator | **FAIL** | E3 | **F-P11-009** |
| FX / discounts / refunds / prorata / multi-year | **FAIL** | E3 | **F-P11-007**, **F-P11-008** |
| Live projection movement fidelity | **FAIL** | E3 | STARTING/ENDING + UNKNOWN → **F-P11-004/005** |
| Pack tests financiers 1–25 | **FAIL** | — | **NOT executed** → **F-P11-002** |
| E2E 1–45 | **FAIL** | — | **NOT executed** → **F-P11-002** |

## Risque exécutif (P0)

Si un administrateur injecte des snapshots `COLLECTED_REVENUE` / `INVOICED_REVENUE` via API metrics sans lignée P6, les dashboards Overview/Reports peuvent présenter des montants **non assurés** comme vérité — **F-P11-001**.

## Verdict

**Cannot certify financial accuracy.** Corrections required before any ACCEPTED claim.
