# 29 — Résultats tests frontend (audit machine)

| Champ | Valeur |
|-------|--------|
| Date | 2026-11-16 |
| Repo | `saas-template-frontend` |
| Commande | `npx vitest run components/edge/revenue-operations` |
| Résultat | **1 file / 5 passed** |
| Fichier | `components/edge/revenue-operations/edge-revenue-module.test.tsx` |

## Couverture observée (E3 + E2 run)

- Rendu module avec permissions `platform:revenue:read` + `platform:business:read`
- Présence onglets revenue
- Guards basiques (forbidden state)

## Non couvert

| Zone | Statut |
|------|--------|
| Mismatch Overview `business:read` sans `revenue:read` | **Non asserté** → [F-P11-010](./34-findings-and-risk-register.md) |
| 30 sections / absents | Non testé |
| a11y automatisé | Non exécuté ([32](./32-ux-accessibility-audit.md)) |
| Playwright | Voir [30](./30-e2e-test-results.md) — non exécuté live |

## Verdict

FE unit **PASS étroit (5)**. Certification UX/RBAC console **FAIL**.
