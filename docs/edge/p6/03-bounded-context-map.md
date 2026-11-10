# P6 � Bounded Context Map

**Date:** 2026-11-09  
**Implementation:** **IMPLEMENTATION_COMPLETE**

| # | Context | Responsibility | Aggregate root(s) | Upstream | Downstream |
|---|---------|----------------|-------------------|----------|------------|
| 1 | **Billing Accounts** | Registry, commercial account link, subscription bind | BillingAccount | P5 coordination, P4 account ref | Profiles, Invoicing |
| 2 | **Profiles** | Bill-to, payment method refs (tokens), currency default | BillingProfile | Billing Accounts | Payments |
| 3 | **Schedules** | Recurring / anniversary triggers (read from P5 periods) | BillingSchedule | P5 periods | Invoicing |
| 4 | **Invoicing** | Draft ? issue; line items; immutability | Invoice, InvoiceLine | Schedules, P2 snapshot | Tax, Payments |
| 5 | **Tax** | Jurisdiction snapshot, rate refs at issue | TaxSnapshot | Invoicing | Invoicing (frozen on issue) |
| 6 | **Payments** | Intents, attempts, confirm/cancel | PaymentIntent, PaymentAttempt | Invoicing | Provider port, Ledger |
| 7 | **Refunds / Credits** | Credit notes, partial refunds | CreditMemo, Refund | Payments, Invoicing | Ledger |
| 8 | **Collections** | Dunning stages, retry policy (stub) | CollectionCase | Invoicing | Notifications (future) |
| 9 | **Reconciliation** | Provider settlement vs ledger | ReconciliationBatch | Payments | Ledger |
| 10 | **Ledger** | Append-only financial entries | LedgerEntry | Payments, Refunds | Analytics |
| 11 | **Governance** | Policies, approvals, audit overlays | BillingPolicy | P0 audit | All contexts |

## Upstream (consume, do not fork)

| Phase | Provides |
|-------|----------|
| **P5** | `subscription.billing_coordination.requested.v1`, subscription id, period boundaries, commercial snapshot refs |
| **P4** | Commercial account id (via coordination payload) |
| **P2** | Price / composition snapshots (frozen onto invoice at issue) |

## Downstream (P6 produces)

| Consumer | Contract |
|----------|----------|
| **P5** | `billing.coordination.confirmed.v1` / `billingConfirmed` � only after invoice+payment path satisfied per policy |
| **Analytics** | Read models from ledger + invoice states |

## Anti-corruption

- P5 subscription status is never updated from P6 repositories � coordination events only.
- Payment provider responses map through `PaymentProviderPort` � no vendor types in domain.
- Webhook ingress is a separate adapter; domain sees only normalized `PaymentConfirmation` DTOs.
