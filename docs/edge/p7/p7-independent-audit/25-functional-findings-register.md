# 25 — Functional Findings Register

| Field | Value |
|-------|-------|
| **Document** | 25-functional-findings-register.md |
| **Date** | 2026-11-16 |
| **Branch** | `feature/console` |
| **Backend HEAD reviewed** | `cd064ee677ea6cc069e3a50408f9d84a31de9cb2` |
| **Frontend HEAD reviewed** | `5b83a1bc5ce839925ff5a717103dd33016eb3db9` |
| **Remote backend `feature/console`** | `4fadf08` (local ahead 16; push **403** to `kabikaAsyst`) |
| **Remote frontend `feature/console`** | `d7dcb2e` (local ahead 10; push **403**) |
| **Independent tests executed** | `tsc` 0 errors; unit **1093/1093**; security **89/89** |
| **Integration / live Keycloak / Testcontainers** | **NOT EXECUTED** this audit run (`skipIf` without containers) → **E4/E5 NOT VERIFIED** |
| **Auditor posture** | Independent, adversarial, evidence-graded (E0–E5) |


## Functional / correctness defects

| ID | Severity | Title | Functional impact | Status |
|----|----------|-------|-------------------|--------|
| AUD-P0-04 | P0 | Client grantedEntitlements | Wrong entitlements deployable | REMEDIATED_PENDING_REVERIFY |
| AUD-P0-06 | P0 | Certify evidence forge / FAILED certify | False production certification | REMEDIATED_PENDING_REVERIFY |
| AUD-P1-05 | P1 | Clients registered before domain bind | Redirects unbound to verified hosts | REMEDIATED_PENDING_REVERIFY |
| AUD-P1-03 | P1 | Missing role permissions in 103 | Operators may lack intended RBAC grants | REMEDIATED_PENDING_REVERIFY |
| AUD-P1-02 | P1 | Unsigned PCI callbacks RECEIVED | Orchestration on unauthenticated signals | REMEDIATED_PENDING_REVERIFY |
| AUD-P1-06 | P1 | Unrestricted agent commandType | Arbitrary command semantics | REMEDIATED_PENDING_REVERIFY |
| AUD-P1-07 | P1 | Approve remediation unbound | Governance approve without auth proof | REMEDIATED_PENDING_REVERIFY |
| AUD-P2-01 | P2 | Migration 097 untracked | Ops drift vs applied schema | REMEDIATED_PENDING_REVERIFY |
| FUN-P2-01 | P2 | Cloud infra providers unsupported | Functional claims must stay lab/PG-scoped | OPEN (scope) |
| FUN-P2-02 | P2 | Model C Keycloak not live-certified | EXTERNAL_SPECIFIC unavailable | OPEN — NOT VERIFIED |

## Functional coverage note

Unit **1093/1093** and security **89/89** demonstrate local functional regressions green at E2 — they **do not** close the P0 functional trust bugs above.
