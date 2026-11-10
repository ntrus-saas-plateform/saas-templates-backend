# P7.0 — Frontend Repository Audit

**Repo:** `saas-template-frontend`  
**Date:** 2026-11-10  
**Source:** Live inspection + [Explore frontend P7.0](dfe6cdae-7a4a-43ac-94c7-bccdb759f8a2)

## Shell & navigation

| Item | Observation | Decision |
|------|-------------|----------|
| `(edge-console)/layout.tsx` | Isolated: session → platform → auth gate → shell | **REUSE** |
| `EdgeShell` | Platform + workspace nav | **REUSE** |
| Tenant Management | `/edge/tenants`, **disabled: true**, no pages under `app/(edge-console)/edge/tenants` | **EXTEND** → Product Tenant / Provisioning hub |
| ERP `admin/tenants` | Identity tenant provision UI | **DO NOT REUSE** as P7 |

## Patterns to mirror (P4–P6)

Tabbed hub + `[id]` detail workspace + `EdgePermissionGate` + `states.tsx` + `edgeApi` / `EdgeApiError`:

- Sales: `edge/sales` + opportunities workspace  
- Subscriptions: hub includes **Provisioning tab = P5 coordination only** (not P7 ops)  
- Billing: ops console + portal honesty UX  

**Note:** ERP `components/data/data-table.tsx` has **0** imports under Edge console — P7 needs server pagination/filter; either extract Edge table kit or adapt DataTable deliberately.

## API client (`lib/api/edge.ts`)

| Asset | Decision |
|-------|----------|
| `edgeRequest` / CSRF / correlation / `{ data, pagination }` | **REUSE** |
| P5 `requestSubscriptionProvisioning` / list / complete | **REUSE** as bridge; do not invent success |
| P7 methods block | **BUILD** (absent) |

## Playwright

Reuse `e2e/edge-*-smoke|scenarios.spec.ts` + optional `EDGE_E2E_AUTH=1`. **EXTEND** auth `testMatch` and add `edge-tenants-*` / provisioning specs after contracts; E2E-01…08 **BUILD**.

## Screens (plan §20)

All 23 P7 screens **BUILD**. First FE slice after P7.1 API: Provisioning Dashboard → Requests → Details. Defer Workflow Center until P7.4.

Do **not** overload `/edge/catalog` or `/edge/readiness` (commercial) for technical Product Registry / activation readiness without rename/split.

## UX rules

- Server pagination/filter/sort  
- No fake progress without confirmed step evidence  
- Confirm + permission for sensitive ops  
- No free-text technical IDs when registries exist  
