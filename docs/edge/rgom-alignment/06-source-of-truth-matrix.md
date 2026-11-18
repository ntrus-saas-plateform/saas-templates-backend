# 06 — Matrice Source of Truth (SoT)

**Statut :** ACTIVE — verrou RGOM / ADR-021  
**Règle :** une donnée a **une** autorité d’écriture ; les autres systèmes répliquent ou référencent.

---

## Matrice

| Donnée | Système de référence | Notes |
|--------|----------------------|-------|
| Leads / Contacts / Opportunities | Edge Sales (P4) / CRM | Soft links acquisition OK |
| Campagnes / consentements marketing | Edge Marketing (P3) | Forms ≠ acquisition engine |
| Market segments / ICP / personas (templates) | Edge Commercial (P2) | Templates ≠ comptes réels |
| Business Profile templates | Edge Market (P1/P2) | Runtime org profile côté BB |
| Products / technical capabilities | Edge Product (P1) | Statut commercial gate |
| Solution packages / plans / add-ons | Edge Commercial (P2) | Versions immuables publiées |
| Price books / discounts policies | Edge Commercial / Pricing | Jamais inventés |
| Quotes / proposals | Edge Sales | Snapshot configurator |
| Contracts | Edge Contract / Sales | Enterprise overlays |
| Subscriptions | Edge Subscription (P5) | SoT cycle de vie commercial |
| Entitlements commerciaux | Edge Subscription (P5) | Calcul + publish |
| Product Tenant registry | Edge Tenant Mgmt (P7/P8) | 1 produit / tenant |
| Provisioning workflow | Edge P7 | BB exécute control/v1 |
| Entitlements **appliqués** runtime | BB `edge_entitlement_projection` | Copie versionnée Edge |
| Organizations / établissements | BB Identity + Keycloak | Same product only |
| Memberships / RBAC user | BB + Keycloak | ≠ entitlements SaaS |
| Données métier (stock, POS, Rx…) | BB modules verticaux | Org-scoped |
| Invoices / payments / credits | Edge Billing (P6) | HyperSwitch = orchestration |
| MRR/ARR analytics | Edge Revenue (P11) | MEASURED seulement avec lignée P6 |
| Adoption / Aha events | BB émet → Edge CS consomme | Activation ≠ login |

---

## Checklist validation

- [ ] Aucun module BB n’écrit plans/prix Edge en prod (`NEST_PLANS_WRITE=frozen`)
- [ ] Aucun module P11 n’écrit subscriptions/invoices/tenants
- [ ] Configurator n’écrit pas d’entitlements (`grantsEntitlements: false`)
- [ ] Frontend n’est jamais autorité de sécurité
- [ ] Acquisition ne provisionne pas sans conditions commerciales
- [ ] Tests arch / boundary verts sur ces invariants

---

## Anti-patterns (refus PR)

1. `if (plan === 'PROFESSIONAL')` dans BB métier  
2. Créer tenant BB hors `/control/v1` en prod  
3. Fusionner Pharma + Restaurant dans un tenant  
4. Marquer CAC/MRR `MEASURED` sans reconcile  
5. Publier capability `Planned` dans un plan `Published`
