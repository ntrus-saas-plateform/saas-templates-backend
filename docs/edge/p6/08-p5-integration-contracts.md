# P6 � P5 Integration Contracts

**Date:** 2026-11-09  
**Implementation:** **IMPLEMENTATION_COMPLETE**

## P5 ? P6 � Consume coordination

**Trigger:** `subscription.billing_coordination.requested.v1` (from P5 outbox / coordination API).

| Field | Required | Note |
|-------|----------|------|
| `subscriptionId` | yes | P5 subscription aggregate |
| `commercialAccountId` | yes | P4 commercial account |
| `correlationId` | yes | Idempotency + coordination row |
| `commercialSnapshotRef` | yes | P2/P5 frozen composition pointer |
| `periodRef` | policy | P5 period for schedule anchor |
| `billingPolicy` | no | Waive / first-invoice / prepaid hints |

**P6 does not:** change P5 subscription status on consume; mark paid without payment path.

| Handler outcome | Meaning |
|-----------------|---------|
| Billing account created/updated | Idempotent on `correlationId` |
| `billing.account.ready.v1` | Profile + schedule stub ready |

## P6 ? P5 � Confirm coordination

**Emit:** `billing.coordination.confirmed.v1` (and P5 callback contract `billingConfirmed` when implemented).

| `confirmType` | When | P5 may advance billing gate |
|---------------|------|-----------------------------|
| `PROFILE_READY` | Account + profile only | Only if product policy waives payment |
| `FIRST_INVOICE_ISSUED` | Invoice issued | Policy-dependent |
| `PAYMENT_CONFIRMED` | Invoice `PAID` via real confirmation | Yes � primary path |
| `REJECTED` | Validation failed | P5 `FAILED_ACTIVATION` path |
| `PENDING` | Provider unavailable / awaiting webhook | **No** activation |

**Forbidden:** `confirmType=PAYMENT_CONFIRMED` when payment adapter is `UNAVAILABLE` and no manual proof path satisfied.

## Event matrix (coordination)

| Direction | Event type |
|-----------|------------|
| Inbound | `subscription.billing_coordination.requested.v1` |
| Outbound | `billing.coordination.confirmed.v1` |
| Outbound | `billing.coordination.rejected.v1` |
| Outbound | `billing.account.created.v1` |

## Idempotency

| Key | Scope |
|-----|-------|
| `correlationId` | One coordination saga per P5 request |
| `subscriptionId` + `coordinationKind` | Upsert billing account bind |

## Alignment with P5 table

P5 writes `edge_billing_coordination_events` (request side). P6 appends confirm rows or mirrored audit � **invoice/payment tables remain P6-only**.

## Adapter honesty (cross-phase)

| P6 state | P5 must see |
|----------|-------------|
| Payment `UNAVAILABLE` | `PENDING` � not `CONFIRMED` / not fake paid |
| Invoice issued, unpaid | `PENDING` or `FIRST_INVOICE_ISSUED` per policy |
| Invoice `PAID` with proof | `PAYMENT_CONFIRMED` ? P5 gate pass |
