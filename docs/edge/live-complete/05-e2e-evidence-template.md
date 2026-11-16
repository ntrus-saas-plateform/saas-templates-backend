# 05 — E2E evidence template (live-complete)

Copy this file (or a dated copy) per lab run. Fill every row; leave blanks as `NOT RUN` — never invent PASS.

## Run metadata

| Field | Value |
|-------|-------|
| Date (UTC) | |
| Operator | |
| Lab name / host | |
| Backend SHA | |
| Frontend SHA | |
| BB SHA | |
| Branch | `feature/console` |
| `BILLING_PAYMENT_ADAPTER` | |
| `EDGE_P7_PROVISIONING_ADAPTER` | |
| `EDGE_BB_CONTROL_BASE_URL` | |
| Compose / notes | |

## Scenario results

| # | Scenario | PASS / FAIL / NOT RUN | Correlation ID(s) | Notes / log refs |
|---|----------|-----------------------|-------------------|------------------|
| 1 | Console ops golden path | | | |
| 2 | Acquisition P10 → handoff | | | |
| 3 | Renewal / change plan + re-billing | | | |
| 4 | Suspend / resume | | | |
| 5 | Deprovision authorize (SoD) | | | |
| 6 | Replay webhook paiement | | | |
| 7 | BB unavailable (no faux SUCCESS) | | | |
| 8 | PSP unavailable (abo non activé) | | | |
| 9 | Permission deny export/billing | | | |
| 10 | Reconciliation P7 après outage | | | |

## Automated suites (honest labels)

| Suite | Ran? | Result | Notes |
|-------|------|--------|-------|
| E2/E3 `live-complete-golden-path.spec.ts` | | | Contracts only — **not** live docker E2E |
| Opt-in smoke `LIVE_COMPLETE_E2E=1` | | | Requires lab `EDGE_API_URL` |

## Key artefacts

| Artefact | Value / path |
|----------|--------------|
| Subscription ID | |
| Invoice / payment intent ref | |
| Provisioning request ID | |
| Tenant ID (`tenantRef`) | |
| BB ready response (redacted) | |
| Portal `provisioningComplete` | |

## Verdict

- [ ] All 10 scenarios PASS in lab  
- [ ] SHAs recorded match running processes  
- [ ] No `Unavailable*` / invented SUCCESS on critical path  
- [ ] Ready for independent re-audit of **pilotage plateforme** (not P11)

**Signed verdict:** `PASS` / `FAIL` / `PARTIAL` — _______________
