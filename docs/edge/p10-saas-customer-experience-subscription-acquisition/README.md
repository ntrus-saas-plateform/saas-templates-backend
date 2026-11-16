# P10 — SaaS Customer Experience & Subscription Acquisition

**Programme :** Okapi Edge Control Plane  
**Phase :** P10  
**Branche :** `feature/console`  
**Objectif :** Expérience client SaaS et acquisition d’abonnements — présentations produit/plan, prospects, formulaires d’acquisition, dossiers, qualification, devis, checkout orchestration, handoff subscription — **sans** dupliquer P1–P6 ni le moteur marketing.

## Verdict remédiation

**READY FOR INDEPENDENT AUDIT** — voir [`19-p10-acceptance-report.md`](./19-p10-acceptance-report.md).

P0 consent FIXED · Redis rate-limiter · module acquisition + `/acquire` · mig 117/119/(120) · scénarios 40/40 · Playwright 18.  
Pas de self-ACCEPT enterprise ; items différés documentés.

## SHAs

| Repo | Baseline audit | HEAD P10 (approx.) |
|------|----------------|--------------------|
| Backend | `4fadf08` | `0c0df38` (+ WT remédiation) |
| Frontend | `d7dcb2e` | `e5a8e32` |

Travail courant sur `feature/console` **au-dessus** des baselines historiques (P8/P9 inclus).

## Remotes

| Repo | Remote réel |
|------|-------------|
| Backend | `https://github.com/ntrus-saas-plateform/saas-templates-backend.git` |
| Frontend | `https://github.com/ntrus-saas-plateform/saas-template-frontend.git` |

---

## Package remédiation (00–19) — **entrée audit**

| # | Fichier | Rôle |
|---|---------|------|
| 00 | [`00-implementation-summary.md`](./00-implementation-summary.md) | Synthèse livré / différé / P0 |
| 01 | [`01-architecture-and-boundaries.md`](./01-architecture-and-boundaries.md) | Hexagone + frontières P1–P9 |
| 02 | [`02-domain-model.md`](./02-domain-model.md) | Agrégats & policies |
| 03 | [`03-product-acquisition-contracts.md`](./03-product-acquisition-contracts.md) | Présentations, leads, prix display |
| 04 | [`04-form-schema-registry.md`](./04-form-schema-registry.md) | Schémas / publish / consents |
| 05 | [`05-customer-journeys.md`](./05-customer-journeys.md) | Journey records |
| 06 | [`06-application-and-document-management.md`](./06-application-and-document-management.md) | Dossiers + storage FS/S3/scan |
| 07 | [`07-qualification-and-enterprise-acquisition.md`](./07-qualification-and-enterprise-acquisition.md) | Qualification / quotes |
| 08 | [`08-checkout-orchestration.md`](./08-checkout-orchestration.md) | Checkout + InitiateAcquisitionPayment |
| 09 | [`09-customer-portal.md`](./09-customer-portal.md) | Snapshot + shell FE |
| 10 | [`10-public-api-and-security.md`](./10-public-api-and-security.md) | Public API, Redis RL, trust proxy |
| 11 | [`11-customer-communications.md`](./11-customer-communications.md) | Queue comms |
| 12 | [`12-analytics-and-attribution.md`](./12-analytics-and-attribution.md) | Events / funnel |
| 13 | [`13-database-and-migrations.md`](./13-database-and-migrations.md) | 117 / 119 / 120 |
| 14 | [`14-frontend-implementation.md`](./14-frontend-implementation.md) | Console + `/acquire` |
| 15 | [`15-test-strategy.md`](./15-test-strategy.md) | Pyramide tests |
| 16 | [`16-test-evidence.md`](./16-test-evidence.md) | Evidence 40/40 · Playwright 18 |
| 17 | [`17-security-review.md`](./17-security-review.md) | Revue sécu post-P0 |
| 18 | [`18-p5-p6-p7-p8-p9-integration-contracts.md`](./18-p5-p6-p7-p8-p9-integration-contracts.md) | Contrats inter-phases |
| 19 | [`19-p10-acceptance-report.md`](./19-p10-acceptance-report.md) | **Verdict final** |

> Note juridictionnelle : consentement technique ≠ conformité légale — revue juridique par juridiction requise.

---

## Documents thématiques préexistants (conservés)

| Fichier | Rôle |
|---------|------|
| `00-baseline-repository-audit.md` | Audit réutilisation P1–P6 / non-duplication (baseline pré-impl) |
| `architecture.md` | Positionnement hexagonal + agrégats |
| `bounded-contexts.md` | Contextes bornés P10 |
| `account-prospect-customer-model.md` | Modèle prospect → customer / handoff |
| `product-discovery.md` | Découverte produit |
| `commercial-product-presentation.md` | Présentations produit |
| `plan-presentation.md` | Plans + `price_display_mode` |
| `subscription-form-engine.md` | Moteur formulaires |
| `form-schema-contract.md` | Contrat schéma |
| `conditional-form-logic.md` | Conditions |
| `vertical-specific-acquisition.md` | Filtrage vertical |
| `document-collection.md` | Documents |
| `qualification-workflows.md` | Qualification / SoD |
| `enterprise-acquisition.md` | Enterprise / quote |
| `application-lifecycle.md` | Cycle de vie dossier |
| `subscription-configuration.md` | Intent config avant handoff |
| `checkout-orchestration.md` | Sessions checkout (doc thématique) |
| `p5-integration.md` / `p6-integration.md` / `p7-p8-integration.md` | Intégrations |
| `customer-portal.md` / `customer-journey.md` | Portal / journey |
| `communications.md` / `analytics.md` | Comms / analytics |
| `security-privacy.md` / `rbac-permissions.md` | Sécu / RBAC |
| `api-contracts.md` / `data-model.md` / `database-migrations.md` | API / data / mig |
| `frontend-architecture.md` / `testing-strategy.md` | FE / tests |
| `e2e-scenario-evidence.md` / `playwright-live-evidence.md` / `migration-apply-evidence.md` | Evidence |
| `known-limitations.md` / `implementation-report.md` / `acceptance-report.md` | Limites / rapports historiques |

## Règles non négociables

- Ne jamais inventer produits ou prix — refs P1/P2 ; `price_display_mode` explicite.
- Pas de credentials paiement ; checkout orchestre, P6 facture/paie.
- Pas de tenant IAM dans P10 (P7/P8 autorités).
- Marketing forms ≠ moteur formulaires acquisition P10 (consent domain partagé OK).
- Versions publiées immutables.
- Handoff P5 = orchestration + outbox ; pas d’ownership entitlement.

## Code (référence)

| Zone | Chemin |
|------|--------|
| Domain | `src/modules/edge/domain/acquisition/*` + `domain/marketing/marketing-consent.ts` |
| Use-cases | `application/acquisition/acquisition.use-cases.ts` |
| Rate limiter | `infrastructure/acquisition/acquisition-rate-limiter.ts` |
| Storage / scan / handoff | `infrastructure/acquisition/*` |
| Controllers | `acquisition.controller.ts`, `acquisition-public.controller.ts` |
| Migrations | `117`, `119`, `120_edge_marketing_consent_not_provided.sql` |
