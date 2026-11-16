# 21 — API & Frontend Audit

| Field | Value |
|-------|-------|
| **Document** | 21-api-frontend-audit.md |
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

Edge REST DTOs/controllers RBAC; console modules for P7.3–P7.15 on frontend HEAD `5b83a1b…`.

## Evidence obtained

| Item | Grade | Notes |
|------|-------|-------|
| Controllers under `presentation/controllers/*` | E1 | Present |
| Dangerous DTO fields: `grantedEntitlements`, cert `itemStatus`, agent `commandType`/`signatureRef` | E1 | AUD-P0-04/06, AUD-P1-06 |
| Frontend console feature modules | E1 | Present on `feature/console` |
| Frontend cannot be trusted for auth | E1 principle | Server gaps dominate |
| Push remote | — | 403 both repos |

## Requirements vs actual

| Requirement | Actual | Result |
|-------------|--------|--------|
| Server enforces all authz | Fail-open paths exist | **FAIL** |
| DTOs do not accept trust-critical client assertions | Several do | **FAIL** |
| UI reflects technical states only | Appears aligned (E1) | MEETS WITH LIMITS |

## Findings

- API surface is the delivery mechanism for AUD-P0-04, AUD-P0-06, AUD-P1-06.

## NOT VERIFIED

- Full UI E2E against live backend (E5)
- Accessibility / UX (out of certification critical path)

## Section verdict

**FAILS** — Frontend presence does not compensate for server trust-boundary defects.
