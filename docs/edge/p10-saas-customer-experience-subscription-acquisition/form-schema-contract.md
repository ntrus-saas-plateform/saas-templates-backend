# P10 — Form schema contract

## Structure `schema_definition`

```json
{
  "fields": [
    {
      "key": "company_name",
      "type": "string",
      "label": "Company",
      "required": true,
      "pattern": null,
      "min": null,
      "max": null,
      "options": null,
      "condition": null
    }
  ]
}
```

## Types de champs supportés (validation serveur)

| `type` | Règles |
|--------|--------|
| `string` / `text` / `email` / `phone` | string ; `pattern` RegExp ; email format |
| `number` / `integer` | number ; `min` / `max` |
| `boolean` | boolean |
| `select` / `enum` | valeur ∈ `options` |
| `multiselect` | array ∈ `options` |
| autre | pas de type-check strict (pass-through) |

## Règles fail-closed

- Champs inconnus rejetés sauf `allowUnknownFields`.
- Champs avec `condition` non satisfaite → non visibles → non requis.
- `condition_rules` globaux évalués via `evaluateConditionRules`.
- Version `PUBLISHED` : mutation interdite (`FORM_VERSION_IMMUTABLE`).

## Answers

Stockés dans `edge_p10_application_answers` (`field_key` + `value` JSONB).  
Input accepté : map `{ key: value }` ou array `{ fieldKey, value }`.

## Statut

Contrat **implémenté** dans `form-validation.ts` + types domain. Pas de JSON Schema externe / OpenAPI field codegen.
