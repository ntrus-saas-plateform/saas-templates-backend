# Personas (Increment 2)

Personas are **role models**, not CRM contacts (P4 owns real people).

## API
- `GET/POST /api/v1/edge/commercial/personas`
- Permission: `platform:commercial:personas:manage`

## Fields
`code`, `name`, `roleLabel`, optional `verticalId`/`productId`, `attributes` JSON, `influenceLevel`, `decisionAuthority`.

Buying committee models and decision journey tables remain schema-ready for Increment 3 expansion (not yet exposed as dedicated APIs).
