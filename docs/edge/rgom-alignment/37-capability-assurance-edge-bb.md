# 37 — Assurance capacités Edge ↔ BB (nouveau tenant)

**Date :** 2026-11-17  
**Objectif :** garantir les 5 exigences métier ci-dessous.

## Verdict

| # | Exigence | Statut | Preuve |
|---|----------|--------|--------|
| 1 | Edge gère souscription + billing + provisioning nouveau tenant | **PASS** (prod path `bb_control`) | Adapter `BbControlProvisioningAdapter` ; `MarkInvoicePaidIfSettled` → `RequestProvisioning` → `AdvanceProvisioningAfterPaid` (ready → complete → snapshot → publish → activate) |
| 2 | Nouveau tenant a son espace BB | **PASS** | `POST /control/v1/provision` + poll `/tenants/:id/ready` ; empty entitlements refusés |
| 3 | Plans / entitlements / capabilities / verticales cohérents Edge↔BB | **PASS beachhead** | Dual-write modules + UPPER_SNAKE ; grants nested+top ; `contentHash` publish ; `profile_code` beachhead Syntix→PHARMACY / Restaurant→RESTAURANT |
| 4 | Edge vend selon business model / marketing | **PASS beachhead** | Catalogue commercial P2 + presentations P10 + wizard + sales engine + marketing forms |
| 5 | Endpoints publics plans, segments, formulaires, souscription | **PASS** | Voir surface publique ci-dessous |
| 6 | *(non spécifié dans la requête)* | — | — |

## Config production obligatoire

```bash
EDGE_P7_PROVISIONING_ADAPTER=bb_control
EDGE_BB_CONTROL_BASE_URL=https://…   # https
EDGE_BB_CONTROL_TOKEN=…              # M2M
BILLING_PAYMENT_ADAPTER=hyperswitch|sandbox|http_webhook
# lab_bb interdit en NODE_ENV=production
```

## Surface publique (`@Public`)

| Méthode | Path |
|---------|------|
| GET | `/api/v1/edge/acquisition/public/products` |
| GET | `/api/v1/edge/acquisition/public/products/:slug` |
| GET | `/api/v1/edge/acquisition/public/plans` |
| GET | `/api/v1/edge/acquisition/public/segments` |
| GET | `/api/v1/edge/acquisition/public/catalog` |
| GET | `/api/v1/edge/acquisition/public/forms/:publicSlug` |
| GET | `/api/v1/edge/acquisition/public/checkout/:id` |
| POST | `/api/v1/edge/acquisition/public/checkout` |
| POST | `/api/v1/edge/acquisition/public/applications` |
| GET | `/api/v1/edge/acquisition/public/challenge` |
| POST | `/api/v1/edge/acquisition/public/leads` |
| POST | `/api/v1/edge/acquisition/public/analytics/events` |

## Chaîne paid → ready

```
ConfirmPaymentIntent → MarkInvoicePaidIfSettled (PAID)
  → RequestProvisioning (projection non vide)
  → bb_control.provision(BB)
  → AdvanceProvisioningAfterPaid
       → completeProvisioning (poll ready)
       → CalculateAndSnapshotEntitlements
       → PublishEntitlements (contentHash)
       → ActivateSubscription (gates)
```

## Pharmacie Lite/Pro/… et Restaurant — provisionnable ?

| Offre | Projection non vide | Profil BB | Modules typiques |
|-------|---------------------|-----------|------------------|
| `SYNTIX_LITE` | oui | PHARMACY | pharmacy, inventory, pos, pharmacy.batch/expiry |
| `SYNTIX_PROFESSIONAL` | oui | PHARMACY | Lite + purchasing, reporting, quotas ↑ |
| `SYNTIX_BUSINESS` / `ENTERPRISE` | oui | PHARMACY | + warehouse, api, sso… |
| `OKAPI_REST_STARTER` | oui | RESTAURANT | restaurant, menu, pos, tables |
| `OKAPI_REST_GROWTH` | oui | RESTAURANT | + kitchen, inventory, reporting |
| `OKAPI_REST_MULTI` / `ENTERPRISE` | oui | RESTAURANT | + delivery, api, analytics… |

Preuve unitaire : `beachhead-plan-entitlements.spec.ts` (tous les codes beachhead) + `resolve-commercial-catalog-entitlements.spec.ts` (**universel** : Syntix, Restaurant, Café, Retail, Hospitality résolus par le même helper + merge SQL `numericLimit`).

**Conditions runtime :** `EDGE_P7_PROVISIONING_ADAPTER=bb_control`, BB URL/token, abonnement créé avec `planCode` (ou handoff `offerConfiguration.planCode`) pour attacher le snapshot capabilities — sinon `bb_control` refuse empty.

## Residual honnêtes

1. Quotas Edge `max_organizations` / `max_users` / `max_customers` / `max_products` branchés via projection (CreateOrganization, invitations/membership, CreateCustomer(+guest), CreateProduct) — absent / ≤0 = fail-closed (`*_QUOTA_UNAVAILABLE`) ; seeds TS + mig **144** publient les 4 quotas. Fail-closed Edge si `entitlement_version>0` **ou** `EDGE_CONTROL_NEST_PLANS_WRITE=frozen` (prod/staging) ; lab unfrozen sans projection peut encore retomber sur Nest `plans.max_*` (`source: plan`). La valeur effective attachée au publish est le **merge** snapshot TS + config SQL (`numericLimit` en BDD, migs 145/146) — même mécanisme (overlay `mergeSqlCapabilityRowsIntoCatalogCapabilities`) pour toutes les familles.
2. Caps métier BB (`RESTAURANT_KDS`, `PHARMACY_POS`, …) ≠ modules commerciaux (`kitchen`, `pharmacy`) — ModuleGuard modules OK ; CapabilityGuard détaillé dépend des `capability_definitions` présentes (matrice commerciale W4 documentée, mapping UPPER_SNAKE partiel).
3. Wet-ink Legal/Security hors scope technique.
4. Point 6 de la requête utilisateur était vide — non traité.

## Réserves close (2026-11-18, doc 39 W5)

| Réserve | État | Preuve |
|---------|------|--------|
| Console UI sans champ `numericLimit` (form envoyait capabilityId seulement) | **CLOSED** | Formulaire Configurator (plans/packages/addons) envoie `capabilityId + inclusionType + numericLimit` (3 POST câblés) ; bloc « Linked capabilities & quotas » affiche les restrictions ; `GET addons/:id` ajouté (parity lecture) |
| Gérable ≠ vendable : Retail/Hosp restent PLANNED/INTERNAL_ONLY, price books DRAFT (NEEDS_RESEARCH) | **CLOSED + prouvé** | Publish plan : readiness `product_not_published` (produit CONFIGURING) + `capability_not_includable` (caps PLANNED) ⇒ BLOCKED ; catalogue public AVAILABLE only ; price book : `priceSource` par entry (défaut NEEDS_RESEARCH) + publish fail-closed G11#3 (aucune entry NEEDS_RESEARCH acceptée) — gate jamais contourné en code |
