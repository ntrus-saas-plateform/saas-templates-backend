# 18 — Cross-Phase Contract Audit

| Field | Value |
|-------|-------|
| **Document** | 18-cross-phase-contract-audit.md |
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

Contracts between P7.1↔P7.4↔P7.5/6/7/8…15: authorization binding, workflow keys, outbox events, entitlement ceiling, activation vs commercial state.

## Evidence obtained

| Contract | Grade | Status |
|----------|-------|--------|
| P7.1 port injected into many executors | E1 | Incomplete (infra/PCI missing) |
| P7.4 lease validator authoritative for KC | E1 | Not universal |
| P5 entitlement ceiling into P7.8 | E1 | Broken by client `grantedEntitlements` |
| P7.10 activation ≠ P5 Subscription.ACTIVE | E1 | Held |
| P7.13 UNKNOWN semantics vs P7.11 delete | E1 | Intent held |
| Migration monotonic P7 numbering | E1 | Broken by `108` P8 (AUD-P2-04) |

## Requirements vs actual

| Requirement | Actual | Result |
|-------------|--------|--------|
| Uniform fail-closed auth+fencing | Heterogeneous | **FAIL** |
| No entitlement expansion | Client-supplied grant map | **FAIL** |
| Clear SoT ownership | Mostly documented; some duplicate authority risk | MEETS WITH LIMITS |

## Findings

- AUD-P0-01…06 as contract breaches; AUD-P2-04 numbering.

## NOT VERIFIED

- Full contract test matrix across all phase pairs at E3+

## Section verdict

**FAILS** — Cross-phase safety contracts are not uniformly enforced.
