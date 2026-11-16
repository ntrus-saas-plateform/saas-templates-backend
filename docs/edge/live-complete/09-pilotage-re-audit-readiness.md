# 09 — Pilotage plateforme — readiness for independent re-audit

**Date:** 2026-11-16  
**Scope:** Edge control-plane pilotage (tenant / abo / payment sandbox / BB provision) — **not** P11 enterprise, **not** ERP métier.

## Proposed status for next independent audit

**READY FOR FINAL RE-AUDIT** (lab code path) — **not ACCEPTED**, **not** remote-synced.

## Local SHAs (this continuation)

| Repo | Branch | HEAD |
|------|--------|------|
| Backend | `feature/console` | `5cf4b71259d879106e30a697f0aa10f28ecd3b45` |
| Frontend | `feature/console` | `c256f16a72107e492ecf0f73524cef26164e3a34` |

Push to GitHub: still **DENIED 403** for `kabikaAsyst` (criterion 1 remains NEED_LAB_RUN until fixed).

## Evidence already machine-checkable

| Proof | Result |
|-------|--------|
| `tsc --noEmit` | PASS |
| live-complete + provisioning + sandbox + acquisition runtime vitest | **60+** related tests green (incl. orchestration PAID→lab_bb→portal) |
| FE live-complete badges | **5** passed |
| Criterion 6 (no OPERATION_NOT_IMPLEMENTED on critical path) | CODE_COMPLETE |

## Still required before ACCEPTED / enterprise lab claim

1. Successful `git push` of both repos  
2. Docker lab campaign: BB up + Keycloak + `LIVE_COMPLETE_E2E=1` + filled `05-e2e-evidence-template.md`  
3. Manual console + public acquisition golden path with correlation IDs  
4. Independent auditor sign-off  

## Lab env (minimum)

```text
BILLING_PAYMENT_ADAPTER=sandbox
EDGE_P7_PROVISIONING_ADAPTER=lab_bb
EDGE_BB_CONTROL_BASE_URL=http://host.docker.internal:3000
EDGE_BB_CONTROL_TOKEN=lab-token
EDGE_BB_CONTROL_ALLOW_INSECURE_HTTP=true
```

Then: `pnpm migrate:control` · `pnpm seed:live-complete` · start Edge + BB · run golden path.
