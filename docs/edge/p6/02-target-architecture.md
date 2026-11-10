# P6 � Target Architecture

**Date:** 2026-11-09  
**Implementation:** **IMPLEMENTATION_COMPLETE**

## Placement

P6 lives in the **SaaS Control Plane** (Okapi Edge) only. Hexagonal Nest subdomain `billing` under `modules/edge`. **P5 owns subscription status; P6 owns invoice and payment status** � orthogonal state machines, linked by refs and coordination events only.

```
P5 subscription (lifecycle)
              �
              ?
  subscription.billing_coordination.requested.v1
              �
              ?
     Billing account + profile + schedule
              �
              +-? Invoicing (issue ? immutable)
              +-? Tax (snapshot refs)
              +-? Payment orchestration --? PaymentProviderPort
              �         default UNAVAILABLE
              �         confirm: provider proof | verified webhook
              +-? Refunds / credits
              +-? Collections (policy stub)
              +-? Ledger + reconciliation
              �
              ?
  billing.coordination.confirmed.v1 ? P5 (billingConfirmed)
       only after real financial confirmation path
```

## Identity model (never collapse)

| Term | Meaning in P6 |
|------|----------------|
| **Subscription** | P5 aggregate � P6 stores `subscription_id` ref only |
| **Billing account** | Bill-to entity tied to commercial account + subscription |
| **Invoice** | Issued charge document � **immutable after `ISSUED`** |
| **Payment intent** | Collectable amount + method intent |
| **Payment attempt** | Single try against provider port |
| **Paid** | Invoice/payment state � **never set without confirmation path** |

## Invariants (always)

- Control plane only � no tenant DB as SoT for billing rows.
- Backend-generated UUIDs only.
- Money as **decimal strings** + currency code; no float columns for amounts.
- Issued invoices and their line snapshots are **insert-only**; corrections via credit note / new invoice.
- **Never store PAN, CVV, or full card track data.**
- **Never fake `PAID`** � `PAID` requires provider confirmation token or verified `http_webhook` payload.
- P6 **never** transitions P5 subscription to `ACTIVE` � only emits coordination confirm P5 consumes.

## Adapters (honest defaults)

| Port | P6 behavior until configured |
|------|------------------------------|
| `PaymentProviderPort` | `UNAVAILABLE` � intents stay `REQUIRES_PROVIDER`; no auto-success |
| `BILLING_PAYMENT_ADAPTER=unavailable` | Default � explicit domain/HTTP unavailable |
| `http_webhook` | Inbound signed webhooks only � no outbound PSP until engine wired |
| `auto` | Resolves to configured primary; falls back to `unavailable` if unset |

**Hyperswitch is not used** � any future engine implements `PaymentProviderPort` without coupling docs or migrations to a vendor name.

## Event bus

`billing.*.v1` via CP outbox tenant `edge-control-plane`; consumers idempotent; `correlation_id` required on P5 coordination and payment webhooks.
