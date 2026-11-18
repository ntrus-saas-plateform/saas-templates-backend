# 39 — Plan maître d’amélioration & alignement Edge ↔ BB

**Date :** 2026-11-18  
**Statut :** ACTIVE — exécution par phases  
**Sources :** audits 37–38 · ADR-021/055 · industry patterns (async pipeline, warm pool, checkpointed state machine)  
**Règle :** aucun Product Tenant **AVAILABLE** sans G11 PASS ; aucun claim chiffré d’échelle sans benchmark signé.

---

## 0. Objectifs (Definition of Done programme)

| Objectif | DoD |
|----------|-----|
| **A. Alignement commercial** | Chaque famille BB ADR-055 a un Product Tenant Edge + statut commercial honnête |
| **B. Marketing** | Segments/ICP/landings/playbooks par Product Tenant avant AVAILABLE |
| **C. Provisioning robuste** | Async + checkpoints + deferred advance ; ready fail-closed |
| **D. Échelle** | Architecture warm-pool / template documentée ; SLO mesurés ; **pas** de claim 50k/s tant que non prouvé |
| **E. EPR** | G11 PASS **par** Product Tenant avant go-live marketing de ce produit |

### Anti-claims (inchangés)

- ❌ Tous verticaux BB déjà vendables Edge  
- ❌ 50 000 provisions/s aujourd’hui  

### Cibles d’échelle réalistes (roadmap)

| Horizon | Cible | Moyen |
|---------|-------|--------|
| **H0 (maintenant)** | Beachhead correct + deferred advance | `bb_control` + `EDGE_PROVISIONING_ADVANCE_MODE` |
| **H1** | 10–50 cold provisions/min | Async job + concurrence bornée + timeout aligné |
| **H2** | 10²–10³ **allocations**/s | Warm pool / `CREATE DATABASE … TEMPLATE` |
| **H3** | Claim chiffré public | Benchmark lab signé + capacity plan |

> **Allocation ≠ cold create.** 50k/s n’est atteignable que comme **claim de pool** (ms), pas comme `CREATE DATABASE`+143 migrations.

---

## 1. Carte Product Tenants (ADR-021)

| Phase | Code produit Edge | Famille BB | Profils BB cibles | Statut commercial initial | Priorité |
|-------|-------------------|------------|-------------------|---------------------------|----------|
| **P0** | `SYNTIX_PHARMA` | SYNTIX_PHARMA | PHARMACY (+ packs WH/DIST) | AVAILABLE beachhead | Done |
| **P0** | `OKAPI_RESTAURANT` | OKAPI_RESTAURANT | RESTAURANT, CAFE (pack) | AVAILABLE + CAFE Controlled | Done / P5 |
| **P1** | `OKAPI_RETAIL` | OKAPI_RETAIL | SUPERMARKET, GROCERY, FOOD_RETAIL, … | **PLANNED** | High |
| **P1** | `OKAPI_HOSPITALITY` | OKAPI_HOSPITALITY | HOTEL_HOSPITALITY | **PLANNED** | High |
| **P2** | `OKAPI_MANUFACTURING` | OKAPI_OTHER | MANUFACTURING | **PLANNED** | Med |
| **P2** | `OKAPI_EQUIPMENT_RENTAL` | OKAPI_OTHER | EQUIPMENT_RENTAL | **PLANNED** | Med |
| **P3** | Sub-verticals retail (AUTO_PARTS, OPTICAL, …) | OKAPI_RETAIL | profils dédiés | packages / Controlled | After P1 G11 Retail |
| **P9** | CLINIC / HOSPITAL | — | stubs BB | **hors scope** jusqu’à module prod | Blocked |

---

## 2. Checklist G11 (répéter par Product Tenant)

Copier [34](./34-g11-product-readiness-matrix.md) :

1. Catalogue + plans distincts (Lite→Enterprise ou équivalent)  
2. Entitlements → projection BB non vide + `profile_code`  
3. Price book DRAFT→MEASURED (research)  
4. Acquisition publique (presentations + forms)  
5. Wizard / ICP / packages  
6. Playbooks onboarding + CS events  
7. Provision `bb_control` e2e lab  
8. RBAC / ModuleGuard / caps  
9. Docs marketing + support  
10. Sign-offs Product / Eng / RevOps  

**Gate :** `commercial_availability = AVAILABLE` **uniquement** si 1–10 PASS.

---

## 3. Workstreams techniques

### W1 — Catalogue & taxonomy (Edge)

- [x] Beachhead Syntix + Restaurant  
- [x] Migration Product Tenants PLANNED (Retail, Hospitality, Manufacturing, Equipment) — mig **133** `INTERNAL_ONLY`  
- [x] Bindings `productCode → profileCode` (`product-family-bindings.ts`)  
- [x] Registry entitlements extensible (`commercial-plan-entitlements.ts`)  
- [x] Verticals + business profiles Edge rows complets pour chaque profil BB retail — mig **142** (`PLANNED` + `INTERNAL_ONLY` ; 10 codes BB `OKAPI_RETAIL`)  
- [x] Segments `HOSP_*` + business profiles Edge pour chaque clé BB `OKAPI_HOSPITALITY` (`FAMILY_BY_PROFILE`) — mig **143** (`PLANNED` + `INTERNAL_ONLY` ; `HOTEL_HOSPITALITY`, `HOTEL`, `HOSPITALITY`)  

### W2 — Marketing & acquisition

- [x] Seed presentations P10 beachhead (Pharma + Restaurant) — mig **136** **DRAFT** (pas PUBLISHED)  
- [x] Templates landings E4 par Product Tenant — mig **141** **DRAFT** (8 IA routes + landings segment beachhead/roadmap ; **pas PUBLISHED**, contenu scaffold)  
- [x] Sales discovery codes par famille — mig **140** `DISC_SYNTIX_PHARMA` · `DISC_OKAPI_*` · status **DRAFT** (`edge_sales_discovery_questionnaires`)  
- [ ] Legal wet-ink avant trafic payant  
- [ ] Publish P10 presentations après price MEASURED + Legal  

### W3 — Provisioning async & scale

- [x] `bb_control` + dual-write caps + deferred advance mode  
- [x] `@SkipThrottle` control/v1 BB  
- [x] Timeout Edge 180s  
- [x] Table jobs / checkpoints Edge — mig **134** + `ProcessProvisioningJobsUseCase`  
- [x] Worker tick API `POST /edge/provisioning-jobs/process` (concurrence bornée par `limit`)  
- [x] `ProvisioningJobsBootstrap` (`EDGE_PROVISIONING_JOBS_ENABLED`)  
- [x] Architecture scale documentée — [40](./40-provisioning-scale-architecture.md)  
- [x] Template DB / warm pool (BB H2) — scaffold + refill/list + require-claim fail-closed ; flag **OFF** ; pas de QPS claim  
- [x] Métriques live code : queue lag + pending SQL, fail rate jobs, `bb_warm_pool_ready` + allocate p95 cold/warm — **scrape/import Grafana encore ops**  

### W4 — Cohérence Edge↔BB

- [x] `HOTEL_HOSPITALITY` dans `FAMILY_BY_PROFILE` BB → `OKAPI_HOSPITALITY`  
- [x] Quotas Edge appliqués à CreateOrganization — BB lit `entitlements.quotas.max_organizations` (projection W4) ; absent / ≤0 = fail-closed `ORG_QUOTA_UNAVAILABLE`  
- [x] Matrice caps commerciales ↔ `capability_definitions` — `commercialPlanCapabilityMatrix` + `assertPlanCapsAlignCapabilityCatalog` + `EDGE_FAMILY_BY_PROFILE` (`commercial-plan-entitlements.ts` / vitest)  
- [x] Contract tests control/v1 par famille — `control-v1-family-contract.spec.ts` (offline PASS ; lab `describe.skipIf` sans `EDGE_BB_CONTROL_*`)  

### W5 — FE / console

- [x] Catalogue public consomme nouveaux produits PLANNED (filtre Available only)  
- [x] Operator console : readiness G11 badge par produit  
- [x] `edge.ts` clients `advance-after-paid` + `provisioning-jobs`  
- [x] Alignement routes BE↔FE console — **CLOSED** (`uncoveredConsole: 0`, inventaire fail-closed, anti-MVP `ListOrUuidField`, e2e P0 + lab golden/44)  

---

## 4. Phases d’exécution (ordre)

| Phase | Contenu | Exit criteria |
|-------|---------|---------------|
| **A** | Plan 39 + scaffold PLANNED products + bindings + async job skeleton | Migrations + tests verts ; aucun AVAILABLE inventé |
| **B** | CAFE Controlled pack sous Restaurant + P10 presentations beachhead | G11 Restaurant étendu CAFE Controlled |
| **C** | Retail Product Tenant : catalogue + 4 plans + entitlements + profile SUPERMARKET | G11 Retail PARTIAL→PASS lab |
| **D** | Hospitality Product Tenant | G11 Hospitality lab |
| **E** | Async provision worker + SLO dashboard | H1 mesuré |
| **F** | Warm pool BB | H2 mesuré |
| **G** | Manufacturing / Rental | G11 chacun |
| **H** | Benchmark signé ; claims publics uniquement si evidence | — |

---

## 5. Backlog immédiat (Phase A — cette itération)

1. [x] Doc 39 (ce fichier)  
2. [x] Migration `133` Product Tenants PLANNED + verticals  
3. [x] Registry entitlements + profile bindings  
4. [x] Job table Edge `edge_provisioning_jobs` + enqueue deferred + worker API  
5. [x] Fix BB `HOTEL_HOSPITALITY` → `OKAPI_HOSPITALITY`  
6. [x] Index README + doc 40 + update 38 → « plan actif »  
7. [x] CAFE Controlled pack seed (mig **135**) — Phase B amorcée  

**Phase A exit :** ATTEINT.  
**Phase B :** CAFE (135) + P10 **REVIEW** (139) — PUBLISH bloqué [43](./43-legal-publish-gate.md).  
**Phase C/D :** catalogues Lite→Ent + mig **138** + playbooks 41/42 — G11 **PARTIAL** (pas AVAILABLE).  
**Phase E (instrumenté) :** `edge_provisioning_jobs_*` + lag ; dashboard/alertes prêts — import Grafana **manuel**.  
**Phase F (H2 scaffold) :** warm pool + métriques BB allocate/pool ; flag OFF ; vitest mock **PASS**.  
**Lab e2e Retail + Hospitality :** **PASS** ([44](./44-lab-e2e-retail-hospitality-checklist.md)) — INTERNAL_ONLY inchangé.  
**Golden handshake :** **PASS** (`pnpm lab:golden:handshake`).  
**Tranche engineering (code + labs + routes BE↔FE) :** **CLOSED** 2026-11-18 — ne pas confondre avec go-live commercial.  
**Bloqué volontairement (humain/ops — pas forçable en code) :**  
- [ ] import Grafana ([47](./47-grafana-import-runbook.md))  
- [ ] Legal wet-ink + P10 PUBLISH ([46](./46-legal-publish-evidence-pack.md)/[43](./43-legal-publish-gate.md))  
- [ ] template DB flotte réel · H3 claim  
- [ ] G11 AVAILABLE sign-off Product/Eng/RevOps  
- [ ] copy/studio landings E4 (mig **141** = scaffold DRAFT)

---

## 6. Gouvernance

- Owner Eng Edge / Eng BB / Product / RevOps  
- Revue bi-hebdo checklist Phase  
- Cocher uniquement avec preuve (test, mig, doc, audit)  
- PR checklist : [07-pr-checklist.md](./07-pr-checklist.md) + G11 si AVAILABLE  

---

## 7. Liens

- [38 audit](./38-verticals-and-provisioning-scale-audit.md)  
- [37 assurance](./37-capability-assurance-edge-bb.md)  
- [36 EPR beachhead](./36-enterprise-production-ready-certification.md)  
- [02 gates](./02-production-readiness-gates.md)  
- [34 G11](./34-g11-product-readiness-matrix.md)  
