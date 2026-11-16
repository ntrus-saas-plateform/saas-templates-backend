# 24 — Reliability Findings Register

| Field | Value |
|-------|-------|
| **Document** | 24-reliability-findings-register.md |
| **Date** | 2026-11-16 |
| **Branch** | `feature/console` |
| **Backend HEAD reviewed** | `cd064ee677ea6cc069e3a50408f9d84a31de9cb2` |
| **Frontend HEAD reviewed** | `5b83a1bc5ce839925ff5a717103dd33016eb3db9` |
| **Remote backend `feature/console`** | `4fadf08` (local ahead 16; push **403** to `kabikaAsyst`) |
| **Remote frontend `feature/console`** | `d7dcb2e` (local ahead 10; push **403**) |
| **Independent tests executed** | `tsc` 0 errors; unit **1093/1093**; security **89/89** |
| **Integration / live Keycloak / Testcontainers** | **NOT EXECUTED** this audit run (`skipIf` without containers) → **E4/E5 NOT VERIFIED** |
| **Auditor posture** | Independent, adversarial, evidence-graded (E0–E5) |


## Linked reliability defects

| ID | Severity | Title | Reliability impact | Status |
|----|----------|-------|--------------------|--------|
| AUD-P0-02 | P0 | Missing lease/fencing on infra/PCI | Duplicate external mutations; split-brain side effects | REMEDIATED_PENDING_REVERIFY |
| AUD-P1-04 | P1 | Optional lease fail-open | Stale workers not rejected | REMEDIATED_PENDING_REVERIFY |
| AUD-P2-02 | P2 | In-memory local-managed provider | State loss on process restart; false READY | OPEN |
| AUD-P2-05 | P2 | Readiness step SUCCEEDED after FAILED check | Saga advances despite failed readiness | OPEN |
| AUD-P2-04 | P2 | Migration intercalation | Apply-order / ops risk across P7/P8 | OPEN |
| REL-P1-01 | P1 | E4/E5 recovery scenarios not executed | Unknown behavior under KC/RMQ/DB outage | OPEN — NOT VERIFIED |
| REL-P1-02 | P1 | Provider timeout idempotency (E2E-07) not executed | Duplicate resource risk unknown | OPEN — NOT VERIFIED |
| REL-P2-01 | P2 | Compensation paths largely unit-level | Crash recovery confidence limited to E2 | OPEN |

## NOT VERIFIED (reliability)

- E2E-20 DB recovery, E2E-21 RabbitMQ outage, E2E-22 Keycloak outage, E2E-23 Product Control outage
- Dual-worker fencing races under load

## Register verdict

Reliability **not production-certifiable**: fencing gaps are P0/P1; outage recovery **NOT VERIFIED** at E4/E5.
