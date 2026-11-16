# 04 — Audit registry métriques (P11)

| Champ | Valeur |
|-------|--------|
| Source | `domain/revenue-operations/revenue-metric-registry.ts` |
| Verdict | Registry **canonique présent** ; exécution inégale |

## Codes canoniques (E3)

`MRR_ENDING`, `MRR_NEW`, `MRR_EXPANSION`, `MRR_CONTRACTION`, `MRR_CHURNED`, `MRR_REACTIVATION`, `MRR_NET_NEW`, `ARR_ENDING`, `GRR`, `NRR`, `LOGO_CHURN`, `SUBSCRIPTION_CHURN`, `INVOICED_REVENUE`, `COLLECTED_REVENUE`, `RECEIVABLES`.

Preuve tests E2 : `revenue-metric-registry.spec.ts` vérifie présence des codes et que la définition `COLLECTED_REVENUE` rejette unpaid comme collected.

## Mapping définition → exécutable

| Code | Définition registry | Calculateur exécutable | Preuve |
|------|---------------------|------------------------|--------|
| MRR_* / ARR_ENDING | Oui | Oui (`mrr-calculator.ts`) | E2 |
| GRR / NRR | Oui | Oui (`retention-calculator.ts`) | E2 |
| LOGO_CHURN | Oui | **Non** | E3 — pas de calculator dédié → [F-P11-009](./34-findings-and-risk-register.md) P1 |
| SUBSCRIPTION_CHURN | Oui | **Non / partiel** | E3 |
| INVOICED_REVENUE | Oui | **Non** | E3 → **F-P11-001** P0 |
| COLLECTED_REVENUE | Oui | Guard `isCollectedEligible` seulement | E2/E3 → **F-P11-001** |
| RECEIVABLES | Oui | **Non** | E3 |

## Helper `unavailableUnlessPresent`

Présent dans le registry — aligne la doctrine « jamais zéro silencieux ». **PASS E3**.

## Risque exécutif

Un opérateur peut publier des snapshots `COLLECTED_REVENUE` / `INVOICED_REVENUE` via `POST edge/revenue/metrics/snapshots` (`platform:business:metrics:manage`) **sans** lignée calculée depuis P6 → mésusage dashboard (**F-P11-001**).

## Verdict

Registry **PASS** comme contrat sémantique. Gate C/D **FAIL** faute de moteurs pour les métriques cash/facture.
