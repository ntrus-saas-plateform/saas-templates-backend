# P6 � API & Events Matrix

**Date:** 2026-11-09  
**Implementation:** **IMPLEMENTATION_COMPLETE**  
**Base path:** `/edge/billing` (Edge auth + permission guards)  
**Outbox tenant:** `EDGE_BILLING_OUTBOX_TENANT=edge-control-plane`

## API families

| Family | Methods | Permissions |
|--------|---------|-------------|
| overview / analytics | GET | `read_analytics` |
| billing-accounts | GET/POST/PUT | `read` / `create` / `update` |
| profiles | GET/POST/PUT | `manage_profiles` |
| payment-method-refs | GET/POST/DELETE | `manage_profiles` |
| schedules | GET/POST/PUT | `manage_schedules` |
| invoices | GET/POST/PUT | `read_invoices` / `create` / `update` (draft) |
| invoices / issue | POST | `issue` |
| invoices / void | POST | `void` |
| payments / intents | GET/POST | `read_payments` / `collect` |
| payments / attempts | GET/POST | `read_payments` / `collect` |
| payments / confirm | POST | `confirm_payment` (governed) |
| webhooks / payments | POST | HMAC/signature � **no** Edge JWT (dedicated route) |
| credit-memos | GET/POST | `credit` |
| refunds | GET/POST | `refund` |
| ledger | GET | `read_ledger` |
| reconciliation | GET/POST | `reconcile` |
| collections | GET/PUT | `read_collections` / `manage_collections` |
| tax-snapshots | GET | `read_tax` |
| policies | GET/POST | `manage_policies` |
| coordination | GET/POST replay | `coordinate` |
| integrations / payment-adapter | GET/PUT | `manage_integrations` |

Exact routes land with module code in the same delivery as migrations `090`+.

## Domain events (outbox)

| Event type | Aggregate |
|------------|-----------|
| `billing.account.created.v1` | BILLING_ACCOUNT |
| `billing.account.updated.v1` | BILLING_ACCOUNT |
| `billing.profile.updated.v1` | BILLING_PROFILE |
| `billing.schedule.updated.v1` | BILLING_SCHEDULE |
| `billing.invoice.created.v1` | INVOICE |
| `billing.invoice.issued.v1` | INVOICE |
| `billing.invoice.paid.v1` | INVOICE |
| `billing.invoice.overdue.v1` | INVOICE |
| `billing.invoice.voided.v1` | INVOICE |
| `billing.payment.intent.created.v1` | PAYMENT_INTENT |
| `billing.payment.attempt.started.v1` | PAYMENT_ATTEMPT |
| `billing.payment.succeeded.v1` | PAYMENT_ATTEMPT |
| `billing.payment.failed.v1` | PAYMENT_ATTEMPT |
| `billing.credit.issued.v1` | CREDIT_MEMO |
| `billing.refund.issued.v1` | REFUND |
| `billing.ledger.entry.posted.v1` | LEDGER_ENTRY |
| `billing.coordination.confirmed.v1` | BILLING_COORDINATION |
| `billing.coordination.rejected.v1` | BILLING_COORDINATION |

## Consumed events (inbound)

| Event | Handler |
|-------|---------|
| `subscription.billing_coordination.requested.v1` | Upsert billing account, schedule, draft/first invoice per policy |

## Security notes

- Issue and confirm endpoints **re-check immutability and proof server-side**.
- Webhook route: verify signature, idempotent receipt, no PAN in payload storage.
- Adapter config never returns webhook secrets in GET responses.
- Vertical scope enforced on read/list for `VERTICAL_*` roles.
