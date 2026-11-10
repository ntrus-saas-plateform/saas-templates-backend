# 06 — Provisioning Request Idempotency & Cancellation (DELTA-05)

| Document ID | P7.0-ACK-DELTA-06 | Decision | **D-IDEM-01 / D-CANCEL-01** |

## Uniqueness

**Functional unique key for an active request:**

`(authorization_id, operation, authorization_version)`

| Case | Behavior |
|------|----------|
| Same key redelivered | Return existing request (idempotent) |
| Same authorization_id, new version | New request allowed if prior closed/superseded; else reject concurrent active |
| Same auth, different operation | Separate requests if both operations authorized |
| Cancelled then replay | Idempotent return of CANCELLED; do not reopen without new auth version |

`correlation_id` / `idempotency_key` also UNIQUE for transport dedup (align with existing `089` UNIQUE correlation pattern — EXTEND, do not break).

## Concurrency (realistic guarantees)

At-least-once + local TX + unique constraints + outbox. **Not** distributed exactly-once.

| Scenario | Expected |
|----------|----------|
| Dual insert | One wins UNIQUE; other reads winner |
| Auth + revoke race | Revoke version check after insert in same TX or compensating mark |
| Timeout after DB commit | Client retry → idempotent get |
| Crash after persist before HTTP | Durable row exists; safe retry |
| Crash before commit | No row; safe retry |

## Cancel (P7.1.05)

**Means:** Operator/API cancels **P7 request** in eligible states (`RECEIVED`/`ACCEPTED` without started workflow).

**Does NOT mean:** P5 revoke, subscription terminate, refund, invoice cancel, resource delete, workflow remote cancel, business data destroy.

RBAC: `platform:provisioning:manage` + reason_code required + audit.

## Audit fields per transition

actor, action, previous_status, new_status, reason_code, timestamp, correlation_id, causation_id, request_id, authorization_id, source, metadata

## Proposed DB constraints (future migration — NOT applied now)

- UNIQUE(authorization_id, operation, authorization_version) WHERE status NOT IN (CANCELLED, REJECTED, SUPERSEDED_BY_REVOKE) — or always unique and status machine prevents reopen  
- UNIQUE(idempotency_key)  
- FK to stored authorization copy  
