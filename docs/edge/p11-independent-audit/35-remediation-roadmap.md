# 35 — Feuille de route de remédiation (P11)

| Champ | Valeur |
|-------|--------|
| Objectif | Lever NOT ACCEPTED → candidat ACCEPTED / enterprise |
| Prérequis | Fermer **tous les P0** avant re-certification |

## Phase 0 — Déblocage reproductibilité (P0)

| Action | Finding | Critère de done |
|--------|---------|-----------------|
| Obtenir droits push ou alternative miroir + pousser BE/FE | F-P11-003, F-P11-017 | `origin/feature/console` == HEAD locaux `92d4ff7` / `e1225cc` |
| Tag audit `p11-audit-2026-11-16` sur SHAs | F-P11-003 | Tag remote vérifiable |
| Ne pas mélanger dirty P10 dans commits P11 | F-P11-041 | Tree propre ou commit séparé hors P11 |

## Phase 1 — Exactitude financière (P0/P1)

| Action | Finding | Critère de done |
|--------|---------|-----------------|
| Implémenter moteur INVOICED depuis P6 invoice refs (read-only) | F-P11-001 | Calculateur + tests E2 + E4 sample |
| Implémenter moteur COLLECTED depuis P6 payments succeeded | F-P11-001 | Jamais unpaid ; lignée provenance obligatoire |
| Interdire ou gater snapshots COLLECTED/INVOICED sans `source=engine` | F-P11-001 | Policy + tests authz |
| Dérivation mouvements (dont 100→150 expansion) | F-P11-005, F-P11-006 | Specs + projection live corrigée |
| Corriger `dataQuality` live si payment UNKNOWN | F-P11-004 | Pas MEASURED cash-implying |
| Logo churn calculator | F-P11-009 | E2 + registry wired |
| Pack tests financiers 1–25 exécuté + artefacts | F-P11-002 | Rapport attaché audit |
| E2E 1–45 (ou sous-ensemble critique signé) exécuté | F-P11-002, F-P11-016 | Playwright CI green |

## Phase 2 — Console & RBAC (P1)

| Action | Finding | Critère de done |
|--------|---------|-----------------|
| Aligner Overview : retirer bypass `business:read` ou exiger `revenue:read` FE=BE | F-P11-010 | Test FE dédié |
| Compléter sections ABSENT prioritaires (collected/invoiced, unit econ, partners, planning) | F-P11-011 | Gate E re-score |
| Étendre rôles SoD vs mandat | F-P11-013 | Matrice rôles + seeds |

## Phase 3 — Plateforme (P1/P2)

| Action | Finding | Critère de done |
|--------|---------|-----------------|
| Testcontainers apply 122/123 | F-P11-014 | Evidence Gate I |
| Unifier SoT alerts/reports (`edge_p11_*` vs `edge_revenue_*`) | F-P11-018 | Une famille de tables + migration merge |
| FX reporting currency (au moins ESTIMATED documenté) | F-P11-007 | Policy + tests |
| Pagination projection >500 | F-P11-020 | Pas de truncate silencieux |
| Load test baseline overview/mrr/assurance | F-P11-015 | p95 documenté |

## Phase 4 — Enterprise hygiene (P2/P3)

- Notification channels alerts (F-P11-032)
- Runbooks on-call (F-P11-039)
- a11y automated smoke (F-P11-037)
- Handbook ops unifié (F-P11-040)
- Forecast model suite / partner statements / accounting recognition adapter (F-P11-022/027/025)

## Re-certification gate

Rejouer ce package d’audit indépendant uniquement lorsque :

1. P0 = 0 ouvert  
2. Gate A PASS (remote sync)  
3. Pack 1–25 + E2E critique exécutés avec artefacts  
4. COLLECTED/INVOICED engine + lignée P6  

Jusque-là : **CORRECTIONS REQUIRED** reste le seul verdict valide.
