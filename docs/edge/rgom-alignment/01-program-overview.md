# 01 — Vue d’ensemble du programme RGOM Alignment

**Version :** 1.0  
**Date :** 2026-11-17  
**Audience :** Direction produit, engineering Edge, engineering BB, RevOps, marketing, sales, CS

---

## 1. Ambition

Construire une machine de commercialisation capable de :

1. Comprendre le marché et le business du prospect.
2. Composer une offre (profile → packages → plan → add-ons → prix).
3. Acquérir et convertir (self-service, sales-assisted, enterprise).
4. Provisionner un Product Tenant + entitlements.
5. Activer la valeur métier dans le BB (multi-établissements).
6. Retenir, renouveler, expander.
7. Mesurer des revenus et une rentabilité **honnêtes**.

---

## 2. État de départ (honnête)

| Domaine | État |
|---------|------|
| Catalogue produit / commercial (P1–P2) | Moteurs présents ; contenu marché à peupler |
| Marketing / WhatsApp (P3) | MVP control-plane ; GTM sites incomplets |
| Sales CRM (P4) | Pipeline + adapters ; enablement incomplet |
| Subscription / entitlements (P5) | Présent ; projection BB lab souvent vide |
| Billing (P6) | Présent ; cash feed P11 à fermer |
| Provisioning / tenant (P7–P8) | Fort techniquement |
| Operations (P9) | Présent |
| Acquisition CX (P10) | MVP READY FOR AUDIT ≠ enterprise prod |
| Revenue ops (P11) | PARTIAL — NOT ACCEPTED |

**Conclusion :** chassis aligné ; pas encore commercialement complet ni certifié production.

---

## 3. Principes non négociables

- [x] Une verticale = un marché spécialisé commercialisé séparément
- [x] Business Profile ≠ abonnement
- [x] Capabilities techniques ≠ offres commerciales
- [x] Plans Lite / Professional / Business / Enterprise = packaging par produit
- [x] Configurator recommande ; n’accorde pas d’entitlements
- [x] Edge = SoT souscriptions / prix / entitlements commerciaux
- [x] BB = SoT opérations métier + enforcement capability
- [x] Frontend ≠ autorité de sécurité
- [x] HyperSwitch ≠ catalogue commercial
- [x] `UNAVAILABLE` ≠ zéro mesuré
- [x] Product Tenant = 1 produit (ADR-021)
- [x] Org BB = établissement du même produit (ADR-055 BB)

---

## 4. Architecture cible (rappel)

```text
Market Intelligence → Segmentation → ICP → Positioning
        ↓
Solution Packages → Plans → Add-ons → Pricing
        ↓
Demand Gen / Sales / Partners
        ↓
Quote / Contract / Checkout
        ↓
Product Tenant + Subscription + Entitlements
        ↓
BB Provision + Orgs (établissements) + Capability gates
        ↓
Onboarding → Activation → Adoption → Retention → Expansion
        ↓
Revenue Intelligence (MRR/ARR/GRR/NRR) avec lignée billing
```

---

## 5. Definition of Done — Programme

Le programme est **DONE** seulement si tous les points suivants sont vrais :

### 5.1 Golden path Syntix Wholesale

- [ ] Prospect configure (Wholesale, 3 warehouses, 45 users)
- [ ] Recommandation Business + add-ons **expliquée**
- [ ] Prix issu du price book (pas inventé)
- [ ] Checkout / contrat → subscription
- [ ] Entitlements calculés et publiés
- [ ] BB provisionné ; projection non vide
- [ ] Orgs sites créables dans quotas
- [ ] Workflows batch / expiry / B2B gated
- [ ] Activation mesurée (pas seul login)
- [ ] MRR visible avec lignée invoiced/collected

### 5.2 Golden path Restaurant multi-sites

- [ ] Tenant Restaurant unique
- [ ] 2+ organizations (établissements)
- [ ] User membre de plusieurs orgs du même tenant
- [ ] Quotas Edge enforcés à la création d’org
- [ ] POS / cuisine gated par capabilities

### 5.3 Groupe multi-activités

- [ ] Même Account CRM peut avoir Tenant Pharma + Tenant Restaurant
- [ ] Aucune fusion de données métier cross-produit
- [ ] Facturation / entitlements séparés

### 5.4 Certification

- [x] Gates production (02) 100 % PASS **technique** beachhead ([36](./36-enterprise-production-ready-certification.md))
- [x] P10 P0 fermés sur beachhead (code + exceptions lab documentées)
- [x] P11 P0 fermés / exceptions signées sur beachhead
- [x] Aucune capability Planned vendue comme Available
- [x] Remote Git reproductible — procédure [35](./35-remote-push-reproducibility.md) (credentials ops)
- [ ] Wet-ink Legal + Security (requis pour trafic marketing payant large — hors TECHNICAL CERT)

---

## 6. Hors scope explicite (pour rester enterprise-grade)

| Hors scope immédiat | Pourquoi |
|---------------------|----------|
| Lancer toutes les verticales GTM en parallèle | Capacité support insuffisante |
| Remplacer le CRM externe complet (Salesforce…) | P4 suffit comme SoT Edge sales ; intégration ultérieure |
| Personnalisations Enterprise illimitées | Gouvernance customisation obligatoire |
| Inventer TAM/SAM/SOM ou prix | Interdit par P2 |

---

## 7. Rôles

| Rôle | Responsabilité |
|------|----------------|
| Product Marketing | Contenu ICP, packages, messaging |
| Edge Engineering | E0–E12 |
| BB Engineering | B0–B9 |
| RevOps | Process, KPI definitions, gates |
| Finance / Billing | P6 + cash truth |
| Legal | Consent / DPA / jurisdictions |
| CS | Activation, health, renewal |

---

## 8. Suivi

- Checklists : cocher uniquement avec preuve liée (PR, test ID, doc).
- Revue hebdo chemin critique (03-cross-dependencies).
- Go-live beachhead seulement après gates 02.
