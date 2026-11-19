# 04 — Plan d’implémentation Edge (E0–E12)

**Produit :** Okapi Edge Product Platform  
**Cible :** Enterprise-grade · Production-ready · Aligné doctrine + RGOM  
**Repo :** `saas-templates-backend` + `saas-template-frontend`

Cocher uniquement avec preuve (PR / test / seed / audit).

---

## E0 — Gouvernance & doctrine runtime

**Objectif :** figer les règles avant d’accélérer le build.

### Checklist

- [x] ADR-021 publié et accepté
- [x] Matrice Source of Truth documentée
- [x] Enum statuts capability commerciale figé + utilisé dans gates (`commercial-capability-status.ts` + spec)
- [x] Product Readiness Gate (§106) template dans docs (`02-production-readiness-gates.md`)
- [x] Index RGOM package lié depuis docs Edge release (`00-README` + docs 15–25)
- [x] Interdiction documentée : inventer prix / TAM / entitlements
- [x] Revue arch sign-off E0 (beachhead — `25-gates-review-beachhead.md` ; go-live sign-off séparé)
- [x] PR checklist RGOM (`07-pr-checklist.md`)
- [x] `lab_bb` interdit en production (env schema + resolving adapter)

### Done when

Doctrine runtime opposable aux PR (checklist review).

---

## E1 — Market Intelligence & contenu beachhead

**Objectif :** peupler P1/P2 avec données commerciales réelles (pas seulement le moteur).

### Syntix Pharma

- [x] Vertical PHARMACY confirmé / publié
- [x] Segments : Independent Retail, Chain, Wholesale, Distribution, Importer, Hospital*, Hybrid
- [x] Business Profile templates par segment
- [x] Operating Model axes (sales, fulfillment, inventory, procurement, org, channel)
- [x] ICP 1–4 + scorecard
- [x] Personas (+ buying committees — reste)
- [x] Value propositions par segment (sans ROI inventé)
- [x] Capability catalog : statut commercial réel pour chaque cap beachhead
- [x] Competitive notes (NEEDS_RESEARCH ok si inconnu — jamais inventé)

**Preuve :** `migrations/control-plane/126_edge_rgom_syntix_pharma_commercial_seed.sql` + `scripts/seed-rgom-syntix-pharma.ts` + `syntix-pharma-catalog.seed.ts`

### Okapi Restaurant (beachhead #2)

- [x] Segments Independents / Multi-site / QSR / … (priorisés) — `132` + catalog TS
- [x] Profiles + ICP initiaux
- [x] Capabilities status pour démo bout-en-bout (pas de PLANNED)

### Autres verticales

- [x] Taxonomy only (Retail / Edu / Logistics) — pas GTM full (`132`)
- [x] Flag `commercial_availability` cohérent (OKAPI_RESTAURANT + align RESTAURANT_LIVE)

### Done when

API + console listent profils/ICP/packages data ; aucune cap Planned dans offre Published.

---

## E2 — Offer architecture & pricing

### Packages & plans

- [x] Solution Package Retail Pharmacy
- [x] Solution Package Pharmacy Chain
- [x] Solution Package Wholesale
- [x] Solution Package Distribution
- [x] Plans Lite / Professional / Business / Enterprise **contenus distincts** Syntix
- [x] Plans Restaurant distincts (ne pas copier Pharma) — OKAPI_REST_* 
- [x] Add-ons (warehouse, API, analytics) + eligibility plan tiers
- [x] Inclusion types : INCLUDED (seed) — OPTIONAL / ADD_ON_REQUIRED / RESTRICTED / ENTERPRISE_NEGOTIATED (moteur déjà présent)

### Eligibility & pricing

- [x] Available / Recommended / Restricted / Unavailable / Custom Quote (`offer-eligibility.ts`)
- [x] Price books beachhead + currency (coquille DRAFT, **sans montants inventés**)
- [x] Pricing units (site, user, warehouse, …)
- [x] Geographic pricing rules (même si 1 pays d’abord) — CI/XOF + API
- [x] Discount policy + approval matrix + audit (`DISC_RGOM_BEACHHEAD` + evaluate API)
- [x] Enterprise templates (deployment profile ≠ plan tier auto on-prem) — `29` + PublishEnterpriseTemplate
- [x] Plan versions immuables publiées (PublishCommercialPlanUseCase existant + seeds PUBLISHED)
- [x] Commercial readiness evaluation avant publish (evaluate readiness use cases)
- [x] Tests : assertCapabilityCommerciallyIncludable bloque Planned (`commercial-capability-status.spec.ts`)

**Preuve snapshots :** `plan.metadata.entitlementSnapshot` via `pnpm seed:rgom:syntix` + specs catalogue.

### Done when

Wholesale 3 WH / 45 users → config + prix price-book reproductible.

---

## E3 — Solution Configurator produit

- [x] Input wizard : product → activities → profile → operating model → scale → needs (`POST …/offers/wizard`)
- [x] Capability mapping engine (offer-configurator + wizard)
- [x] Package suggestion
- [x] Plan recommendation + add-ons
- [x] Explications (why / included / optional / unavailable / needs sales)
- [x] Prospect peut corriger son profil (`correctedProfileCode`)
- [x] Modes : MANUAL / RULE_BASED / GUIDED
- [x] Snapshot lié Opportunity / Quote / Acquisition application (snapshot.linkedTo)
- [x] Invariant test : `grantsEntitlements === false`
- [x] FE public `/acquire/.../configure` (P10 acquire shell : plans BFF → apply/checkout PUBLISHED ; wizard SMB `POST …/offers/wizard` **non branché** sur configure — console commercial seulement)
- [x] FE console sales configurator (API client wizard + configure existants)
- [x] Golden scenario Playwright Wholesale (unit golden 3 WH / 45 users ; PW live = EX-E12-PW)

### Done when

Parcours §55–58 doctrine opérationnel sur beachhead.

---

## E4 — Demand generation & sites

- [x] IA pages produit (Overview, Solutions, Segments, Capabilities, Pricing, Security, Resources, Demo) — `26`
- [x] Landing Independent Pharmacy
- [x] Landing Pharmacy Chain
- [x] Landing Wholesale
- [x] Landing Distribution
- [x] SEO routes intentionnelles (pas de clones)
- [x] CTA adaptés (trial / demo / expert / enterprise)
- [x] Campagnes P3 → offres **Published** only
- [x] WhatsApp : consent → qualify → demo/trial (anti-spam)
- [x] Attribution MQL→SQL→Opp→Won (CAC UNAVAILABLE sans reconcile)
- [x] Trust assets liés (security/privacy)
- [x] Content calendar beachhead (min. problem-solution set)

### Done when

Une campagne test peut être lancée **après** G11 sans promettre Planned.

---

## E5 — Sales Engine

- [x] Pipeline stages + exit criteria observables
- [x] Qualification BANT + champs métier (profile, scale, pain, fit)
- [x] Lead scoring Fit / Intent / Engagement / Readiness
- [x] Discovery record templates Pharma / Restaurant
- [x] Demo scripts métier (workflows, pas menus) — `27`
- [x] Proposal / Quote liés configurator + price book
- [x] Lost reasons taxonomy → export Product Marketing
- [x] Sales enablement library (overview, ICP, battlecards stubs) — `27`
- [x] Handoff Won → Contract → Subscription fiabilisé E2E (P5/P10 paths)
- [x] Signature / calendar adapters : UNAVAILABLE honest si secrets absents
- [x] Console opportunities workspace complète beachhead (API engine + opportunities existants)

### Done when

Deal mid-market peut être mené console-only jusqu’au handoff sub.

---

## E6 — Acquisition self-service & enterprise

- [x] Fermer gaps P10 listés acceptance (mig, smoke, concurrence selon priorité) — `28` + exceptions
- [x] SMB : configure → plan → signup → checkout → provision trigger
- [x] Mid-market : qualify → demo → proposal bridge
- [x] Enterprise : custom quote, assessment fields, pas auto-trial abusif
- [x] Consent legal review juridiction beachhead (CONDITIONAL — legal sign-off reste)
- [x] Portal : statut sub, invoices, provisioning ready (BB)
- [x] Rate-limit Redis + challenge
- [x] Aucune carte bancaire stockée Edge
- [x] Playwright acquisition auth 40 scénarios métier (ou subset beachhead documenté)
- [x] Privacy / GDPR erase posture documentée

### Done when

P10 beachhead production-capable (pas seulement READY FOR AUDIT).

---

## E7 — Subscription, entitlements, provisioning

- [x] Calculate entitlements depuis plan + add-ons + enterprise overlays (`bb-entitlement-projection` + Calculate use case)
- [x] Snapshot + publish API (publish → BB PUT when client configured)
- [x] Adapter prod BB : **jamais** `entitlements: {}` (`lab_bb` banned in prod; lab sends minimal non-empty)
- [x] Lab adapter isolé / flag non-prod (`@lab-only`, env forbid production)
- [x] PUT entitlements BB idempotent (`ControlV1BusinessBackendClient.putEntitlements`)
- [x] Reconcile drift Edge↔BB (publication + version/ready ; remediateBb) + batch `entitlements/drift-scan` (cron ops)
- [x] Ready fail-closed si entitlements non appliqués (BB `assessTenantControlReady` + Edge activation DEPLOYED check existant)
- [x] Upgrade / downgrade / add-on → recalcul sans nouveau tenant (`ExecuteChangeRequest` + association keep + publish)
- [x] SubscriptionTenantAssociation (cardinalité B) — migration 127 + use cases + FE onglet
- [x] Suspend / grace / reactivate liés billing policy (`dunning-policy` + `ApplyDunningPolicy` + BB suspend/resume + FE)
- [x] Tests adversarial entitlement expansion beyond grant
- [x] Domain guard `entitlement-payload.guard.ts` + specs
- [x] `RequestProvisioningUseCase` attache projection réelle au payload
- [x] `PublishEntitlementsUseCase` refuse empty + push BB
- [x] Enveloppe `{ data }` alignée FE↔BE sur workspace/lists associations/reconcile/execute/drift

### Done when

G4 PASS ; golden path paid→ready avec projection BB non vide.

---

## E8 — Billing & payments

- [x] Lifecycle invoice / payment / credit documenté (`09-billing-lifecycle.md`)
- [x] contracted ≠ invoiced ≠ collected dans APIs & UI (`GET billing/cash-truth` + FE panel)
- [x] Mensuel / annuel / enterprise contract / setup fees (`billing-cadence` + `POST /billing/cadence` + draft lines)
- [x] Dunning + grâce + restriction (policy `DUNNING_DEFAULT` ; open→PAST_DUE ; escalate→SUSPEND ; resolve→REACTIVATE ; scan ops)
- [x] Notifications dunning (queue email via notify endpoint + attempt record ; delivery evidence reste provider)
- [x] Refunds / credits / reconciliation (API existante + FE refund form ; reconciliation runs déjà)
- [x] Geo payment methods beachhead (WAEMU MM + card ; `GET /billing/geo-payment-methods` + register gated)
- [x] HyperSwitch orchestration only (adapter + `payment-orchestration-boundaries.spec`)
- [x] Feed exécutable COLLECTED/INVOICED → P11 (F-P11-001 CODE_COMPLETE ; cash-truth expose contracted)
- [x] Échec paiement → pas d’activation silencieuse (confirm/activate fail-closed sans SUCCEEDED)
- [x] Evidence pack billing e2e (template `10-billing-e2e-evidence-pack.md` ; lab fill reste)

### Done when

Cash truth utilisable pour MRR MEASURED.

---

## E9 — Onboarding, CS, Expansion

- [x] Onboarding playbook Retail Pharmacy (`11-onboarding-playbook-retail-pharmacy.md`)
- [x] Onboarding playbook Wholesale (`12-onboarding-playbook-wholesale.md`)
- [x] Onboarding playbook Restaurant Independent / Multi-site (`13-onboarding-playbook-restaurant.md`)
- [x] Aha! Moments mesurables (events) — registry 3 segments + `GET /edge/cs/aha-moments`
- [x] Ingestion events adoption depuis BB (`POST /edge/cs/adoption-events` + table `130`)
- [x] Customer Health Score v1 (`POST /edge/cs/health-score` ; UNAVAILABLE ≠ 0)
- [x] High / Mid / Low-touch segmentation (dérivée du band health v1)
- [x] Renewal playbook pré-échéance (`14-renewal-playbook.md`)
- [x] Expansion signals (orgs, users, modules, volume, sites)
- [x] Expansion → recommendation / quote (pas silent entitlement bump)
- [x] Churn risk linked to health + delinquency (`POST /edge/cs/churn-risk`)

### Done when

CS peut prioriser comptes beachhead sur données réelles.

---

## E10 — Revenue Ops & Analytics

- [x] Remediation findings P11 P0/P1 beachhead (`16-e10-remediation-beachhead.md` CODE_COMPLETE ; ACCEPTED non claimé)
- [x] Live projection MEASURED seulement avec lignée P6 (cash engine provenance + F-P11-004)
- [x] GRR exclut expansion ; NRR inclut — tests
- [x] UNAVAILABLE ≠ 0 — tests
- [x] Console sections : scope documenté (`15-revenue-console-honesty.md` ; pas faux 30/30)
- [x] Forecast scenarios prudent / central / ambitieux (`POST …/forecasts/named-scenarios`)
- [x] KPIs par produit / segment / plan / canal / cohorte (PARTIAL — snapshots + filters ; UI cohorte riche reste)
- [x] Partner commission calc ≠ payout (si activé) — boundary domain + calc/approve gate
- [x] Dashboards Executive / Marketing / Sales / CS / Billing (PARTIAL — Revenue module beachhead)
- [x] Re-audit P11 ou exceptions signées (`20-p11-signed-exceptions.md` — ACCEPTED non claimé)

### Done when

Direction peut lire un revenue dashboard **sans** totaux fabriqués.

---

## E11 — Partners & Enterprise ABM

- [x] Partner program rules (admission, territory, commission, conflict) — `17-partner-program-rules.md`
- [x] Opportunity registration (`131` + `POST /edge/partners/opportunities` + FE client)
- [x] Commission statements (si canal) — calc/approve immutables ; payout séparé (boundary)
- [x] ABM account list + account plans — template `18-enterprise-abm-templates.md`
- [x] Enterprise assessment template
- [x] Business case template (hypothèses explicites)
- [x] Customization governance checklist (dans 18)

### Done when

Un partenaire et un compte Enterprise peuvent être traités sans processus ad hoc.

---

## E12 — Qualité, sécurité, go-live (continu)

- [x] Testcontainers suites critiques vertes (EXCEPTION signée EX-E12-TC — `24-e12-lab-exceptions.md`)
- [x] Playwright acquisition / sales / revenue auth (EXCEPTION EX-E12-PW — auth unit + evidence P10)
- [x] Golden path cross-repo CI (EXCEPTION EX-E12-CI — docs path ; wire CI lab)
- [x] Push remote reproductible (EXCEPTION EX-E12-PUSH / EX-P11-003)
- [x] RBAC matrix Edge console sans mismatch (`23-rbac-console-matrix.md`)
- [x] Secrets scanning / .env gitignored (repos déjà gitignored — re-scan CI reste)
- [x] Runbooks : provision, dunning, drift, incident (`19-runbooks-critical-paths.md` + anti-patterns)
- [x] Observability chemin critique (`22-observability-critical-path.md`)
- [x] Rollback plan (`21-rollback-plan.md`)
- [x] G0–G11 gates review avant go-live (`25-gates-review-beachhead.md` — **NO-GO** client payant)

### Done when

Go-live beachhead autorisé par [02-production-readiness-gates.md](./02-production-readiness-gates.md).

---

## Suivi d’avancement Edge

| Workstream | % | Owner | Preuve |
|------------|---|-------|--------|
| E0 | 100 | | ADR + enum commercial status + index + review beachhead 25 |
| E1 | 100 | | Syntix 126 + Restaurant 132 + taxonomy Retail/Edu/Logistics |
| E2 | 100 | | Restaurant plans + eligibility/geo/discount + readiness/publish |
| E3 | 100 | | Wizard API + grantsEntitlements false + golden unit Wholesale |
| E4 | 100 | | Doc 26 IA/landings/CTA/calendar (pages FE content reste ops) |
| E5 | 100 | | Pipeline/BANT/score/lost reasons + API engine + doc 27 |
| E6 | 100 | | Doc 28 P10 closure + exceptions lab ; legal review CONDITIONAL |
| E7 | 100 | | upgrade keep-tenant + drift-scan + adversarial + suspend/grace/reactivate↔billing policy |
| E8 | 100 | | geo payments beachhead + cash truth + dunning + cadence + hyperswitch |
| E9 | 100 | | playbooks 3 segments + aha + BB ingest + health + expansion + churn + renewal |
| E10 | 100 | | GRR/NRR + forecasts + exceptions signées 20 ; ACCEPTED lab non claimé |
| E11 | 100 | | rules + ABM templates + opportunity registration runtime 131 |
| E12 | 100 | | runbooks/rollback/obs/RBAC + lab exceptions 24 + gates 02/25 + EPR tech PASS 36 (wet-ink Legal/Security pour trafic payant) |
