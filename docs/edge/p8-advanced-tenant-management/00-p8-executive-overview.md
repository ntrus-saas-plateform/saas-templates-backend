# P8 — Advanced Tenant Management & Governance

**Programme :** Okapi Edge — SaaS Product Platform  
**Phase :** P8  
**Branche :** `feature/console`  
**Date préaudit :** 2026-11-16  
**Statut :** P8.0 COMPLETE — IMPLEMENTATION IN PROGRESS

## Objectif

Livrer le domaine central d’administration, de cycle de vie administratif, de gouvernance et d’intelligence des **product tenants** Okapi Edge, sans empiéter sur P5 (contrats), P6 (billing), P7 (exécution technique) ni Identity / Business Backends (IAM métier).

## Verdict préaudit

| Dimension | État |
|---|---|
| Registre tenant unifié Edge | **Absent** — données éclatées P7 + Identity |
| Vue 360° administrative | **Absente** |
| Lifecycle technique P7.11 | **Présent** (suspend/resume/deprovision) |
| Gouvernance admin (exceptions, approval, retention) | **Absente** |
| Réconciliation globale | **Partielle** (silos P7/P6) |
| Console `/edge/tenants` | **Placeholder désactivé** |
| Migration libre | **108** (après `107_edge_p7_onboarding_operations`) |

## Décisions structurantes (P8.0)

1. **Product tenant** = unité d’administration P8 (`productTenantId`), distinct du tenant Identity (`platformTenantId`) — ADR-P7-003.
2. Package Edge : `src/modules/edge/{domain,application,infrastructure}/tenant-management/` + controller dédié.
3. P8 **orchestre et gouverne** ; P7 **exécute** ; P5/P6 restent sources de vérité commerciales/financières.
4. Trois dimensions d’état indépendantes : Administrative / Technical (projection P7) / Governance.
5. Aucune donnée mock en production ; absences → `UNKNOWN` / `UNAVAILABLE` / `STALE`.

## Ordre d’exécution

P8.0 → P8.1 Registry → … → P8.21 Certification → Acceptance.

## Repos

| Repo | Branche | Rôle |
|---|---|---|
| `saas-templates-backend` | `feature/console` | Control Plane P8 |
| `saas-template-frontend` | `feature/console` | Edge Admin Console |
