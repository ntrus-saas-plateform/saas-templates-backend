# P6 � Payment Orchestration

**Date:** 2026-11-09  
**Implementation:** **IMPLEMENTATION_COMPLETE**

## Model

| Aggregate | Role |
|-----------|------|
| **PaymentIntent** | What to collect (amount, currency, invoice link, idempotency key) |
| **PaymentAttempt** | One execution against `PaymentProviderPort` |
| **PaymentConfirmation** | Normalized success/failure proof (domain DTO, not vendor type) |

```
Invoice (ISSUED, balance due)
        �
        ?
  PaymentIntent (CREATED)
        �
        ?
  PaymentAttempt ? PaymentProviderPort
        �
        +- UNAVAILABLE ? attempt FAILED / intent REQUIRES_PROVIDER
        +- http_webhook ? await inbound confirmation
        +- future engine ? sync/async provider response
        �
        ?
  Ledger entry + invoice allocation
        �
        ?
  billing.payment.succeeded.v1 (only on confirmed path)
```

## Payment intent statuses

| Status | Meaning |
|--------|---------|
| `CREATED` | Intent recorded |
| `REQUIRES_PROVIDER` | No adapter or provider action needed |
| `PROCESSING` | Attempt in flight |
| `SUCCEEDED` | Confirmed � allocations applied |
| `CANCELLED` | Intent cancelled before success |
| `FAILED` | Terminal failure after retries policy |

## Payment attempt statuses

| Status | Meaning |
|--------|---------|
| `PENDING` | Created |
| `SUBMITTED` | Sent to port (if supported) |
| `SUCCEEDED` | Provider proof or verified webhook |
| `FAILED` | Decline / error / unavailable |
| `CANCELLED` | Aborted |

## Confirmation rules (strict)

| Source | Accept as `SUCCEEDED` |
|--------|------------------------|
| `PaymentProviderPort.confirm()` returning `PaymentConfirmation` with `proofId` | Yes |
| Inbound webhook ? signature verify ? idempotent receipt ? normalized confirm | Yes |
| Console toggle / DB update | **No** |
| P5 subscription activate callback | **No** |

## Pluggable port

```text
PaymentProviderPort
  +-- createAttempt(intent) ? AttemptHandle | UNAVAILABLE
  +-- capture?(attempt)     ? optional � not required P6.0
  +-- normalizeWebhook(raw) ? PaymentConfirmation | reject
```

Domain **never** imports Hyperswitch or any PSP SDK � adapters live in `infrastructure/billing/payment-adapters/`.

## Env

| Variable | Values | Default |
|----------|--------|---------|
| `BILLING_PAYMENT_ADAPTER` | `unavailable`, `http_webhook`, `auto` | `unavailable` |

| Mode | Behavior |
|------|----------|
| `unavailable` | Port returns `UNAVAILABLE`; intents remain `REQUIRES_PROVIDER` |
| `http_webhook` | No outbound PSP; confirmations only via signed webhook ingress |
| `auto` | Primary configured adapter bean; else `unavailable` |

## Retry / idempotency

- Intent: unique `(invoice_id, idempotency_key)` or `correlation_id`
- Attempt: monotonic sequence per intent
- Webhook: unique `provider_event_id` on `edge_payment_webhook_receipts`

## P5 coordination link

`billingConfirmed` to P5 fires only when policy satisfied (e.g. first invoice `PAID` or explicit waive with audit) � see `08-p5-integration-contracts.md`.
