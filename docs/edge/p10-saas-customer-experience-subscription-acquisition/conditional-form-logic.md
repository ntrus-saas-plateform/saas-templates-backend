# P10 — Conditional form logic

## Langage contraint

Fichier : `domain/acquisition/form-condition.ts`.

**Opérateurs uniquement :** `AND` | `OR` | `EQ` | `NEQ` | `IN` | `EXISTS`.

- **Pas** d’`eval`, **pas** d’exécution JS, **pas** d’expressions libres.
- Chemins champs : dot-path ; `__proto__` / `prototype` bloqués.

## Exemple

```json
{
  "op": "AND",
  "args": [
    { "op": "EQ", "field": "segment", "value": "enterprise" },
    { "op": "EXISTS", "field": "company_size" }
  ]
}
```

Array de règles → AND implicite (`evaluateConditionRules`).

## Usage

| Zone | Rôle |
|------|------|
| `FormFieldDefinition.condition` | Visibilité champ |
| `FormVersion.condition_rules` | Conditions globales submit |
| `DocumentRequirement.condition_rules` | Exigence documentaire conditionnelle (stockée ; évaluation à l’usage caller) |

## Tests

`form-condition.spec.ts` — domain/unit present.

## Statut

**DONE** côté domain. Pas de DSL UI visuelle FE.
