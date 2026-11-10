# P6 � Payment Provider Adapter

**Date:** 2026-11-09  
**Implementation:** **IMPLEMENTATION_COMPLETE**

## Design lock

| Item | Decision |
|------|----------|
| Pattern | **Pluggable adapter** implementing `PaymentProviderPort` |
| Hyperswitch | **NOT used** � no dependency, no docs, no migrations |
| Default adapter | **`UnavailablePaymentAdapter`** � honest failure |
| Configuration | `BILLING_PAYMENT_ADAPTER=unavailable\|http_webhook\|auto` |

## Port surface (target)

| Method | Responsibility |
|--------|----------------|
| `getAvailability()` | `AVAILABLE` \| `UNAVAILABLE` |
| `beginAttempt(intent, context)` | Optional outbound � may no-op |
| `normalizeWebhook(headers, body)` | Map to `PaymentConfirmation` or reject |
| `healthCheck()` | Integration diagnostics (no secrets in response) |

Domain and application layers depend **only** on the port interface.

## Shipped adapters (P6.0)

| Adapter | `BILLING_PAYMENT_ADAPTER` | Outbound PSP | Inbound |
|---------|---------------------------|--------------|---------|
| **Unavailable** | `unavailable` (default) | None | None � `503` / `REQUIRES_PROVIDER` |
| **HttpWebhook** | `http_webhook` | None (stub for future engine) | Signed POST to `/edge/billing/webhooks/payments` |
| **Auto** | `auto` | Delegates to configured primary bean | Delegates |

## Unavailable adapter behavior

| Call | Result |
|------|--------|
| `beginAttempt` | `AdapterUnavailableError` ? attempt `FAILED`, intent `REQUIRES_PROVIDER` |
| `normalizeWebhook` | Not registered � route returns 404 when adapter ? `http_webhook` |
| Metrics | Expose `billing_payment_adapter_unavailable_total` |

## HttpWebhook stub (future engine placeholder)

| Concern | P6.0 behavior |
|---------|----------------|
| Purpose | Prove webhook ingress, idempotency, ledger allocation **without** Hyperswitch or live PSP |
| Signature | `BILLING_WEBHOOK_SECRET` � HMAC verify required |
| Payload | Normalized JSON schema � `eventId`, `intentId`, `amount`, `currency`, `status` |
| Storage | `edge_payment_webhook_receipts` � raw body optional, redact PCI |
| Success | Creates `PaymentConfirmation` with `proofId=eventId` |

**Not in P6.0:** outbound payment session creation, 3DS, network tokens, connector-specific IDs.

## Adding a future engine

1. Implement `PaymentProviderPort` in `infrastructure/billing/payment-adapters/<engine>/`.
2. Register in Nest module factory when `BILLING_PAYMENT_ADAPTER=<engine>` (new enum value � requires code change, not doc rename to Hyperswitch).
3. Integration tests use **mock port** � no vendor sandbox required for CI default.

## Forbidden

| Practice | Reason |
|----------|--------|
| Import Hyperswitch SDK / API client in domain | Vendor lock contradicts port |
| Store PAN/CVV in adapter logs or DB | PCI |
| Map `UNAVAILABLE` to `SUCCEEDED` in factory | Fake paid |
| Hard-code PSP types in `edge_payment_attempts` | Use `provider_code` string + JSON metadata |

## Observability

| Signal | Note |
|--------|------|
| `adapter_mode` | From env � log on boot |
| `attempt_outcome` | success / failed / unavailable |
| Correlation | `payment_intent_id`, `correlation_id`, P5 `subscription_id` on spans |
