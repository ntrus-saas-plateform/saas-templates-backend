# 00 — Independent Audit Charter

| Field | Value |
|-------|-------|
| **Document** | 00-audit-charter.md |
| **Date** | 2026-11-16 |
| **Branch** | `feature/console` |
| **Backend HEAD reviewed** | `cd064ee677ea6cc069e3a50408f9d84a31de9cb2` |
| **Frontend HEAD reviewed** | `5b83a1bc5ce839925ff5a717103dd33016eb3db9` |
| **Remote backend `feature/console`** | `4fadf08` (local ahead 16; push **403** to `kabikaAsyst`) |
| **Remote frontend `feature/console`** | `d7dcb2e` (local ahead 10; push **403**) |
| **Independent tests executed** | `tsc` 0 errors; unit **1093/1093**; security **89/89** |
| **Integration / live Keycloak / Testcontainers** | **NOT EXECUTED** this audit run (`skipIf` without containers) → **E4/E5 NOT VERIFIED** |
| **Auditor posture** | Independent, adversarial, evidence-graded (E0–E5) |


## Mission

Independently determine whether Okapi Edge **P7.1 → P7.15** (and P7 COMPLETE) is implemented, secure, integrated, reliable, and suitable for production — not whether development work exists.

Developer acceptance reports, unit-test green bars, and documentation claims are **not** independent evidence of production readiness.

## Independence rules

1. Evidence over assertion (E0–E5 grading mandatory).
2. Runtime / external behavior over docs and mocks.
3. Server-side enforcement over frontend UX.
4. Fail-closed over permissive fallback.
5. Do not convert skipped tests into passes.
6. Do not fabricate E4/E5 when Testcontainers/Keycloak live suites were not executed.
7. Do not issue **P7 ACCEPTED — PRODUCTION READY** while P0 findings remain open.

## Scope

| In scope | Out of scope |
|----------|--------------|
| P7.1–P7.15 backend + console on `feature/console` | Unrelated P0–P6 product features except as P7 prerequisites |
| Migrations `095`–`111` (+ intercalated `108` P8) | Formal G1/P5 production trust key ceremony |
| Security, isolation, workflow, recovery, E2E criteria | Remediation implementation in this initial report pack |
| Cross-phase contracts and operational readiness | Claiming remote push succeeded (403 observed) |

## Evidence grades

| Grade | Meaning |
|-------|---------|
| **E0** | Assertion / author docs only |
| **E1** | Static source / migration / config inspection |
| **E2** | Automated unit/component/security tests |
| **E3** | Live API/DB execution in controlled env |
| **E4** | Real external provider / Keycloak / Product Control |
| **E5** | Full business-independent E2E journey with correlated proof |

Critical provisioning/security claims require **≥ E3**, preferably **E4/E5**. This audit run achieved **E1–E2** broadly; **E4/E5 NOT VERIFIED**.

## Deliverables

Complete pack: `00` … `29` under `docs/edge/p7/p7-independent-audit/`.

## Initial certification stance

Open **P0** findings preclude production certification. Final verdict documented in `29-final-independent-audit-report.md`: **P7 REJECTED** (production certification of the complete program), with pathway to **P7 READY FOR FINAL RE-AUDIT** only after P0 closure and independent re-verification including E4/E5 where mandated.
