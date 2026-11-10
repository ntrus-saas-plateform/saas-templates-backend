# P5 � Release Status & Remaining Limits

**Date:** 2026-11-09  
**Status:** **IMPLEMENTATION_COMPLETE** � runtime requires CP migrations `087`�`089`  
**Staging:** **NO-GO** until migrate + P0-H gates

## Delivered

- Domain lifecycle + deterministic entitlement resolution
- Migrations `087`�`089` + RBAC `platform:subscriptions:*`
- Nest API `/edge/subscriptions` + outbox events
- P4 handoff consumer (`sales.handoff.requested.v1`)
- Billing/provisioning adapters default **UNAVAILABLE** (honest)
- Edge Subscriptions console + workspace + Playwright smoke/scenarios
- Unit evidence: domain + adapter specs

## Remaining limits

| ID | Limit | Severity |
|----|-------|----------|
| L-01 | Live P6 billing adapter credentials | MED |
| L-02 | Live P7 provisioning adapter | MED |
| L-03 | Authenticated Playwright secrets | MED |
| L-04 | Staging / P0-H | HIGH |
| L-05 | Change-request approval queue UI depth | LOW |
| L-06 | Recognized revenue / invoices | N/A (P6) |

## Evidence

```text
npx vitest run src/modules/edge/domain/subscription src/modules/edge/infrastructure/subscription
npm run check:subscriptions:migrations   # after migrate:control
```
