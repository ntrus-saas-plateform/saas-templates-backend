# 46 — Pack evidence Legal / Publish (sans forger)

**Statut :** TEMPLATE ops — signatures humaines obligatoires  
**Liens :** [43](./43-legal-publish-gate.md) · [30](./30-dpa-beachhead.md) · [02](./02-production-readiness-gates.md)

## Checklist avant `PUBLISHED` P10 beachhead

| # | Item | Owner | Preuve | Done |
|---|------|-------|--------|------|
| 1 | DPA wet-ink (colonnes [30](./30-dpa-beachhead.md)) | Legal | PDF signé + date | ☐ |
| 2 | Security residual go | Security | ticket / audit | ☐ |
| 3 | Price book MEASURED (pas NEEDS_RESEARCH) pour plans publiés | RevOps | export PB | ☐ |
| 4 | G11 beachhead technique encore PASS | Eng | [34](./34-g11-product-readiness-matrix.md) | ☐ |
| 5 | Presentations en REVIEW (mig 139) | Eng | SQL status | ☐ |
| 6 | Sign-off Product + Eng + RevOps | Product | email / ticket | ☐ |

## Commandes ops (après signatures)

```sql
-- UNIQUEMENT après checklist 1–6 cochée
UPDATE edge_p10_product_presentations
SET status = 'PUBLISHED', updated_at = NOW(),
    metadata = metadata || jsonb_build_object('publishedEvidence', '46-legal-publish-evidence-pack', 'publishedAt', NOW())
WHERE code IN ('PRES_SYNTIX_PHARMA_BEACHHEAD', 'PRES_OKAPI_RESTAURANT_BEACHHEAD')
  AND status = 'REVIEW';

UPDATE edge_p10_plan_presentations
SET status = 'PUBLISHED', updated_at = NOW()
WHERE code IN ('PLANPRES_SYNTIX_LITE', 'PLANPRES_OKAPI_REST_STARTER')
  AND status = 'REVIEW';
```

## Interdits

- ❌ Exécuter le SQL ci-dessus pour « débloquer le marketing » sans signatures  
- ❌ Basculer Retail/Hospitality en AVAILABLE depuis ce pack  
- ❌ Inventer des montants prix  

## Journal

| Date | Acteur | Action | Réf |
|------|--------|--------|-----|
| 2026-11-18 | Eng | Pack créé ; P10 reste REVIEW | mig 139 |
