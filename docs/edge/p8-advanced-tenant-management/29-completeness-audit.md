# 29 — Completeness Audit (post-remediation)

**Date :** 2026-11-16  
**Méthode :** audit code réel + vague de complétion

## Verdict

`READY FOR AUDIT` sur le périmètre Control Plane + Console livré.  
**Pas `ACCEPTED`** : exécution P7 post-approval, E2E/PG integration, load tests et suite security IDOR restent ouverts.

## Matrice post-remediation

| Phase | Avant | Après |
|---|---|---|
| P8.1 Registry (+ export, sync, search) | PARTIAL | **DONE** (export CSV borné) |
| P8.2 360 (resources/apps/config/timeline) | PARTIAL | **DONE** (projections P7/P5, UNKNOWN si absent) |
| P8.3 Admin (+ bulk TAG/ASSIGN/CLASSIFY) | PARTIAL | **DONE** (bulk non destructif) |
| P8.4 Lifecycle governance | PARTIAL | **DONE** (admin SM + requests ; exécution = P7_PENDING) |
| P8.5 Config prefs / policies | MISSING | **DONE** (policies PATCH + refs 360) |
| P8.6 Commercial refs | PARTIAL | **DONE** (projection subscription si table) |
| P8.7 Resources/apps | MISSING | **DONE** (lecture P7 sans secrets) |
| P8.8 Health | PARTIAL | **DONE** (snapshots ; jamais Healthy inventé) |
| P8.9 Risk | MISSING | **DONE** (règles `p8-risk-v1` explicables) |
| P8.10–P8.13 Exceptions/Mig/Rec/Term | PARTIAL | **DONE** (gouvernance + UI ; P7_PENDING) |
| P8.14 Reconciliation | PARTIAL | **DONE** (missing/orphan/duplicate + acknowledge) |
| P8.15 Audit/activity | PARTIAL | **DONE** (activity + audit mutations) |
| P8.16 Analytics | PARTIAL | **DONE** (portfolio live) |
| P8.17 API | PARTIAL | **DONE** (contrats hub + enrichissements) |
| P8.18 RBAC | PARTIAL | **DONE** (permissions seedées branchées) |
| P8.19 Console | PARTIAL | **DONE** (centre 9 onglets + détail 16) |
| P8.20 Events/outbox | PARTIAL | **DONE** (événements approve/reject corrigés) |
| P8.21 Certification | MISSING | **PARTIAL** (unit/auth ; E2E/PG pending) |

## Bugs corrigés lors de l’audit

1. Conflit DI `ListReconciliationRunsUseCase` (billing vs P8) → renommé `ListTenantReconciliationRunsUseCase`
2. Chemins bulk frontend alignés sur backend (`/bulk/:id/execute`)
3. Execute bulk envoie `expectedPreviewCount`
4. Event types / outbox approve mig/rec/term
5. governanceStatus + openExceptions + REGISTER REVIEW_REQUIRED

## Tests

- Backend P8 : **63 passed**
- Frontend tenant-management : **6 passed**

## Limites assumées (honnêtes)

- Approbations techniques = `delegation: P7_PENDING` (pas d’appel workflow P7.11 migrate/recover)
- Pas de facturation P6 live dans 360
- Bulk RECONCILE n’exécute pas la réconciliation complète
- Pas de suppression physique
- Certification H (E2E/perf/security IDOR) non fermée
