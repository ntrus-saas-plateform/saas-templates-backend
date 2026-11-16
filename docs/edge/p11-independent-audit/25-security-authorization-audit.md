# 25 — Audit sécurité & autorisation (P11)

| Champ | Valeur |
|-------|--------|
| Gate H | **PARTIAL → FAIL** entreprise |
| Evidence auth unit | `revenue-operations.controller.auth.spec.ts` (inclus run 93 tests) |

## Permissions seed (migration 122) — E3

`platform:business:*`, `platform:revenue:*`, `platform:commission:*` — insert + mapping :

- `EDGE_PLATFORM_SUPER_ADMIN` : full set listé
- `EDGE_PLATFORM_OPERATOR` : read subset (business/revenue/commission read)

## Matrice endpoints

Controller applique `@RequireEdgePermissions(...)` par route — **matrice existe E3** (PAS une absence totale de RBAC).

## Échecs vs mandat entreprise

| ID | Sévérité | Gap |
|----|----------|-----|
| **F-P11-013** | P1 | Rôles incomplets vs mandat (SoD riche, rôles métier revenue ops manquants au-delà SUPER_ADMIN/OPERATOR) |
| **F-P11-010** | P1 | FE Overview `business:read` ≠ BE `revenue:read` |
| F-P11-035 | P3 | Surface CSRF couverte smoke FE fichier ; non exécutée live cet audit |
| F-P11-016 | P1 | Pas d’E2E authz scenarios 1–45 |

## Smoke code (non run audit)

`e2e/edge-revenue-smoke.spec.ts` : anonymous 401/403 ; CSRF_REJECTED sur POST metrics/MRR/leakage.

## Verdict

RBAC **fondation PASS partielle**. Certification sécurité enterprise **FAIL** (Gate H).
