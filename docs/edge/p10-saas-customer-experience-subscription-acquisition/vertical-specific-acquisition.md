# P10 — Vertical-specific acquisition

## Intent

Adapter formulaires / parcours par vertical métier (ex. santé, finance) **sans** forker le moteur.

## Implémenté

`GetPublishedFormForProductUseCase` accepte `vertical?: string | null` et filtre sur `form.metadata.vertical` / `metadata.verticalId` si fourni.

Document requirements et journey `definition` / `metadata` peuvent porter des clés verticales — **convention JSON**, pas de table `edge_p10_verticals`.

## Non implémenté

- Catalogue de verticals dédié
- Templates pré-packagés par industrie
- Feature flags multi-vertical runtime
- UI FE de sélection vertical

## Verdict

**Hook metadata minimal DONE ; vertical packs NOT STARTED.**
