# P6 Runbook — Deployment & Recovery

## Prerequisites

1. Control-plane Postgres reachable with migrate credentials.
2. Apply migrations: `npm run migrate:control` then `npm run check:billing:migrations` (expects `090`–`094`).
3. Redis available if `BILLING_JOBS_ENABLED=true` (distributed lock).
4. Payment adapter: leave `unavailable` until engine URL/secrets exist.

## Deploy checklist

- [ ] `090`–`094` in `schema_migrations`
- [ ] `platform:billing:*` permissions present
- [ ] `BILLING_PAYMENT_ADAPTER` documented for the environment
- [ ] Optional: `BILLING_JOBS_ENABLED=true`
- [ ] Smoke: `GET /edge/billing/overview` with Edge auth

## Recovery procedures

| Incident | Action |
|----------|--------|
| Double webhook | Idempotency on `provider_event_id`; do not reverse SUCCEEDED on stale events |
| Failed process-due job | Re-run `POST /edge/billing/schedules/process-due`; inspect results[].error |
| Stuck OVERDUE miss | `POST /edge/billing/invoices/mark-overdue` |
| Bad tax on draft | Re-apply tax before approve/issue; issued invoices need credit notes |
| Payment adapter outage | Adapter returns UNAVAILABLE; intents stay non-collected |

## Forbidden recovery actions

- UPDATE issued invoice financial columns in place
- Manually set payment intent to SUCCEEDED without provider proof
- Delete journal entries (post reversing entries instead)
