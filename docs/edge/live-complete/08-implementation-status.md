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
| 5 E2E pack | **DONE (E2/E3)** | golden-path.spec 5/5; live docker smoke gated `LIVE_COMPLETE_E2E=1` |
| 6 Console deep-links + badges | **DONE** | FE badge + `GET edge/live-complete/status` |
| 7 Vague 2 roadmap | **DOCUMENTED** | `07-vague2-roadmap.md` — execute after lab E2E green |

## Honest limits

- Lab docker E2E bout-en-bout **NEED_LAB_RUN** (criteria 1–5, 7 in `06-acceptance-criteria-v1.md`).
- Push GitHub may still be **403** — remote SHAs not updated until credentials fixed.
- `p7.5.product_control.provision|activate` require `PRODUCT_CONTROL_LIVE_EXECUTOR` + `EDGE_BB_CONTROL_BASE_URL`.
- Sandbox payment is **explicit** only (`BILLING_PAYMENT_ADAPTER=sandbox`) — never auto.

## Vitest (auditor machine)

- BE live-complete related: **19 passed** (5 files)
- FE adapter badge (+ related): run `vitest run components/edge/live-complete`
