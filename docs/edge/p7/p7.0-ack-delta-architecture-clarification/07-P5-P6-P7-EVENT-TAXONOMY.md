# 07 — P5 / P6 / P7 Event Taxonomy (DELTA-06)

| Document ID | P7.0-ACK-DELTA-07 | Decision | **D-EVT-01** |

## Existing conventions (VERIFIED_IN_CODE)

- P5: `subscription.*`, `entitlement.*`, `subscription.billing_coordination.*`, `subscription.provisioning.requested|completed.v1`  
- P6: `billing.invoice.*`, `billing.payment.*`, `billing.account.*`, …  

Do not rename all historical events. Introduce **authorization** events as additive; deprecate ambiguous dual-use of `subscription.provisioning.requested.v1` as “full auth”.

## Target catalog

### P5 — Authorization (owner P5)

| Event | Meaning |
|-------|---------|
| `subscription.provisioning.authorization.issued.v1` | Canonical auth issued |
| `subscription.provisioning.authorization.revoked.v1` | Revoked |
| `subscription.provisioning.authorization.expired.v1` | Expired |
| `subscription.provisioning.authorization.reissued.v1` | Replacement version |

### P7 — Request (owner P7)

| Event | Meaning |
|-------|---------|
| `tenant.provisioning.request.received.v1` | Durable request recorded |
| `tenant.provisioning.request.accepted.v1` | Accepted after verify |
| `tenant.provisioning.request.rejected.v1` | Rejected fail-closed |
| `tenant.provisioning.request.cancelled.v1` | P7 cancel |

### P6 — Financial facts (owner P6) — keep existing

`billing.payment.succeeded.v1`, `billing.invoice.paid.v1`, …  
**Never** treat as provisioning authorization.

### Bridge P5↔P6 (existing)

`subscription.billing_coordination.requested|confirmed.v1` — commercial coordination only.

### Legacy

`subscription.provisioning.requested.v1` — DOCUMENTED as transitional coordination; must map to authorization.issued or be superseded (P7.1.07 / P5.AUTH work).

## Event envelope (all)

event_id, event_type, schema_version, producer, aggregate_ref, occurred_at, published_at, correlation_id, causation_id, idempotency/dedup, payload  

Policies: versioning (additive), retention per platform standard, DLQ + replay owned by messaging ops.
