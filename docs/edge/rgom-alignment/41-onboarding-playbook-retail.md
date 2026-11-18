# 41 — Onboarding playbook — Okapi Retail (roadmap)

**Statut :** DRAFT / INTERNAL_ONLY — G11 PARTIAL (doc 39 Phase C)  
**Profil BB :** `SUPERMARKET` (défaut)  
**Plans :** `OKAPI_RETAIL_LITE` → `ENTERPRISE`

## Prérequis

1. Product Tenant `OKAPI_RETAIL` existe (mig 133) — `commercial_availability=INTERNAL_ONLY`  
2. Entitlements non vides pour le plan choisi  
3. Provision adapter `bb_control` + `profile_code=SUPERMARKET`  
4. **Interdit** : vente publique / PUBLISHED presentation tant que G11 PASS incomplet  

## Parcours lab (opérateur)

1. Créer subscription + item plan Retail  
2. PAID → RequestProvisioning (`profile_code` SUPERMARKET)  
3. Poll ready → publish entitlements → activate  
4. Vérifier ModuleGuard retail/inventory/pos côté BB  

## Exit G11 Retail (encore ouvert)

- [ ] e2e lab `bb_control` documenté  
- [ ] Playbooks CS + demand gen  
- [ ] Price MEASURED  
- [ ] Présentation P10 PUBLISHED (après Legal)  
- [ ] Sign-off Product / Eng / RevOps  
