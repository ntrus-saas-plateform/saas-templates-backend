# P10 — Database migrations

## Fichier

`migrations/control-plane/117_edge_p10_acquisition_foundation.sql`

Enregistrement : `schema_migrations` version `117_edge_p10_acquisition_foundation`.

## Contenu

1. Insert permissions `platform:acquisition:*` + grant `EDGE_PLATFORM_SUPER_ADMIN`
2. Création de toutes les tables `edge_p10_*` (voir `data-model.md`)
3. Indexes status / email / aggregate
4. CHECKs de statuts alignés domain types
5. Commentaires SQL : no payment credentials ; soft UUID refs

## Prérequis

- Migration P9 `116_edge_p9_operations_core.sql` appliquée
- Tables P1 `edge_products`, P2 `edge_commercial_plans` existantes (FK dures présentations)

## Appliquer

Suivre le runner control-plane habituel du repo (ne pas inventer un chemin alternatif ici).

## Tests migration

Pas d’E3 Testcontainers dédié mig 117 documenté à ce stade — **pending**.

## Statut

**SQL foundation livré.** Runtime DB = appliquer 117 avant usage API.
