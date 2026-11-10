# P4 — Completeness Verification (post provider/ops pass)

**Date:** 2026-11-09  
**Verdict:** **IMPLEMENTATION_COMPLETE for coded + adapter wiring** — runtime still needs CP migrate `081`–`086` and live secrets for e-sign/calendar  
**Staging:** **NO-GO** until migrate + authenticated E2E secrets + P0-H

## Closed in this pass

| Gap | Closure |
|-----|---------|
| Live DocuSign / HelloSign adapters | `DocuSignSalesSignatureAdapter` + `HelloSignSalesSignatureAdapter` + resolving |
| Live Google / Outlook calendar | `GoogleSalesCalendarAdapter` + `OutlookSalesCalendarAdapter` + resolving |
| Env schema + `.env.example` | `SALES_SIGNATURE_ADAPTER`, `SALES_CALENDAR_ADAPTER`, provider secrets |
| Authenticated Playwright A–F | `e2e/edge-sales-scenarios.spec.ts` + `chromium-edge-auth` match |
| Migration registry rows | `081`–`086` insert into `schema_migrations` |
| Migrate readiness check | `npm run check:sales:migrations` |
| Sales DB integration | `test/integration/edge-sales-db.spec.ts` (Testcontainers) |
| Ops runbook | `docs/edge/p4/17-provider-ops-runbook.md` |

## Still external / env-bound (honest)

| Item | Note |
|------|------|
| Live DocuSign/HelloSign **credentials** | Adapter wired; UNAVAILABLE until secrets set |
| Live calendar **tokens** | Adapter wired; UNAVAILABLE until tokens set |
| Authenticated Playwright **secrets** | Scenarios shipped; need `EDGE_E2E_AUTH=1` + user |
| Staging migrate + P0-H | Operational gate — `migrate:control` + P0-H.8 |

## Evidence commands

```text
npm run test:edge:sales
npm run check:sales:migrations   # after migrate:control
TESTCONTAINERS=true npm run test:edge:sales:db
cd ../saas-template-frontend && npm run test:e2e:sales
```
