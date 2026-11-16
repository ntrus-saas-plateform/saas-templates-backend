# 13 — Audit revenue assurance & leakage (P11)

| Champ | Valeur |
|-------|--------|
| Domain | `revenue-assurance.ts` + `p5-p6-assurance.adapter.ts` |
| API | scan, leakage-cases, transition |
| Verdict | Détecteurs **unit-tested** ; assurance cash **incomplète** |

## Domain detectors (E2)

`revenue-assurance.spec.ts` — détecteurs de fuites / anomalies sur fixtures.

## Adapter P5/P6 (E3)

`p5-p6-assurance.adapter.ts` :

- Lit subscriptions + invoices (list)
- Ne mute pas P5/P6
- Couverture limitée / heuristique — pas un reconcile accounting complet

## Workflow leakage

Tables : `edge_p11_revenue_leakage_cases`, `edge_p11_revenue_reconciliations`, `edge_p11_revenue_anomalies`.

Permissions : `platform:revenue:reconcile` (+ approve séparé pour d’autres flux).

## Gaps

| ID | Sévérité | Gap |
|----|----------|-----|
| F-P11-001 | P0 | Sans COLLECTED/INVOICED engine, assurance cash vs invoice reste partielle |
| F-P11-025 | P2 | Reconciliations accounting SoT (recognized revenue) différées |
| F-P11-002 | P0 | Scénarios assurance E2E non exécutés |

## Smoke FE e2e (fichier présent, non run cet audit)

`saas-template-frontend/e2e/edge-revenue-smoke.spec.ts` — CSRF reject sur leakage create (preuve code, **pas** exécution live audit).

## Verdict

Assurance **fondation OK**, certification leakage enterprise **FAIL**.
