# 02 — Global Architecture Audit

| Field | Value |
|-------|-------|
| **Document** | 02-architecture-audit.md |
| **Date** | 2026-11-16 |
| **Branch** | `feature/console` |
| **Backend HEAD reviewed** | `cd064ee677ea6cc069e3a50408f9d84a31de9cb2` |
| **Frontend HEAD reviewed** | `5b83a1bc5ce839925ff5a717103dd33016eb3db9` |
| **Remote backend `feature/console`** | `4fadf08` (local ahead 16; push **403** to `kabikaAsyst`) |
| **Remote frontend `feature/console`** | `d7dcb2e` (local ahead 10; push **403**) |
| **Independent tests executed** | `tsc` 0 errors; unit **1093/1093**; security **89/89** |
| **Integration / live Keycloak / Testcontainers** | **NOT EXECUTED** this audit run (`skipIf` without containers) → **E4/E5 NOT VERIFIED** |
| **Auditor posture** | Independent, adversarial, evidence-graded (E0–E5) |


## Scope

Control Plane / Data Plane separation, domain ownership, source-of-truth, hexagonal quality across P7 modules under `src/modules/edge/`.

## Evidence obtained

| Item | Grade | Notes |
|------|-------|-------|
| Nest modular monolith + domain/application/infrastructure/presentation | E1 | Consistent layout |
| Workflow engine (P7.4) as orchestration backbone | E1/E2 | Present; lease fail-open on many executors (AUD-P1-04) |
| P7.1 `WorkflowAuthorizationPort.revalidateBoundAuthorization` | E1/E2 | Canonical port exists; **not wired** on infra/PCI mutation paths (AUD-P0-01/02) |
| No business IAM ownership claimed in Edge docs | E0/E1 | Boundary intent clear; agent/cert paths weaken auth (AUD-P0-05/06) |

## Requirements vs actual

| Requirement | Actual | Verdict |
|-------------|--------|---------|
| Edge = Control Plane only | Generally held; orchestration domains for infra/KC/PCI/config/lifecycle | MEETS WITH LIMITS |
| Distinct SoT (P5 commercial vs P7 technical) | Modeled; P7.8 `grantedEntitlements` client-supplied undermines P5 ceiling (AUD-P0-04) | FAILS (security SoT) |
| Fail-closed auth at every external mutation | Keycloak live executor improved historically; infra/PCI/unbound paths fail-open | FAILS |
| Durable workflow + fencing | Engine present; optional lease on most live executors | FAILS (P1) |

## Findings referenced

- AUD-P0-01, AUD-P0-02, AUD-P0-03, AUD-P0-04, AUD-P0-05
- AUD-P1-04, AUD-P2-02, AUD-P2-04

## NOT VERIFIED

- Live multi-provider isolation under load (E4/E5)
- Production Keycloak topology Models A/B/C end-to-end (E4)
- Circular dependency graph under all Nest providers (static only)

## Phase / section verdict

**FAILS** as a production Control Plane architecture: core hexagonal shape exists, but authorization/fencing fail-open paths violate Control Plane safety invariants.
