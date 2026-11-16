# 33 — Registre findings

**Campagne :** audit indépendant adversarial P8  
**Date :** 2026-11-16  
**Git (début audit) :** backend `feature/console` @ `cd064ee` (ahead, non poussé) · frontend @ `5b83a1b` (P8 console `8bce479` / `225c4a1`)  
**Module pivot :** `src/modules/edge/**/tenant-management/`  
**Migrations :** `108`, `112`, `113_edge_p8_enterprise_certification.sql`
**Preuve max observée :** **E2 + E3** (Testcontainers local) **+ E4-lite**

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
| AUD-P8-F03 | P1 | **REMEDIATED** | E2 | Register → SQL P5 `edge_subscriptions` product + **status actif** ; table absente → REVIEW |
| AUD-P8-008 | P1 | **REMEDIATED** | E2+E3 | `scope:global` + `edge_p8_operator_scopes` enforce get/search/export |
| AUD-P8-F04 | P1 | **REMEDIATED** | E3 | `edge-p8-tenant-management-transactional.spec.ts` (6 tests) |
| AUD-P8-F05 | P1 | **REMEDIATED** | E4+E2E | Adversarial + Playwright `e2e/edge-tenants-smoke.spec.ts` |
| AUD-P8-F06 | P2 | **REMEDIATED** | load | Smoke **10k** tenants + trigram indexes · &lt; 3000 ms |
| AUD-P8-F07 | P2 | **REMEDIATED** | E2+E4 | Bridge `FAILED` fail-closed (approve non persisté) |
| AUD-P8-F08 | P2 | **REMEDIATED** | E2+E3 | Mig `113`+`114` · RAISE et LIFT via SoD |
| AUD-P8-F09 | P2 | **REMEDIATED** | E2+E3 | Object-level operator scope |
| AUD-P8-F10 | P1 | **REMEDIATED** | E2+E3 | Bridge P7 + API `deprovision-authorization` |

**Bloquant certification levé** ; campagne résiduelle documentée dans `36-residual-closure-certification.md`.
