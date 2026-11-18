# 43 — Gate Legal / Publish (P10 + trafic payant)

**Statut :** ACTIVE — bloque PUBLISHED marketing  

## Règle

Aucune presentation P10 beachhead ne passe **PUBLISHED** et aucun trafic marketing payant n’est autorisé tant que :

| Gate | Preuve |
|------|--------|
| DPA wet-ink | [30](./30-dpa-beachhead.md) colonnes signature remplies |
| Security residual | [02](./02-production-readiness-gates.md) Security |
| Price MEASURED | price book research ≠ NEEDS_RESEARCH pour offres publiées |
| Product AVAILABLE | G11 PASS pour ce Product Tenant |

## État actuel (2026-11-18)

| Artefact | Statut |
|----------|--------|
| `PRES_SYNTIX_PHARMA_BEACHHEAD` | **REVIEW** (mig 139) — publish bloqué |
| `PRES_OKAPI_RESTAURANT_BEACHHEAD` | **REVIEW** — publish bloqué |
| Retail / Hospitality presentations | **DRAFT** roadmap |
| DPA signatures | **vides** (template only) |

## Opérateur

Ne pas forcer `UPDATE … SET status='PUBLISHED'` sans checklist ci-dessus.  
Checkout public refuse déjà les presentations non PUBLISHED.
