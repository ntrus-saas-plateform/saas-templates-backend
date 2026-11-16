# 08 — Implementation status (live-complete V1 code)

**Date:** 2026-11-16  
**Branch:** `feature/console`

## Code delivered (this wave)

| Phase | Status | Evidence |
|-------|--------|----------|
| 0 Lab baseline docs + compose env | **DONE** | `00-lab-baseline.md`, `01-env-lab.example.md`, docker-compose env |
| 1 Sandbox payment | **DONE** | `sandbox-payment.adapter.ts` + resolving + vitest |
| 2 BB provision/activate | **DONE** | `control-v1-business-backend.client.ts` + live executor cases |
| 3 Portal `provisioningComplete` | **DONE** | `TenantRuntimeStatusPort` → BB `/ready` |
| 4 Keycloak/infra checklist | **DONE** | `04-keycloak-infra-live.md` |
| 5 E2E pack | **DONE (E2/E3)** | golden-path.spec; live smoke gated `LIVE_COMPLETE_E2E=1` (liveness + `/api/v1/edge/live-complete/status` never 404) |
| 6 Console deep-links + badges | **DONE** | FE badge + status API; onboarding / billing / subscriptions; tenant→subscription link |
| 7 Vague 2 roadmap | **DOCUMENTED** | `07-vague2-roadmap.md` — execute after lab E2E green |

## MUST_FIX closures

| Gap | Status | Evidence |
|-----|--------|----------|
| `lab_bb` adapter for complete BB provision path | **CLOSED** | `lab-bb-provisioning.adapter.ts` + resolving `EDGE_P7_PROVISIONING_ADAPTER=lab_bb` — lab BB provision/activate path (not durable SoD) |
| PAID auto-triggers `RequestProvisioning` | **CLOSED** | Invoice PAID settlement invokes `RequestProvisioningUseCase` when subscription is linked |
| Readiness `bb_tenant_ready` check | **CLOSED** | BB `GET /control/v1/tenants/:id/ready` via `TenantRuntimeStatusPort` / readiness `bb_tenant_ready` — never invents READY |
| Pharmacy lab seed | **CLOSED** | `scripts/seed-live-complete-pharmacy.ts`, `pnpm seed:live-complete`, migration `124_edge_live_complete_pharmacy_seed.sql` |

## Honest limits

- Full docker campaign **NEED_LAB_RUN** (criteria 1–5, 7 in `06-acceptance-criteria-v1.md`).
- Push GitHub may still be **403** — remote SHAs not updated until credentials fixed.
- `p7.5.product_control.provision|activate` require `PRODUCT_CONTROL_LIVE_EXECUTOR` + `EDGE_BB_CONTROL_BASE_URL`.
- Sandbox payment is **explicit** only (`BILLING_PAYMENT_ADAPTER=sandbox`) — never auto.
- `lab_bb` ≠ `durable`: lab adapter for complete BB path; production SoD remains `EDGE_P7_PROVISIONING_ADAPTER=durable`.

## Vitest (auditor machine)

- BE live-complete related: golden-path + smoke (smoke skipped unless `LIVE_COMPLETE_E2E=1`)
- FE adapter badge: `vitest run components/edge/live-complete` — **4 passed**
