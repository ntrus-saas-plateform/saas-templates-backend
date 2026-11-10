# ADR — Pluggable Payment Adapter (No Hyperswitch)

**Status:** Accepted  
**Date:** 2026-11-10  
**Context:** P6 director originally referenced Hyperswitch; product decision is a future external payment engine.

## Decision

1. Domain depends only on `PaymentProviderPort`.
2. Default adapter is `UnavailablePaymentProviderAdapter` — honest failures, never invents `SUCCEEDED`.
3. `HttpWebhookPaymentProviderAdapter` is the bridge for a future engine via `BILLING_PAYMENT_WEBHOOK_URL`.
4. `ResolvingPaymentProviderAdapter` selects by `BILLING_PAYMENT_ADAPTER` (`unavailable` | `http_webhook` | `auto`).
5. Webhook confirmation requires `signatureValid` / provider proof before cash recognition.

## Consequences

- Staging cannot claim live payments until credentials + adapter mode are set.
- PCI: no PAN/CVV storage in Okapi Edge.
