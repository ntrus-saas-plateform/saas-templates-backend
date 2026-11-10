# 11 — G1 Acceptance and Evidence Criteria (DELTA-10)

| Document ID | P7.0-ACK-DELTA-11 |

## G1 meaning

Prove P7.1 can **receive and durably record** an authorized provisioning request with **zero technical side effects**.

## Positive scenarios (required)

Valid auth → coherent account/product/subscription/operation → durable request + history → idempotent redelivery → survive restart → RBAC operator read → eligible cancel.

## Negative scenarios (required)

Absent/expired/revoked/bad integrity/issuer/audience/version/account/product/subscription/operation · P5 unavailable when verify required · flag off · dup/old replay · unauthorized cancel · concurrent conflict.

## Resilience scenarios (required)

Crash before/after commit · timeout after commit · restart · redelivery · out-of-order · concurrent revoke · outbox/inbox failure · reconciliation.

## Zero side effects (must prove)

No: product tenant infra create, DB create, KC realm/org/client create, BB provision call, infra deploy, technical activation, P7.4 executing steps.  
Allowed: persist Authorization copy, Provisioning Request, history, outbox events of **request** type.

## Feature flag

Default Unavailable; no permissive fallback; outage ≠ success.

## Evidence pack (after implementation — not now)

test/contract/security/migration/idempotency/concurrency/recovery/RBAC/flag/zero-side-effects/audit reports + approvals.

**G1 status today:** NOT SUBMITTED (no implementation).
