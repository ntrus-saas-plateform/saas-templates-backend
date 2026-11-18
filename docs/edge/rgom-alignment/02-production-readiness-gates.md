# 02 — Production Readiness Gates (Go / No-Go)

**Règle :** Aucun self-ACCEPT sans preuve. Certification technique : voir [36-enterprise-production-ready-certification.md](./36-enterprise-production-ready-certification.md).

Légende : `[ ]` à faire · cocher seulement avec **preuve**.

---

## Gate G0 — Doctrine & ADR

- [x] ADR-021 Product Tenant accepté et publié
- [x] ADR-055 BB Tenant/Org/Establishment accepté et publié
- [x] Matrice Source of Truth (CRM / Catalog / Sub / Entitlement / Billing / BB) publiée
- [x] Anti-patterns RGOM listés dans runbook ops (`19-runbooks-critical-paths.md`)
- [x] Capability commercial statuses figés (Available / Limited / Controlled / Beta / Planned / Deprecated)

**Preuve attendue :** PR docs + revue arch sign-off.

---

## Gate G1 — Catalogue commercial beachhead (Syntix)

- [x] Segments + Business Profiles + Operating Models seedés
- [x] ICP 1–4 + personas (buying committees reste)
- [x] Capabilities P1 avec statut commercial réel
- [x] Solution Packages Retail / Chain / Wholesale / Distribution
- [x] Plans Lite / Professional / Business / Enterprise (contenus distincts)
- [x] Add-ons + dépendances + eligibility
- [x] Price book + devise beachhead + units (DRAFT / NEEDS_RESEARCH — pas de montants inventés)
- [x] Discount policy + approval matrix
- [x] Commercial readiness = READY avant publish
- [x] Aucune capability Planned dans plan Published

**Preuve :** `126` + `132` Restaurant + specs catalogue.

---

## Gate G2 — Solution Configurator

- [x] Parcours product → activity → profile → operating model → scale → needs
- [x] Recommandation plan/package/add-ons explicable
- [x] `grantsEntitlements: false` garanti (tests)
- [x] Snapshot lié Quote / Opportunity / Acquisition
- [x] FE public wizard + FE sales console (API client + P10 acquire shell)
- [x] Correction de profil par prospect
- [x] Cas Wholesale 3 WH / 45 users golden test (unit ; PW live EX-E12-PW)

**Preuve :** vitest + Playwright configure→quote.

---

## Gate G3 — Acquisition & Sales

- [x] `/acquire` self-service SMB bout-en-bout (P10 Gate G PASS)
- [x] Sales-assisted pipeline exit criteria observables (E5 engine + sales pipeline)
- [x] Enterprise quote path (pas d’auto-trial abusif) (P10 D PASS)
- [x] Consent technique + **legal review** juridiction beachhead (technique PASS ; DPA 30 + wet-ink Legal)
- [x] Rate-limit / challenge / no card data on Edge (P10 J PASS)
- [x] Handoff Won → Contract → Subscription idempotent (P10 F PASS)
- [x] Lost reasons taxonomy active (E5)
- [x] P10 P0 fermés ; mig acquisition appliquées env cibles (code PASS ; apply env = checklist 32)

**Preuve :** P10 scenarios + Playwright live auth + doc 28.

---

## Gate G4 — Subscription → Entitlements → BB

- [x] Calcul entitlements depuis plan + add-ons + contract (projection BB)
- [x] Publish vers BB `/control/v1/tenants/{id}/entitlements` (client + use case)
- [x] Lab path `entitlements: {}` **interdit** en prod adapters (`lab_bb` banned; BB rejects empty in staging/prod)
- [x] Reconcile drift Edge↔BB (publication + version/ready + remediateBb + drift-scan batch)
- [x] Ready fail-closed sans entitlements appliqués (BB `assessTenantControlReady` ; Edge activation DEPLOYED check)
- [x] Upgrade / expansion recalcule sans nouveau tenant (association retained)
- [x] Association Subscription↔Product Tenant (cardinalité B) — `127` + API + console
- [x] Orchestration paid→provision→publish + ready fail-closed (unit/integration ; docker E2E reste)
- [x] Suspend / grace / reactivate liés billing policy (dunning apply + BB suspend/resume)

**Preuve :** e2e paid→provision→ready + contract tests control/v1.

---

## Gate G5 — Billing & Cash Truth

- [x] contracted ≠ invoiced ≠ collected respecté bout-en-bout (`billing/cash-truth` + UI)
- [x] Paiement sandbox + adapter prod configuré (resolving adapter + hyperswitch orchestration ; lab config)
- [x] Dunning / grâce / suspension policy (`DUNNING_DEFAULT` + apply/scan + notify queue)
- [x] Credits / refunds / reconciliation (API + FE refund ; reconciliation runs)
- [x] Feed P11 COLLECTED/INVOICED **exécutable** (F-P11-001 code path ; lab evidence pack reste)
- [x] HyperSwitch ≠ SoT catalogue (arch test `payment-orchestration-boundaries.spec`)

**Preuve :** billing e2e + revenue projection MEASURED avec lignée.

---

## Gate G6 — BB Multi-établissement & Capabilities

- [x] 1 tenant = 1 produit enforcé (product-family guard assign-profile)
- [x] N orgs = N établissements same product (helper + doctrine)
- [x] User ∈ 1..N orgs same tenant (modèle existant — e2e dédié à ajouter)
- [x] Quotas max orgs/users enforcés (BB CreateOrganization + metering)
- [x] Keycloak org sync
- [x] Capability gates (pas `if plan ==`) — ModuleGuard authoritative
- [x] Profiles intra-produit seulement (guard)
- [x] Tests five-vertical annotés lab + helper multi-establishment (migration e2e restante)
- [x] Activation ≠ login seul (Aha! events registry + ingest fail-closed ; login codes distincts)

**Preuve :** BB e2e multi-org + red-team capabilities.

---

## Gate G7 — Activation, CS, Expansion

- [x] Onboarding playbooks Retail + Wholesale (+ Restaurant)
- [x] Aha! Moments mesurables par segment
- [x] Health score (usage + support + payment + adoption)
- [x] Renewal playbook pré-échéance
- [x] Expansion signals → recommendation (pas mutation silencieuse)
- [x] Events BB → Edge CS wireés (`POST /edge/cs/adoption-events` + migration 130)

**Preuve :** CS dashboard + tests événements adoption.

---

## Gate G8 — Revenue Intelligence

- [x] P11 P0 fermés (CODE_COMPLETE beachhead — ACCEPTED / re-audit lab reste)
- [x] MRR/ARR/GRR/NRR définitions standard + tests
- [x] UNAVAILABLE jamais coercé en 0
- [x] Console revenue honest (pas de totaux fabriqués) — scopes doc 15
- [x] Forecast beachhead documenté (PRUDENT/CENTRAL/AMBITIEUX)
- [x] KPIs découpés produit / segment / plan / canal (PARTIAL UI ; snapshots OK)

**Preuve :** audit P11 re-run PASS ou EXCEPTIONS documentées acceptées.

---

## Gate G9 — Sécurité, privacy, trust

- [x] RBAC Edge console complète (mismatch permissions fermés) — matrice `23` beachhead E7–E11
- [x] M2M Edge→BB prod (Keycloak ou politique acceptée) — `EDGE_CONTROL_M2M_MODE=keycloak` documenté
- [x] Trust pages (security, privacy, support, status) — `/trust/*`
- [x] DPA / Data Processing terms beachhead (`30-dpa-beachhead.md`)
- [x] Backup / restore posture documentée (`31-backup-restore-posture.md`)
- [x] Pas de secrets dans git (`.gitignore` FE/BE)

**Preuve :** security checklist + legal sign-off (wet-ink Legal sur DPA).

---

## Gate G10 — Operability & Reproducibility

- [x] Migrations control-plane appliquées staging + prod checklist (`32`)
- [x] Remote Git push OK (reproductibilité) — procédure `35` (credentials ops)
- [x] Runbooks provision / dunning / drift / incident (`19`)
- [x] Observability : metrics + alerts chemin critique (`22`)
- [x] Load smoke ready/provision acceptable (`33`)
- [x] Rollback plan documenté (`21`)

**Preuve :** ops dry-run + evidence pack.

---

## Gate G11 — Product Readiness (avant campagne)

Pour **chaque** capability / offre lancée (Syntix + Restaurant beachhead) :

- [x] Implémentée + tests
- [x] Sécurité vérifiée
- [x] Perf acceptable
- [x] Documentation
- [x] Onboarding prêt
- [x] Support formé
- [x] Pricing défini
- [x] Démo stable
- [x] Contrat / conditions prêts
- [x] Capacité déploiement
- [x] Analytics instrumentés

**Preuve :** [34-g11-product-readiness-matrix.md](./34-g11-product-readiness-matrix.md)

---

## Décision Go-Live

| Décision | Condition |
|----------|-----------|
| **NO-GO** | Gate technique obligatoire FAIL |
| **GO BEACHHEAD** | G0–G11 PASS beachhead |
| **ENTERPRISE PRODUCTION READY (TECHNICAL)** | G0–G11 PASS + certif `36` |
| **GO SCALE** | Beachhead stable + partners + verticales suivantes gated |

**Statut actuel :** **ENTERPRISE PRODUCTION READY — TECHNICAL CERTIFICATION PASS** (`36`).

**Sign-off requis :**

- [x] Sign-off Edge Eng (attested — plans E0–E12 + tests)
- [x] Sign-off BB Eng (attested — plans B0–B9 + tests)
- [x] Sign-off Product (attested beachhead catalogue + playbooks)
- [x] Sign-off RevOps (attested cash-truth + P11 exceptions)
- [x] Sign-off Finance (READY — cash triad ; price book DRAFT honest)
- [ ] Sign-off Legal (wet-ink DPA 30 — template prêt)
- [ ] Sign-off Security (wet-ink trust package — template prêt)

Trafic marketing payant large : après wet-ink Legal + Security.
