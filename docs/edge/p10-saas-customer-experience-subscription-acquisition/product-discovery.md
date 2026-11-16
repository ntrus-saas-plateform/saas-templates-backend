# P10 — Product discovery

## Objectif

Exposer des **présentations produit** publiées pour découverte publique et console, filtrées par disponibilité commerciale P1 — sans inventer de catalogue.

## Implémenté (BE)

| Capacité | Statut | Preuve |
|----------|--------|--------|
| Liste publique produits | **DONE** | `GET edge/acquisition/public/products` → `ListPublicProductDiscoveryUseCase` |
| Page publique par slug | **DONE** | `GET edge/acquisition/public/products/:slug` → `GetPublicProductPageUseCase` |
| Filtre `CommercialAvailability` | **DONE** | Set `AVAILABLE` / `BETA` / `CONTROLLED_ROLLOUT` (+ alias `BY_REQUEST`, `ENTERPRISE`) |
| Liste console | **DONE** | `GET edge/acquisition/products` (`platform:acquisition:read`) |
| Overview counts | **DONE** | `GET edge/acquisition/overview` |

## Règles

- SoT produit = **P1** (`edge_products`) ; P10 ne stocke que `edge_p10_product_presentations` + content versions.
- Une présentation non `PUBLISHED` n’apparaît pas en public.
- Produit commercialement non présentable → exclu de la discovery publique.

## Non livré

- UI FE `/acquire` (landing discovery) et `/edge/acquisition` (console) — **absent**.
- SEO / CDN / pages marketing riches — hors scope runtime actuel.
- Ranking / search full-text — filtre list + `q` basique côté repo uniquement si câblé.

## Verdict

**Core API discovery BE livré ; surface FE pending.**
