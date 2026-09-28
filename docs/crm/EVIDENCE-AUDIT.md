# CRM Wave 1 — Evidence Audit (Phase 6)

**Date:** 2026-09-14 (WhatsApp campaign channel)  
**Scope:** Extend `customer` + reuse `loyalty`  
**Verdict:** **PARTIALLY VERIFIED** — HIGH audit gaps closed; WhatsApp campaign dispatch verified (noop/meta); remaining: 360 soak under load, insurance timeline depth.

## Architecture

| Item | Status |
|------|--------|
| Reused customer master / merge / 360 / B2C | Yes |
| CRM engine tables + UCs + `/crm` API | Yes |
| Workflow auto-start (LEAD / OPPORTUNITY / CAMPAIGN) | Yes (fail-open if unbound) |
| Customer 360 Redis read-through | Yes (`customer-360` namespace, TTL 30s) |
| Campaign audience metrics | Yes (`crm_campaign_audience_total` queued/skipped/sent/failed) |
| WhatsApp campaign channel (no SMS) | Yes (`WHATSAPP_CAMPAIGN_CHANNEL_PORT`, noop \| meta) |
| Privacy / retention / segment evaluator | Yes |
| Loyalty concurrency + idempotency | Yes (mig `044`) |
| MCP capability parity | Yes |

## Evidence matrix (selected)

| Claim | Evidence | P-level | Status |
|-------|----------|---------|--------|
| Lead / opp / campaign lifecycles | domain + UC specs | P3 | VERIFIED |
| Workflow bindings CRM | catalog + mig `045` + `crm-workflow-auto-start.spec.ts` | P3 | VERIFIED |
| Merge / IDOR / privacy | merge + idor + privacy specs | P3–P4 | VERIFIED |
| Loyalty double-spend | `loyalty-concurrency.spec.ts` | P3–P4 | VERIFIED |
| MCP CRM capability | `mcp-tools.crm-capability.spec.ts` | P3–P4 | VERIFIED |
| Campaign frequency + metrics | queue UC + `crm-campaign-metrics.spec.ts` | P3 | VERIFIED |
| WhatsApp dispatch (not SMS) | `campaign-channel.ts` + `crm-whatsapp-dispatch.spec.ts` + mig `046` | P1–P3 | VERIFIED |
| 360 cache + timeline bound | `CUSTOMER_360_TIMELINE_PAGE_MAX=100` + cache namespace | P2–P3 | VERIFIED |
| Docker 5-tenant CRM gates | smoke crm-operation / credit | P5 | VERIFIED |
| Docker 5-tenant CRM HTTP CRUD | create lead wholesale + cross-org transition denied | P5 | VERIFIED |
| Meta Cloud API live send | adapter present; live creds optional (`WHATSAPP_PROVIDER=meta`) | P1 | PARTIALLY VERIFIED |
| 360 performance soak | latency histogram only | P2 | PARTIALLY VERIFIED |
| Insurance timeline depth | — | — | NOT VERIFIED |

## Migrations

```bash
pnpm migrate:control   # 060 CRM perms
pnpm migrate:tenant <id>  # 043 CRM, 044 loyalty, 045 workflow bindings, 046 WhatsApp delivery
```

## Tests

```bash
pnpm exec vitest run src/modules/customer src/modules/loyalty src/modules/mcp/application/mcp-tools.crm-capability.spec.ts
TESTCONTAINERS=true pnpm exec vitest run --config ./vitest.config.e2e.ts test/e2e/multi-vertical-five-tenant.e2e-spec.ts
# → 11 passed (incl. CRM lead CRUD + org isolation)
```

## Remaining Wave 2+

- Live Meta WhatsApp soak with approved templates
- Customer 360 load soak / query plans
- Insurance claim events → timeline
- Redis isolation A≠B explicit P4 suite for 360 keys

## Final statement

> WhatsApp is the messaging campaign channel (SMS explicitly rejected). Dispatch runs on RUNNING (and via `POST .../dispatch-whatsapp`). Still not full master-prompt Production Ready without live Meta + 360 soak evidence.
