# 33 — Registre findings

**Campagne :** audit indépendant adversarial P8  
**Date :** 2026-11-16  
**Git (début audit) :** backend `feature/console` @ `cd064ee` (ahead, non poussé) · frontend @ `5b83a1b` (P8 console `8bce479` / `225c4a1`)  
**Preuve max observée :** **E2** (Vitest policy/use-cases/auth) — **pas E3/E4/E5**  
**Module pivot :** `src/modules/edge/**/tenant-management/`  
**Migrations :** `108_edge_p8_advanced_tenant_management.sql`, `112_edge_p8_audit_remediation.sql`

| ID | Sévérité | Statut | Evidence | Fichiers / remarque |
|----|----------|--------|----------|---------------------|
| AUD-P8-001 | P0 | **REMEDIATED** | E2 | `RegisterTenantUseCase` / `upsertTenantRegistry` — preserve `legalHold` ; test `preserves legalHold on re-register` |
| AUD-P8-002 | P0 | **REMEDIATED** | E2 + SQL | `PATCH legal-hold` + `platform:tenant_management:legal_hold:manage` ; mig `112` ; plus de hold via `update_metadata` |
| AUD-P8-F01 | P1 | **REMEDIATED** | E2 | `normalizeReconciliationMode` → uppercase ; `RunReconciliationUseCase persists uppercase` |
| AUD-P8-003 | P1 | **REMEDIATED** | E2 | `assertLifecycleRequestAllowedUnderLegalHold` / `assertLifecycleApprovalAllowedUnderLegalHold` dans `tenant-management-policy.ts` |
| AUD-P8-004 | P1 | **REMEDIATED** | E2 | Approve SUSPEND : pas de statut admin final `SUSPENDED` si `delegation: P7_PENDING` |
| AUD-P8-005 | P1 | **REMEDIATED** | E2 | Bulk : `approverId` = acteur session (`assertSeparationOfDuties`) |
| AUD-P8-006 | P1 | **REMEDIATED** | E2 | Bulk : IDs gelés au preview + `expectedPreviewCount` obligatoire (controller + DTO) |
| AUD-P8-007 | P1 | **REMEDIATED** | E2 | Type bulk `EXPORT` retiré — ne contourne plus `platform:tenant_management:export` |
| AUD-P8-F02 | P1 | **REMEDIATED** | E2 | `assertHealthSnapshotSource` — HEALTHY exige `p7.*` / `probe.*` / `system.*` |
| AUD-P8-F03 | P1 | **PARTIALLY REMEDIATED** | E2 | Register → `GovernanceStatus.REVIEW_REQUIRED` + event activity ; **aucun appel P5 live** |
| AUD-P8-008 | P1 | **OPEN** | E1 | IDOR plateforme par design (control-plane) ; P2 si gouvernance RBAC stricte |
| AUD-P8-F04 | P1 | **OPEN** | — | Suite intégration PostgreSQL P8 (108+112) **non exécutée** — Gate H |
| AUD-P8-F05 | P1 | **OPEN** | — | Suite E2E adversarial multi-tenant **non exécutée** — Gate H/C |
| AUD-P8-F06 | P2 | **OPEN** | — | Index 108 revus ; **aucune** mesure charge registre/360/bulk |
| AUD-P8-F07 | P2 | **OPEN** | — | Injection défaillance P7 bridge **non exécutée** — Gate G |
| AUD-P8-F08 | P2 | **OPEN** | E2 | Lift legal hold : permission unique, **pas** dual approval |
| AUD-P8-F09 | P2 | **OPEN** | E1 | Pas de scoping objet product/portfolio sur list/360/analytics |
| AUD-P8-F10 | P1 | **OPEN** | E2 | Migrate/recover/suspend/term approve → `result: { delegation: 'P7_PENDING' }` sans exécuteur branché |

**Bloquant certification :** F04, F05, F10 (+ F03 partiel tant que P5 live exigé par policy métier).
