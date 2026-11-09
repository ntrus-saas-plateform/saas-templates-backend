# P3 Resend / marketing implementation audit

**Date:** 2026-11-09  
**Verdict:** Resend EMAIL path is **implemented and corrected**; remaining gaps are intentional / deferred (studio, WhatsApp, auth E2E).

## Verified complete

| Area | Status | Notes |
|------|--------|-------|
| Resolving adapter modes | OK | `unavailable` / `logging_accepted` / `http_webhook` / `resend` / `auto` |
| Resend send adapter | OK | ACCEPTED + `email.id`; never DELIVERED |
| Tag charset | OK | sanitized to Resend `[A-Za-z0-9_-]` |
| Template content hand-off | OK | `getMessageTemplate` → subject/html/text |
| `deliveryAttemptId` on send | OK | required on `ChannelSendRequest` |
| Svix verify (manual HMAC) | OK | rawBody preserved in `main.ts` |
| Webhook route | OK | `POST …/deliveries/webhooks/resend` `@Public` + throttle |
| Correlation | OK | tag `delivery_attempt_id` then `email_id` |
| Receipt → DELIVERED | OK | only after verified ingest + SUBMITTED→DELIVERED |
| Operator receipts endpoint | OK | **auth required** (no client-forged `signatureValid`) |
| Receipt idempotency | OK | unique `provider_event_id` short-circuit |
| WAIT worker | OK | leader-locked poller |
| Frequency caps | OK | enforced before send |
| Analytics CAC gate | OK | MEASURED blocked without `revenueReconciled` |
| Unit tests | OK | domain + Resend adapter/svix/webhook |
| Env example | OK | Resend keys documented |

## Gaps fixed during this audit

1. Public `POST /deliveries/receipts` accepted caller-supplied `signatureValid: true` → forged DELIVERED. **Fixed:** permission-gated; Svix path is the only public ingest.
2. Webhook retries could violate UNIQUE(`provider_event_id`). **Fixed:** idempotent lookup before insert.
3. Illegal transitions on late/out-of-order events could 500. **Fixed:** record receipt, skip illegal transition.
4. Resend tags with non-ASCII/special chars would be rejected by API. **Fixed:** sanitize.

## Finalization addendum

- Studio drag-drop + markdown preview: delivered
- Analytics honesty panel (CAC/ROAS/LTV UNAVAILABLE): delivered
- Edge e2e seed pack (`seed:edge-e2e` + Keycloak `edge-e2e`): delivered
- Live Resend/Meta sandbox e2e: still secret-gated / not default CI
- Application use-case imports webhook helpers from `infrastructure/` (acceptable but not pure hexagonal)

See `30-release-report.md` for READY_FOR_REVIEW recommendation.

## Operator checklist

```env
MARKETING_CHANNEL_ADAPTER=resend
RESEND_API_KEY=re_…
RESEND_WEBHOOK_SECRET=whsec_…
MARKETING_RESEND_FROM=Okapi <marketing@verified-domain>
```

Resend dashboard webhook URL (hit Nest directly, not Next BFF):

`https://<api-host>/api/v1/edge/marketing/deliveries/webhooks/resend`

Subscribe at least: `email.delivered`, `email.bounced`, `email.failed`, `email.complained`.
