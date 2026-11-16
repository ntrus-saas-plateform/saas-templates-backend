# P7.7 — Acceptance Report

| Field | Value |
|-------|-------|
| **Package** | Keycloak Topology Provisioning — Security & Integration Remediation |
| **Date** | 2026-11-16 |
| **Branch** | `feature/console` (both repos) |
| **Boundary** | P7.8+ (deployment configs, product provisioning, readiness/activation) **NOT implemented** |
| **Verdict** | **READY FOR RE-AUDIT** |

## Git state

| Repo | HEAD | P7.7 remediation | Push |
|------|------|------------------|------|
| `saas-templates-backend` | _(recorded after local commit on `feature/console`)_ | **COMMITTED locally** | Retry reported below — do not claim remote publication on 403 |
| `saas-template-frontend` | `d7dcb2eb4181070d643ca3300ca5250ff6c097ed` | Clean working tree (no additional P7.7 remediation diff) | Same remote permission constraints as backend |

## Fixed defects (this remediation)

| # | Defect | Fix |
|---|--------|-----|
| P0-1 | P7.1 authorization trusted snapshot flags / string-only helper | Canonical `WorkflowAuthorizationPort.revalidateBoundAuthorization` injected into `live-keycloak.executor`; fail-closed on missing/stale/revoked/expired/timeout; durable redacted evidence |
| P0-2 | Fencing compared token to itself | `WorkflowLeasePort` / `RepositoryWorkflowLeaseValidator` validates authoritative step lease (worker, expiry, fencing token) before every mutation and compensation |
| P1-1 | Reconciliation launched provision definition | Controller + `LaunchTopologyWorkflowUseCase` route to `p77.keycloak.topology.reconcile` (`validate_plan` → `reconcile_topology`); routing unit tests |
| P1-2 | Org capability probe mistaken for creation test | Live Testcontainers path creates technical org, read-back, idempotent adoption, partial-failure recovery, asserts no business identities |
| P1-3 | Live reconciliation not executed | Live path: dedicated realm → external drift → reconcile → remediate → idempotent NO_DRIFT → server-loss fail-closed → recovery |
| Runtime | `advanceDependents` read steps outside TX | `listSteps(..., client)` so dependents become READY in the same transaction as complete |
| Runtime | Audit UUID columns rejected worker ids | `requireAudit` binds UUIDs only; free-form worker ids preserved as `actorRef` |
| Runtime | KC 26 Organizations per-realm switch + domain required | `organizationsEnabled` + technical domain on create; feature detection parses FeatureRepresentation objects |
| Runtime | Realm settings PUT used thin/legacy projection | Full realm GET + allow-listed KC 26 field overlay |
| Runtime | Definition version invisible in open TX | `ensureKeycloakDefinition` uses `created.version` from `createDefinition` |

## Acceptance criteria (mandate)

| # | Criterion | Verdict | Evidence |
|---|-----------|---------|----------|
| 1 | Model A/B/C topology paths | **PASS** (A+B live; C code-path SKIPPED) | Live suite 12/12 |
| 2 | No business IAM | **PASS** | Live org test: 0 users/groups/members; roles unchanged |
| 3 | P7.8+ boundary | **PASS** | Unchanged |
| 4 | Lifecycle / state machine | **PASS** | Unit + `RETRY_PENDING → SUCCEEDED` allowed for recovery |
| 5 | Real Admin API | **PASS** | KC **26.0.7** Testcontainers |
| 6 | Vault-only secrets | **PASS** | Security + live redaction |
| 7 | Mutations via P7.4 only | **PASS** | Executor + routing tests |
| 8 | Real P7.4 fencing | **PASS** | Security harness stale-worker + lease port |
| 9 | P7.1 fail-closed revalidation | **PASS** | Security + live revocation between steps (0 provider calls) |
| 10 | SSRF | **PASS** | Security + live |
| 11 | RBAC | **PASS** | Unchanged + frontend clean |
| 12 | Migration 102 | **PASS** | DB suite |
| 13 | Evidence / history / audit / outbox | **PASS** | Live + DB |
| 14 | Reconciliation without blind recreate | **PASS** | Live §5 |
| 15 | Capability discovery | **PASS** | Live asserts `organizationsSupported=true` on KC 26 |
| 16 | Frontend console | **PASS** | No remediation delta; HEAD clean |
| 17 | Typecheck | **PASS** | `tsc --noEmit` 0 |
| 18 | Executed matrix green | **PASS** | See results below |
| 19 | Honest gaps | **PASS** | Model C still not live; push may remain 403 |
| 20 | Remote push | **REPORT ONLY** | Exact error if still 403 — not ACCEPTED solely on local green |

## Tests executed / results (2026-11-16)

| Suite | Result |
|-------|--------|
| Backend unit | **861 / 861 passed** |
| Backend security | **89 / 89 passed** (incl. P7.1/P7.4 harness) |
| Backend live Keycloak (`TESTCONTAINERS=true`, KC **26.0.7**) | **12 / 12 passed** |
| Backend typecheck | **0 errors** |
| Frontend working tree | **clean** at `d7dcb2eb…` |

### Live Keycloak results (detail)

| Area | Result |
|------|--------|
| Realm creation (dedicated) | PASS — create + idempotent re-adopt |
| Organization creation (Model B) | PASS — create, Admin API read-back (id+alias), idempotent adoption, partial-failure recovery, no business users/roles/memberships |
| Reconciliation | PASS — drift on `ssoSessionIdleTimeout`, in-place remediate, NO_DRIFT repeat, server unavailability fail-closed + recovery |
| P7.1 fail-closed (live) | PASS — revocation between steps → DENY evidence, **zero** provider mutation calls |
| Controller reconcile routing | PASS — instance `workflow_type=keycloak.topology.reconcile`, definition handlers exact |

### Security / fencing

| Area | Result |
|------|--------|
| P7.1 denied cases → 0 Keycloak mutations | PASS (security harness) |
| Stale worker A after B reclaim | PASS (authoritative lease validator) |
| Controller routing (no createRealm/org/client on reconcile) | PASS |

## Remaining limitations

1. Remote push may still fail with **HTTP 403** on `ntrus-saas-plateform/*` — local commit only until permissions allow.
2. Model C (`EXTERNAL_SPECIFIC`) remains code-path / SKIPPED — no certified external adapter in the lab.
3. Frontend inherits pre-existing TS debt outside P7.7 files (unchanged).
4. Verdict is **READY FOR RE-AUDIT**, not **ACCEPTED** — independent re-audit required after P0/P1 fixes.

## Reproducible commands

```powershell
cd saas-templates-backend
npx tsc --noEmit
npm test
npm run test:security
$env:TESTCONTAINERS='true'
npx vitest run --config ./vitest.config.integration.ts test/integration/edge-keycloak-live.spec.ts
```

## Verdict

**READY FOR RE-AUDIT** — P0 P7.1 revalidation and P0 P7.4 fencing corrected in runtime code; live organization creation and live reconciliation executed against Keycloak 26.0.7; local tests green. Do not treat as ACCEPTED until independent audit confirms and remote publication (if required) succeeds.
