# P10 — Commercial product presentation

## Objectif

Contenu CX versionné référencant un `product_id` P1 : draft → publish, versions immutables après publish.

## Modèle

- `edge_p10_product_presentations` — code, slug, title, status, locale, `current_published_version_id`
- `edge_p10_product_content_versions` — `content` JSONB, `immutable_after_publish = TRUE`
- `edge_p10_segment_presentations` — ciblage display (`targeting_rules` JSONB)

## API console

| Méthode | Route | Permission |
|---------|-------|------------|
| GET | `edge/acquisition/products` | `read` |
| POST | `edge/acquisition/products` | `manage` |
| POST | `edge/acquisition/products/:id/content` | `manage` |
| POST | `edge/acquisition/products/:id/content/:versionId/publish` | `manage` |
| GET/POST | `edge/acquisition/segments` | `read` / `manage` |

## Policies

- `assertContentVersionMutable` — refuse mutation si `PUBLISHED` + immutable.
- Publish : outbox `edge.p10.product_content.published` + audit.

## Statut

| Élément | État |
|---------|------|
| Domain types + policy | DONE |
| Use-cases create / content / publish | DONE |
| PG + controllers | DONE |
| FE éditeur de contenu | NOT STARTED |

## Interdits

- Dupliquer attributs catalogue P1 comme SoT.
- Muter une version publiée.
