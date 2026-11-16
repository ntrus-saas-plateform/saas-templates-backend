# 19 — Data quality contract

Every metric / forecast / profitability / retention / commission snapshot carries:

| Field | Rule |
|-------|------|
| `definition_version` | Required |
| `source_provenance` | JSONB required |
| `data_quality` | `MEASURED` / `ESTIMATED` / `UNAVAILABLE` |
| `currency` | Required (or UNITLESS metrics) |
| `as_of` | Required |
| `value` | NULL iff UNAVAILABLE |

Overview APIs never coerce missing → 0.
