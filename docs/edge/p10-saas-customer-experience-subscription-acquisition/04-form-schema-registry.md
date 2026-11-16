# 04 — Form schema registry (remediation)

## Cycle de vie

```
FormSchema → FormVersion (DRAFT) → publish → FormPublication (publicSlug, channel)
                └─ PUBLISHED immutable (assertFormVersionMutable)
```

Applications lient une **version figée** (`formVersionId`) — nouvelle version ≠ mutation des dossiers existants (P10-S09…S11).

## Schema contract

`schema_definition.fields[]` : `key`, `type`, `label`, `required`, `pattern`/`min`/`max`/`options`, `condition`.  
Validation serveur : `form-validation.ts` + `evaluateCondition` / `evaluateConditionRules`.

## Consents (remédiation P0)

`FormPublication.metadata.requiredConsents` (même shape marketing) déclenche la validation lead public.  
Absence de `requiredConsents` → pas d’obligation consent côté P10 (fail-open métier volontaire ; légal ≠ technique).

## Document requirements

`edge_p10_document_requirements` liés schéma/version ; collection via register document (locator privé).

## FE

Éditeur JSON + apply typé — **pas** de DSL drag-and-drop.

## Statut

Registry + publish + validation **DONE**.
