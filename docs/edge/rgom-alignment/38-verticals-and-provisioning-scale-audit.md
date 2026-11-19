# 38 — Audit verticaux BB × Edge commercial × échelle provisioning

**Date :** 2026-11-17  
**Règle :** pas de self-ACCEPT. Ce document **refuse** les claims « tous verticaux prêts » et « 50 000 provisions/s ».

---

## 1. Verdict exécutif

| Claim | Verdict |
|-------|---------|
| Edge prêt enterprise-grade **pour tous** les verticaux BB | **FAIL** |
| Edge prêt enterprise-grade **beachhead** Syntix Pharma + Okapi Restaurant | **PASS technique** (docs 36–37) |
| Marketing commercialisation aligné **tous** verticaux | **FAIL** (beachhead seulement) |
| Système robuste à **50 000 demandes de provisioning / seconde** | **FAIL** (écart ~10⁴–10⁵) |

---

## 2. Verticaux BB (exécution) vs Edge (vente)

BB gère **~28 profils** `business_profiles` et **~14 modules Nest** verticaux.  
Edge ne commercialise en beachhead **que 2 Product Tenants** (ADR-021).

### Familles ADR-021 / ADR-055

| Famille | Profils BB (exemples) | Produit Edge commercial | Plans / entitlements | Acquisition publique seedée | Provision `bb_control` |
|---------|----------------------|-------------------------|----------------------|-----------------------------|------------------------|
| **SYNTIX_PHARMA** | PHARMACY, WHOLESALE*, DISTRIBUTION* | `SYNTIX_PHARMA` | `SYNTIX_LITE`…`ENTERPRISE` | PARTIAL (API oui, presentations non seedées) | **PASS** → profil PHARMACY |
| **OKAPI_RESTAURANT** | RESTAURANT, CAFE | `OKAPI_RESTAURANT` | `OKAPI_REST_*` | PARTIAL | **PASS** → RESTAURANT (CAFE alias heuristique seulement) |
| **OKAPI_RETAIL** | SUPERMARKET, GROCERY, AUTO_PARTS, OPTICAL, JEWELRY, TEXTILE, … | `OKAPI_RETAIL` **INTERNAL_ONLY** (133/138) | Lite→Ent **DRAFT** | FAIL public | OPEN lab (doc 44) |
| **OKAPI_HOSPITALITY** | HOTEL_HOSPITALITY | `OKAPI_HOSPITALITY` **INTERNAL_ONLY** (133/138) | Lite→Ent **DRAFT** | FAIL public | OPEN lab (doc 44) |
| **OKAPI_OTHER** | MANUFACTURING, EQUIPMENT_RENTAL, CLINIC stub, HOSPITAL stub, … | scaffolds `OKAPI_MANUFACTURING` / `OKAPI_EQUIPMENT_RENTAL` PLANNED | aucun | FAIL | FAIL |

\* Wholesale/Distribution : packs **intra-Syntix** côté catalogue Edge (capabilities), pas des Product Tenants séparés Edge.

### Modules BB prod sans miroir commercial Edge

`Cafe`, `AutoParts`, `OpticalRetail`, `JewelryRetail`, `TextileFabricRetail`, `FoodRetail`, `ElectronicsRetail`, `HotelHospitality`, `Manufacturing`, `EquipmentRental`, `Distribution` — **exécutables BB**, **non vendables** via Edge catalogue beachhead.

**Doctrine correcte :** ne pas vendre un vertical BB tant que catalogue + plans + entitlements + playbooks + G11 ne sont pas PASS pour ce Product Tenant.

---

## 3. Marketing / commercialisation

| Élément | Beachhead Pharma/Restaurant | Autres verticaux |
|---------|----------------------------|------------------|
| Catalogue P2 + plans distincts | PASS | FAIL |
| Price book honnête (DRAFT / NEEDS_RESEARCH) | PASS (pas de prix inventés) | FAIL |
| Wizard / ICP / packages | PASS | FAIL |
| Demand gen landings seedées | PARTIAL (docs E4 ; contenu ops) | FAIL |
| Trafic marketing payant | **NO-GO** (Legal/Security wet-ink) | NO-GO |

---

## 4. Échelle provisioning — 50 000/s

### Ce que le code fait aujourd’hui

```
PAID → RequestProvisioning (HTTP sync POST /control/v1/provision)
     → BB: CREATE DATABASE + ~143 migrations tenant + Keycloak + profile + entitlements
     → Advance: poll ready + publish + activate
```

| Paramètre | Valeur / preuve |
|-----------|-----------------|
| Mode | **SYNC_MONOLITH** (1 POST HTTP = saga complète) |
| Throttle Nest défaut | ~100 req / 60 s ≈ **1,7 req/s/instance** |
| Load smoke doc 33 | **N=20 séquentiel**, pas de 50k |
| `test:load` | liveness / idempotency — **hors** provision tenant |
| Timeout Edge défaut historique | 15 s (souvent < durée réelle provision) |

### Capacité réaliste actuelle

| Métrique | Ordre de grandeur |
|----------|-------------------|
| Nouveaux tenants / s (cluster typique) | **≪ 1 – quelques / s** (DB-per-tenant + migrations) |
| Ready polls / s | plus élevés, mais non certifiés 50k |
| **50 000 provisions / s** | **impossible** sans changer le modèle (pools pré-provisionnés / template DB / async massif) |

50 000/s = ~4,3 milliards de tenants/jour — incompatible avec `CREATE DATABASE` + 143 migrations par demande.

### Roadmap échelle (hors claim actuel)

1. **Async** : `202 Accepted` + file (outbox/Kafka) ; paid ne bloque pas sur HTTP BB.  
2. **Template DB** / golden image ; migrations différées par profil.  
3. **SkipThrottle / tier M2M** control/v1.  
4. **Workers** concurrence bornée + backpressure.  
5. **Pré-pool** de tenants « warm » pour allocation ms (allocation ≠ création).  
6. Benchmarks signés avant tout claim chiffré.

---

## 5. Ce qui est enterprise production-ready

| Périmètre | Statut |
|-----------|--------|
| Beachhead Syntix + Restaurant — technique G0–G11 | **PASS** (`36`) |
| Tous verticaux BB commercialisés Edge | **FAIL** |
| 50k provisions/s | **FAIL** |
| Pilotes beachhead (config `bb_control` + mig + Legal) | **CONDITIONAL GO** |

---

## 6. Actions produit recommandées

1. **Ne pas** affirmer « tous les verticaux prêts ».  
2. Roadmap Product Tenants : Retail → Hospitality → Manufacturing (gated G11 chacun).  
3. Traiter 50k/s comme **objectif d’architecture future**, pas comme capacité certifiée.  
4. Publier présentations P10 + price MEASURED avant campagne payante beachhead.

---

## 7. Suivi plan actif (2026-11-18)

Plan maître : [39](./39-master-improvement-alignment-plan.md) · Architecture scale : [40](./40-provisioning-scale-architecture.md).

| Item | Statut |
|------|--------|
| Phase A scaffold PLANNED + bindings + jobs | **DONE** |
| Deferred advance + worker API | **DONE** (fondation H1) |
| Warm pool / 50k claim | H2 **scaffold DONE** (flag OFF) ; claim 50k/s + flotte réelle **FORBIDDEN** sans H3 |
| CAFE Controlled pack | **SEEDED** (mig 135, DRAFT) |
