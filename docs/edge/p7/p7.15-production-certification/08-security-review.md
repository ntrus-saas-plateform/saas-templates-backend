# P7.15 — Security Review

- RBAC: `platform:certification:read|manage|certify|revoke|history:read`.
- Super-admin gets all; operator gets read + history:read.
- P7.1 fail-closed when `provisioningRequestId` bound.
- Durable audit on create / attach / assemble / certify / revoke.
- Compensation → `WAITING_APPROVAL` (no silent re-certify).
- Does **not** claim Modes A–C or production BB without recorded evidence.
