# P3 Release report — Final (Increments 1–5c)

**Status:** `READY_FOR_REVIEW` (not staging)  
**Date:** 2026-11-09  
**Scope:** Okapi Edge Marketing / Acquisition Control Plane

## Executive summary

P3 is complete for review: Control Plane marketing on P0/P1/P2 with Resend EMAIL + Meta WhatsApp (never fake `DELIVERED`), studio block composers, journey WAIT worker, frequency caps, attribution honesty (CAC/ROAS/LTV stay `UNAVAILABLE` without revenue reconciliation), public form throttling, and Playwright CSRF A–F plus optional Keycloak-authenticated UI via `seed:edge-e2e`. Tenant CRM is not reused. No SendGrid. No invented metrics.

## Evidence

| Gate | Status | Evidence |
|------|--------|----------|
| Architecture + reuse matrix | PASS | `docs/edge/p3/00`, `01` |
| Migrations 077–080 | PASS | foundation → orchestration → ops → Resend indexes |
| Domain + provider unit tests | PASS | `pnpm test:edge:marketing` (49+) |
| Marketing APIs | PASS | `/api/v1/edge/marketing/**` |
| Public forms | PASS | never creates tenants; Nest + FE throttle |
| Delivery honesty | PASS | ACCEPTED/SUBMITTED; DELIVERED only via signed receipt |
| Resend EMAIL | PASS | adapter + Svix webhook |
| Meta WhatsApp | PASS | template adapter + GET verify + POST statuses |
| Studio composers | PASS | schema v1, drag-drop, markdown preview, PUT APIs |
| Analytics honesty | PASS | summary exposes CAC/ROAS/LTV UNAVAILABLE |
| WAIT worker + freq caps | PASS | leader lock + day/week counters |
| Playwright CSRF A–F | PASS | marketing + commercial scenario contracts |
| Playwright auth UI | PARTIAL | fixture delivered (`seed:edge-e2e` + `EDGE_E2E_AUTH=1`); CI optional |
| Live provider sandbox e2e | NOT_IN_DEFAULT_CI | secrets + public webhook required |
| READY_FOR_STAGING | BLOCKED | P0-H NO-GO outside P3 |

## Operator enablement

```bash
# Backend
pnpm keycloak:import
pnpm seed:edge-e2e
pnpm test:edge:marketing

# Frontend authenticated UI (optional)
EDGE_E2E_AUTH=1 EDGE_E2E_USERNAME=edge-e2e EDGE_E2E_PASSWORD=password pnpm test:e2e:marketing:auth
```

Resend webhook: `POST /api/v1/edge/marketing/deliveries/webhooks/resend`  
WhatsApp webhook: `GET|POST /api/v1/edge/marketing/deliveries/webhooks/whatsapp`

## Hard invariants delivered

- Campaign cannot promote `UNAVAILABLE`/`DEPRECATED` products
- Publish requires FINAL approval + APPROVED/SCHEDULED status + published product
- Form submissions are idempotent; trial/demo forms do not provision tenants
- Lead score is explainable and versioned
- Budget amounts non-negative; spent sources declared/imported/confirmed only
- Channel adapters never return `DELIVERED`; receipts require verified signatures
- CAC/ROAS/LTV cannot be marked `MEASURED` without `revenueReconciled=true`

## Recommendation

**Promote to `READY_FOR_REVIEW`.** Do **not** promote to staging until P0-H NO-GO items are cleared. Optional live ESP sandbox e2e can follow when secrets are provisioned.
