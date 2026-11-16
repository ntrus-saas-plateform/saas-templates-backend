# 07 — Audit mouvements de revenu (P11)

| Champ | Valeur |
|-------|--------|
| Types | NEW, EXPANSION, CONTRACTION, CHURNED, REACTIVATION, STARTING, ENDING |
| Verdict | Classification **consommée**, pas **dérivée** en live |

## Contrat calculateur (E3)

`NormalizedSubscriptionRevenueLine.movementType` est un input. `computeMrrMovements` bucketise par type — ne calcule pas un delta 100→150 tout seul.

## Live path (E3)

`live-revenue-projection.adapter.ts` assigne uniquement :

- `ENDING` si actif en fin de période
- `STARTING` sinon

→ Buckets NEW/EXPANSION/CONTRACTION/CHURNED/REACTIVATION restent vides / UNAVAILABLE en projection live ([F-P11-005](./34-findings-and-risk-register.md)).

## Tests absents (Gate D)

| Scénario mandaté (ex.) | Statut audit |
|------------------------|--------------|
| Upsell 100 → 150 = EXPANSION 50 | **Non prouvé** comme dérivation ([F-P11-006](./34-findings-and-risk-register.md)) |
| Downgrade / seat remove | Non prouvé dérivation |
| Full churn vs contraction | Non prouvé dérivation |
| Reactivation vs new | Non prouvé dérivation |
| Pack mouvements E2E 1–45 | **Non exécuté** ([F-P11-002](./34-findings-and-risk-register.md)) |

## Verdict

Couche mouvement : **API de classification** OK ; **intelligence de mouvement production** FAIL pour certification.
