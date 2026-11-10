# P4 — Release Status & Remaining Limits

**Date:** 2026-11-09  
**Increments:** P4.0 → P4.12 + gap-closure platform (`086`) + provider/ops wiring  
**Status:** **IMPLEMENTATION_COMPLETE** — runtime requires CP migrations `081`–`086`  
**Staging:** **NO-GO** until migrate + P0-H gates (see `13-qualification-report.md`)

## Delivered

- Audit, architecture, BCs, reuse matrix, data model, permissions, API/events, handoff contract
- Migrations `081`–`086` (incl. views/export/idempotency/visibility + `schema_migrations` rows)
- Domain invariants + commerce + platform modules
- Closed Won **server-side** quote/contract verification
- Resolving signature (DocuSign/HelloSign/unavailable) + minimal PDF + resolving calendar (Google/Outlook/unavailable)
- Nest API `/edge/sales` (+ platform controller) + outbox events
- Edge Sales console + Opportunity Workspace + Playwright smoke + authenticated scenarios A–F
- `check:sales:migrations` + sales DB Testcontainers suite + ops runbook
- Qualification + completeness verification docs

## Remaining limits

See [`14-remaining-limits-registry.md`](./14-remaining-limits-registry.md) and [`17-provider-ops-runbook.md`](./17-provider-ops-runbook.md).

## Evidence

- Unit: `sales.entity.spec.ts`, `sales-commerce.entity.spec.ts`, signature/calendar adapter specs
- Code: `modules/edge/**/sales*`
- FE: `app/(edge-console)/edge/sales/page.tsx`, `e2e/edge-sales-*.spec.ts`
- Docs: `docs/edge/p4/*`
