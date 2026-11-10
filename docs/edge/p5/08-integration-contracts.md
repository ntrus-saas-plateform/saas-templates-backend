# P5 — Integration Contracts

**Date:** 2026-11-09  
**Implementation:** **IMPLEMENTATION_COMPLETE**

## P4 ? P5 — Handoff consume

**Trigger:** `sales.handoff.requested.v1` and/or `POST /edge/subscriptions/from-handoff` (idempotent).

| Field | Required | Note |
|-------|----------|------|
| `accountId` | yes | P4 commercial account |
| `salesOrderId` | yes | Unique active subscription per order |
| `productId` | yes | One product per subscription |
| `offerConfiguration` | yes | P2 snapshot for composition |
| `quoteId` / `contractId` | policy | When sales gates require |
| `correlationId` | yes | Idempotency + outbox |

**P5 does not:** create tenant, invoice, or mark provision complete on consume.

| Response / event | Meaning |
|------------------|---------|
| `subscription.created.v1` | Draft subscription from handoff |
| `subscription.handoff.consumed.v1` | Idempotent ack |

## P5 ? P6 — Billing coordination

**Port:** billing coordination adapter (stub **UNAVAILABLE** until P6).

| Step | Direction | Contract |
|------|-----------|----------|
| Request | P5 ? P6 | `billing.coordination.requested.v1` — subscription id, commercial snapshot ref, period |
| Confirm | P6 ? P5 | Callback/event with `CONFIRMED` \| `REJECTED` \| `PENDING` |

**Forbidden:** setting billing state to `PAID` or creating invoice rows inside P5.

## P5 ? P7 — Provisioning coordination

**Port:** provisioning adapter (stub **UNAVAILABLE** until P7).

| Step | Direction | Contract |
|------|-----------|----------|
| Request | P5 ? P7 | `provisioning.requested.v1` — subscription, product, vertical, account ref |
| Accept | P7 ? P5 | `provisioning.accepted.v1` |
| Complete / Fail | P7 ? P5 | `provisioning.completed.v1` / `provisioning.failed.v1` |

**Forbidden:** `tenant_id` or `ACTIVE` tenant status without `provisioning.completed.v1` (or governed manual confirm path, audited).

## Adapter honesty

| Adapter state | API behavior |
|---------------|--------------|
| Not configured | `503` / domain `UNAVAILABLE` — subscription stays `PENDING_ACTIVATION` or fails per policy |
| Configured, pending | Explicit `PENDING_EXTERNAL` — no success masquerading |
| Configured, confirmed | Only external confirm advances billing/provision gates |

## Correlation

All coordination rows in `edge_billing_coordination_events` and `edge_provisioning_requests` carry `correlation_id` aligned with subscription lifecycle events.
