# 10 — Vague 2 status

**Date:** 2026-11-16  
**Branch:** `feature/console`  
**Note:** Vague 2 started on explicit request while Pharmacy docker E2E remains NEED_LAB_RUN.

## Delivered (code path)

| Item | Status | Evidence |
|------|--------|----------|
| 2e produit Restaurant | **CODE_COMPLETE** | `125_edge_vague2_restaurant_seed.sql`, `pnpm seed:live-complete:restaurant`, `vague2-restaurant-golden-path.spec.ts` |
| Moteur INVOICED/COLLECTED/RECEIVABLES | **CODE_COMPLETE** | `cash-revenue-calculator.ts`, `ComputeCashRevenueUseCase`, `POST /edge/revenue/cash/compute` |
| Gate snapshots cash sans `source=engine` | **CODE_COMPLETE** | `assertCashMetricSnapshotProvenance` in `RecordMetricSnapshotUseCase` |
| Pack tests cash + gate | **CODE_COMPLETE** | `cash-revenue-calculator.spec.ts`, revenue use-case specs |
| Hardening prod docs | **DOCUMENTED** | [`11-prod-hardening-golive.md`](./11-prod-hardening-golive.md) |
| Push remote / Gate A | **NEED_LAB_RUN** | push 403 `kabikaAsyst` |
| Deux golden paths lab docker | **PARTIAL** | Lab stack up locally (2026-11-17): Edge:3000 + BB:3100 provision **201** / ready **true**; smoke LIVE_COMPLETE_E2E **2/2**; full console golden path still manual |
| P11 remédiation suite (004/005/006/009/010 + multi-PSP) | **CODE_COMPLETE** | see [`../p11-saas-business-revenue-operations/28-vague2-continuation-pack.md`](../p11-saas-business-revenue-operations/28-vague2-continuation-pack.md) |
| P11 re-audit ACCEPTED | **NOT CLAIMED** | remédiation P0 partielle ; re-audit indépendant requis |

## Env (identique V1)

```text
BILLING_PAYMENT_ADAPTER=sandbox
EDGE_P7_PROVISIONING_ADAPTER=lab_bb
EDGE_BB_CONTROL_BASE_URL=...
```

Seed:

```bash
pnpm seed:live-complete:all
```

Cash compute:

```http
POST /api/v1/edge/revenue/cash/compute
{ "periodStart":"...", "periodEnd":"...", "currency":"USD", "persistSnapshots": true }
```
