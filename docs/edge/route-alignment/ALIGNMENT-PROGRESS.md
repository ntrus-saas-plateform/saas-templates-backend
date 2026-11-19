# Alignement BE↔FE — progression

Dernière mise à jour : 2026-11-18

> **Statut vague routes BE↔FE :** **CLOSED** (2026-11-18).  
> **Repasse audit** : [`ALIGNMENT-AUDIT-2026-11-18-repass.md`](./ALIGNMENT-AUDIT-2026-11-18-repass.md) — couverture **A**, profondeur UX **B/B+** (studio sur domaines migrés EdgeStudioShell ; Auth/Catalog/Verticals/BB + agents/cert/recon encore partial).  
> Mesure `--diff` : **`uncoveredConsole: 0`**, `beOnly: 10` (OOS), `feOnly: 9`, pages extract **71**.  
> Inventaire CI fail-closed + `--strict` OK. Lab golden + doc 44 **PASS**.

## Fait (vague P0 — clôturée)

### Phase 0
- [x] Inventaire routes BE/FE + plan (`edge-*-routes.md`, `edge-be-fe-alignment-plan.md`)
- [x] Allowlist OutOfScope (`edge-console-out-of-scope.md`)
- [x] Scripts npm `edge:routes:extract|check|diff` (+ `--strict` optionnel)
- [x] CI `edge:routes:diff` (informatif) + `edge:routes:check` **fail-closed** (artifacts regenerés)

### P0 Auth / Security / Admins
- [x] Clients `edgeApi` : invite/suspend/reinstate/deactivate admin, memberships, effective-permissions
- [x] Clients RBAC : roles, permissions, role-assignments
- [x] Clients security : revoke session(s), MFA, emergency-access, delegations
- [x] Clients workspaces : bootstrap/renew/revoke/revoke-all
- [x] UI `/edge/administrators` invite + list
- [x] UI `/edge/administrators/[id]` lifecycle + memberships + perms + assign role
- [x] UI `/edge/security` revoke sessions, MFA, emergency, delegations

### P0 Verticals / Catalog / BB
- [x] Clients memberships activate/suspend/reinstate/revoke
- [x] UI studio memberships transitions
- [x] Clients market-segments get/patch, business-profiles/operating-models create/get
- [x] Clients capabilities create/get/dependencies
- [x] Clients integration-contracts list/get/create
- [x] Clients product version get/patch/publish + compatibility upsert
- [x] UI markets : tabs segments (edit) + profiles + models + contracts create
- [x] UI catalog : publish **version** dédiée + onglet Compatibility (PUT upsert)
- [x] UI integration-contracts panel (onglet Markets → Contracts)

### P0 Tenants
- [x] Client `rejectTenantLegalHoldChangeRequest`
- [x] UI reject legal-hold sur tenant detail

### P0 Product Control
- [x] Callback annoté OutOfScope (pas d’UI)
- [x] Smoke route-existence P0 (handshake/health paths) — `test/e2e/edge-p0-console-routes.e2e-spec.ts` (opt-in `EDGE_P0_E2E=1`)
- [x] FE P0 console smoke — `e2e/edge-p0-console-smoke.spec.ts` + `pnpm test:e2e:p0`
- [x] Lab golden handshake→health avec token réel — `pnpm lab:golden:handshake` **PASS** (BB `lab-token`)
- [x] Lab retail/hospitality bb_control probes — doc 44 **PASS** (`pnpm lab:e2e:retail|hospitality`, migrate:control 078/132)

### P1 Billing (vague)
- [x] Clients preview/mark-overdue/fx/provider-transactions/tax jurisdictions/upsert policy
- [x] UI billing page : credit notes, preview, mark-overdue, tax jurisdictions
- [x] Subscriptions détail : change-plan (change requests) + pause/resume
- [x] Acquisition module funnel (products/forms/apps) — surface existante
- [x] Acquisition CX : leads promote/capture, form from-contract, prospect transition
- [x] Acquisition public parity (BFF SSR + checkout CTA + admin Voir en public + segments/catalog) — catalogue vide tant que P10 ≠ PUBLISHED (doc 46)

## Clôture vague routes (checklist)

1. [x] Regen inventaire + `edge:routes:check` fail-closed CI
2. [x] Fermer uncovered console clients (`uncoveredConsole: 0`)
3. [x] Remplacer flux paste-UUID prioritaires (`ListOrUuidField` select-first) — restes volontaires : `periodId`, grantee admin visibility, `productTenantId` register, status publication sans GET list API
4. [x] Pack e2e P0 + lab golden handshake + retail/hospitality probes (doc 44 CLOSED)
5. [x] Marketing deliveries webhooks — **OutOfScope** (pas d’UI console)
6. [x] Vague P2 : 16 routes (commercial/sales/marketing/revenue) → `edgeApi` + UI fine

### P1 Provisioning depth (vague)
- [x] Clients + UI history : `agent-history`, `certification/history`, `reconciliation/history`

### P1 Ops
- [x] `listMajorIncidents` branché onglet Incidents (liste dédiée, pas filtre client)
- [x] Status publish / incidents lifecycle déjà sur module ops
- [x] `listStatusPages` branché onglet Status
- [x] Approve status publication — `ListOrUuidField` + ids session post-publish (pas de GET list publications)
- [x] Deep-links incident detail — `GET /operations/incidents/:id` + panneau + `?incident=`

### P2 Sales (vague)
- [x] Pipeline board UI + stage moves
- [x] Partners / notes / territories / approvals / BANT / reopen
- [x] Marketing templates & suppressions (GET list)
- [x] **2026-11-18** UI fine Marketing : campaign GET (`ListOrUuidField`), lead GET + consent withdraw, journey execution start (`listMarketingJourneys` + leads)
- [x] Marketing deliveries webhooks — OutOfScope (pas d’UI)
- [x] **2026-11-18** UI fine Sales : comptes (doublons/merge), devis (GET + transition), commandes (lignes/transition), opportunity workspace (close/risques/concurrents/offres)
- [x] **2026-11-18** UX paste-UUID : contact/opp/note account, visibility subject (ACCOUNT/OPPORTUNITY) via `ListOrUuidField`

### P1 Billing — profondeur console (2026-11-18)
- [x] Clients : `createBillingSchedule`, `createBillingDispute`, `upsertBillingAccountParty`
- [x] UI : journal/parties sur inspect compte, litiges (reconciliation), collection detail + `recordBillingCollectionDunning`, création/liste schedules
- [x] **2026-11-18** UX paste-UUID : factures/paiements/collections/schedules/subscriptions + portal billing account via `ListOrUuidField`

### P2 Commercial — profondeur console (2026-11-18)
- [x] Clients : `createCommercialResearchProject`, `upsertCommercialSegmentIntelligence`
- [x] UI : research (sources/complete), score segment, link capabilities package/plan/addon

### Parallèle RGOM (plan 39 — hors routes strict)
- [x] **2026-11-18** Sales discovery codes par famille — mig control-plane **140** (`DISC_*` → questionnaires DRAFT/INTERNAL, table `edge_sales_discovery_questionnaires` depuis **083**)
- [x] Lab harness `pnpm lab:e2e:retail|hospitality` — doc 44 **PASS** (`EDGE_BB_CONTROL_TOKEN` / migrate:control 078+132)
- [x] Grafana H1 JSON + alertes 45 (import ops manuel restant)
- [x] Warm pool H2 skeleton BB (mig 133, claim/list/refill script, tests mock — **flag OFF** ; `BB_WARM_POOL_REQUIRE_CLAIM` fail-closed optionnel ; refill template versionné **TODO ops** ; pas de claim 50k/s)
- [x] Pack Legal publish 46 (pas de signatures forgées ; wet-ink humain)
- [x] Badge G11 sur catalog product detail (AVAILABLE = sign-off humain, pas auto)

### Anti-MVP UUID (2026-11-18 suite)
- [x] Opportunity offers : product/plan via `ListOrUuidField`
- [x] Commercial link capability : offer + capability via `ListOrUuidField`
- [x] Marketing inspect : campaign GET, lead GET + consent withdraw, journey execution start

### Warm pool H2 (BB)
- [x] Mig 133 + flag OFF + refill/list + require-claim fail-closed + vitest mock **10/10 PASS**
- [x] Metriques live : edge_provisioning_jobs_lag_seconds + backlog SQL ; BB bb_warm_pool_ready / claims / allocate duration
- [x] Grafana dashboard v2 + alertes lag/pool (45/47) — import ops manuel
- [x] Runbook lab refill vlab (flag OFF hors lab)

### RGOM W1–W4 (suite)
- [x] Quotas Edge → CreateOrganization (fail-closed ORG_QUOTA_UNAVAILABLE) + vitest
- [x] Matrice caps commerciales ↔ catalogs + contract control/v1 familles (offline PASS)
- [x] Landings E4 DRAFT mig 141 ; retail profiles BB mig 142 ; hospitality segments + profils BB mig 143

### RGOM W5 / discovery
- [x] Catalogue liste : filtre Available only + badge G11
- [x] Discovery templates + mig 140 codes par famille (DRAFT)

### Acquisition + W1 hospitality / max_users
- [x] SSR /acquire via BFF publicAcquisitionFetch + CTA checkout plan PUBLISHED
- [x] Mig **143** hospitality segments/profiles PLANNED
- [x] Quotas Edge max_users invitations/memberships (fail-closed)
- [x] `/acquire/[slug]/apply` → `postPublicAcquisitionApplication` (BFF, fail-closed `applicationId`)
- [x] `/acquire/[slug]/configure` — plans BFF, apply avec `planPresentationId`, checkout si PUBLISHED
- [x] Quotas Edge max_customers / max_products fail-closed (CreateCustomer + CreateProduct) + seeds plans + mig **144**
- [x] Apply `file_upload` honnête ; CONTACT/DEMO metadata LEAD ; specs intent/client public
- [x] Mig **145** CAFE pack caps+quotas ; wizard console Commercial ; e2e configure shell ; UC quota specs customer/product
