# P7.15 — Certification Policy

## Certify gate (critical)

Cannot **CERTIFY** if **any required** evidence item is `MISSING` or `FAILED`.

Satisfied statuses for required items: `ATTACHED`, `VERIFIED`, `WAIVED`.

Optional items (e.g. `p714_agents`) may remain `MISSING` without blocking Shared SaaS certify.

## Assemble

Allowed from `DRAFT` / `READY` / `FAILED` / `REVOKED`. Blocked while `ASSEMBLING` or `CERTIFIED` (revoke first).

Seeds default evidence key specs into the package manifest and MISSING item slots.

## Revoke

Allowed only when `CERTIFIED`. Clears certification:

- `packageStatus` → `REVOKED`
- `certifiedAt` → `null`
- `revokedAt` / `revocationReason` set

## Attach evidence

Blocked while `CERTIFIED` or `ASSEMBLING`.
