# P10 — SaaS Customer Experience & Subscription Acquisition

**Programme :** Okapi Edge Control Plane  
**Phase :** P10  
**Branche :** `feature/console`  
**Objectif :** Expérience client SaaS et acquisition d’abonnements — présentations produit/plan, prospects, formulaires d’acquisition, dossiers, qualification, devis, checkout orchestration, handoff subscription — **sans** dupliquer P1–P6 ni le moteur marketing.

## État

| Sous-phase | Statut |
|------------|--------|
| P10.0 Baseline + mig 117 + domain | **DONE** |
| P10.1–P10.10 BE (presentations → analytics) | **DONE (core)** |
| P10.11 Console `/edge/acquisition` | **DONE (MVP)** |
| P10.8 Public `/acquire` + portal/checkout | **DONE (MVP)** |
| P10.12 Hardening + scénarios 40 evidence | **DONE** (domain/application 40/40 ; browser live pending) |

**Verdict courant :** `P10 READY FOR AUDIT`

## Baseline SHAs

| Repo | SHA | Note |
|------|-----|------|
| Backend (`saas-templates-backend`) | baseline pré-P10 `25920e0` | HEAD courant : **see final delivery** |
| Frontend (`saas-template-frontend`) | baseline `0994253` | `/edge/acquisition` + `/acquire` livrés |

## Remotes

| Repo | Remote réel |
|------|-------------|
| Backend | `https://github.com/ntrus-saas-plateform/saas-templates-backend.git` |
| Frontend | `https://github.com/ntrus-saas-plateform/saas-template-frontend.git` |

## Index des documents

| # | Fichier | Rôle |
|---|---------|------|
| 0 | `00-baseline-repository-audit.md` | Audit réutilisation P1–P6 / non-duplication |
| — | `architecture.md` | Positionnement hexagonal + agrégats |
| — | `bounded-contexts.md` | Contextes bornés P10 |
| — | `account-prospect-customer-model.md` | Modèle prospect → customer / handoff |
| 1 | `product-discovery.md` | Découverte produit publique / console |
| 2 | `commercial-product-presentation.md` | Présentations produit + content versions |
| 3 | `plan-presentation.md` | Affichage plans + `price_display_mode` |
| 4 | `subscription-form-engine.md` | Moteur formulaires d’acquisition |
| 5 | `form-schema-contract.md` | Contrat schéma / champs |
| 6 | `conditional-form-logic.md` | Conditions contraintes (AND/OR/EQ/…) |
| 7 | `vertical-specific-acquisition.md` | Filtrage vertical (metadata) |
| 8 | `document-collection.md` | Exigences + refs documents |
| 9 | `qualification-workflows.md` | Qualification / SoD |
| 10 | `enterprise-acquisition.md` | Parcours enterprise / quote |
| 11 | `application-lifecycle.md` | Cycle de vie dossier |
| 12 | `subscription-configuration.md` | Intent config avant handoff P5 |
| 13 | `checkout-orchestration.md` | Sessions checkout (pas de credentials) |
| 14 | `p5-integration.md` | Handoff = record + outbox, pas SoT subscription |
| 15 | `p6-integration.md` | Refs paiement P6 uniquement |
| 16 | `p7-p8-integration.md` | Pas d’IAM tenant dans P10 |
| 17 | `customer-portal.md` | Snapshot portail prospect |
| 18 | `customer-journey.md` | Journey definitions / instances |
| 19 | `communications.md` | Queue comms acquisition |
| 20 | `analytics.md` | Events + funnel honnête |
| 21 | `security-privacy.md` | Sécurité / vie privée |
| 22 | `rbac-permissions.md` | Permissions `platform:acquisition:*` |
| 23 | `api-contracts.md` | Routes console + public |
| 24 | `data-model.md` | Tables `edge_p10_*` |
| 25 | `database-migrations.md` | Migration 117 |
| 26 | `frontend-architecture.md` | Chemins attendus FE |
| 27 | `testing-strategy.md` | Unit/domain + E2E pending |
| 28 | `known-limitations.md` | Limites honnêtes |
| 29 | `implementation-report.md` | Rapport d’implémentation |
| 30 | `acceptance-report.md` | Gates A–L + verdict |

## Règles non négociables

- Ne jamais inventer produits ou prix — refs P1/P2 uniquement ; `price_display_mode` explicite.
- Pas de champs credentials paiement ; checkout orchestre, P6 facture/paie.
- Pas de tenant IAM dans P10 (P7/P8 restent autorités).
- Marketing forms (campagnes) ≠ moteur de formulaires d’acquisition P10.
- Versions publiées de contenu / formulaires **immutables**.
- Handoff subscription vers P5 = **enregistrement d’orchestration + outbox** ; pas d’ownership entitlement.

## Migration

- Dernière P9 : `116_edge_p9_operations_core.sql`
- Fondation P10 : **`117_edge_p10_acquisition_foundation.sql`**

## Code (référence)

| Zone | Chemin |
|------|--------|
| Domain | `src/modules/edge/domain/acquisition/*` |
| Use-cases | `src/modules/edge/application/acquisition/acquisition.use-cases.ts` |
| PG repo | `src/modules/edge/infrastructure/acquisition/pg-acquisition.repository.ts` |
| Controllers | `acquisition.controller.ts`, `acquisition-public.controller.ts` |
| DTO | `presentation/dto/acquisition.dto.ts` |
| Providers | `edge-application.providers.ts` (bloc P10) |
