# P6 — Release Status & Remaining Limits

**Date:** 2026-11-10  
**Status:** **CODE_COMPLETE / STAGING_NO_GO**  
**Certification:** `docs/edge/p6/18-certification-report.md` · `npm run certify:billing`

## Design locks

- No Hyperswitch — pluggable payment port
- Default payment adapter `unavailable`
- Issued invoices immutable + PDF artifact
- Recognized revenue policy-driven (`CASH_BASED_NET` default)
- Jobs opt-in via `BILLING_JOBS_ENABLED`

## Remaining staging blockers only

| ID | Blocker |
|----|---------|
| L-01 | Live payment engine credentials |
| L-02 | Apply migrate `090`–`094` (local CP auth currently failing without `.env`) |
| L-03 | P0-H staging gates |
| L-04 | Tax counsel validation of seeded rates |

## Commands

```text
npm run certify:billing
npm run migrate:control
npm run check:billing:migrations
```
