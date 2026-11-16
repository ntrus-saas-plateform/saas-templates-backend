# 28 — Résultats tests backend (audit machine)

| Champ | Valeur |
|-------|--------|
| Date | 2026-11-16 |
| Commande | `npx vitest run src/modules/edge/domain/revenue-operations src/modules/edge/application/revenue-operations src/modules/edge/presentation/controllers/revenue-operations.controller.auth.spec.ts` |
| Résultat | **9 files / 93 passed** |
| Niveau | E2 (unit) |

## Périmètre inclus

| Zone | Fichiers typiques |
|------|-------------------|
| Domain | `mrr-calculator.spec.ts`, `retention-calculator.spec.ts`, `revenue-metric-registry.spec.ts`, `forecast-calculator.spec.ts`, `unit-economics-calculator.spec.ts`, `renewal-intelligence.spec.ts`, `revenue-assurance.spec.ts` |
| Application | `revenue.use-cases.spec.ts` |
| Presentation | `revenue-operations.controller.auth.spec.ts` |

## Non inclus / non exécuté

| Suite | Statut |
|-------|--------|
| Testcontainers / DB integration | **NOT executed** |
| Pack financier mandaté 1–25 | **NOT executed** |
| Regression P3–P10 full | **NOT executed** |
| Load tests | **NOT executed** |

## Lien findings

- Preuve positive E2 pour MRR/GRR/NRR/UNAVAILABLE → ne suffit **pas** à lever **F-P11-002**.
- Auth spec contribue Gate H partielle ; rôles mandat → **F-P11-013**.

## Verdict tests BE cet audit

**PASS** sur le sous-ensemble exécuté. **FAIL** couverture certification.
