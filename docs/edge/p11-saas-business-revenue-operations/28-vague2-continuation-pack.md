# 28 — Vague 2 continuation pack (post cash-engine)

**Date:** 2026-11-16  
**Local SHAs:** pin after commit of this wave

## Closures this wave

| Finding | Status | Evidence |
|---------|--------|----------|
| F-P11-004 payment UNKNOWN → MEASURED | **CODE_COMPLETE** | Live projection now `dataQuality: ESTIMATED` |
| F-P11-005 movements STARTING/ENDING only | **CODE_COMPLETE** | `deriveMrrMovementLines` → NEW/CHURNED/EXPANSION/CONTRACTION |
| F-P11-006 expansion 100→150 | **CODE_COMPLETE** | Specs + `priorPeriodAmount` in commercial_snapshot |
| F-P11-009 LOGO_CHURN calculator | **CODE_COMPLETE** | `churn-calculator.ts` + `POST /edge/revenue/churn/compute` |
| F-P11-010 Overview `business:read` bypass | **CODE_COMPLETE** | FE Overview requires `revenue:read` only |
| Multi-PSP routing (sandbox / http_webhook / auto) | **CODE_COMPLETE** | `resolving-payment.adapter.spec.ts` |
| F-P11-001 cash engine | **CODE_COMPLETE** | prior Vague 2 commit |
| F-P11-002 / F-P11-003 pack E2E + push | **NEED_LAB_RUN** | still open |

## Machine-checkable suites (run locally)

```bash
pnpm exec vitest run \
  src/modules/edge/domain/revenue-operations \
  src/modules/edge/infrastructure/revenue-operations/live-revenue-projection.adapter.spec.ts \
  src/modules/edge/infrastructure/billing/resolving-payment.adapter.spec.ts \
  src/modules/edge/application/revenue-operations/revenue.use-cases.spec.ts \
  src/modules/edge/presentation/controllers/revenue-operations.controller.auth.spec.ts
```

This is **not** the mandated financial pack 1–25 E4/E5 campaign — only unit/contract evidence.

## Multi-PSP note

`BILLING_PAYMENT_ADAPTER`:

- `sandbox` — explicit lab only
- `http_webhook` — PSP webhook adapter
- `auto` — webhook URL → http_webhook, else unavailable (**never** auto-sandbox)
- default / other → unavailable

Multi-région remains out of scope for this wave.
