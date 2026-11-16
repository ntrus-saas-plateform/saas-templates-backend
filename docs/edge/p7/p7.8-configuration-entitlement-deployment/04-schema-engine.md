# P7.8 — Schema Engine

## Location

`domain/configuration-entitlement/configuration-schema.engine.ts`

## Responsibilities

1. **Canonical checksum** — `checksumPayload` / `canonicalJson` (sorted keys).
2. **Validate payload against schema** — lightweight JSON-Schema subset:
   - `type` (`object`, `array`, `string`, `number`, `integer`, `boolean`)
   - `required`, `properties`, `additionalProperties: false`
   - `enum`, `minimum` / `maximum`
3. **Forbid plaintext secrets** — any key matching secret-like patterns with a non-vault string value fails with `SECRET_PLAINTEXT_FORBIDDEN`.
4. **Vault ref acceptance** — `sec_[A-Za-z0-9_-]+` or `vault:…`.

## When it runs

- Schema create (structure sanity).
- Template create / publish (draft payload vs schema).
- Bundle publish / deploy validate step.
- Live executor `configuration.validate_bundle` and verify steps.

## Redaction helper

Use-case layer exposes redaction for audit/outbox/events so secret-shaped values never leave the control plane as plaintext.
