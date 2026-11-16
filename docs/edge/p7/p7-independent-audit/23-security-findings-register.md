# 23 — Security Findings Register

| Field | Value |
|-------|-------|
| **Document** | 23-security-findings-register.md |
| **Date** | 2026-11-16 |
| **Branch** | `feature/console` |
| **Initial audit HEAD** | `cd064ee677ea6cc069e3a50408f9d84a31de9cb2` |
| **Remediation evidence** | Local uncommitted + pending commit after Batch A–D; focused E2 + edge suite **875/875** |
| **Frontend HEAD reviewed** | `5b83a1bc5ce839925ff5a717103dd33016eb3db9` |
| **Remote backend `feature/console`** | `4fadf08` (local ahead; push **403** to `kabikaAsyst`) |
| **Integration / live Keycloak / Testcontainers** | **NOT EXECUTED** → **E4/E5 NOT VERIFIED** |
| **Auditor posture** | Independent, adversarial, evidence-graded (E0–E5) |

**Status legend:** `OPEN` · `REMEDIATED_PENDING_REVERIFY` (code + E2 only; not CLOSED) · `CLOSED` (independent E3+/E4 verified)

## Summary

| Severity | Count | OPEN | REMEDIATED_PENDING_REVERIFY | CLOSED |
|----------|-------|------|-----------------------------|--------|
| P0 | 6 | 0 | **6** | 0 |
| P1 | 7 | 0 | **7** | 0 |
| P2 | 5 | **5** | 0 | 0 |

No finding is **CLOSED**: mandate §25 requires independent verification beyond code change.

---

### AUD-P0-01 — Infra live executor auth fail-open

| Field | Value |
|-------|-------|
| Phase | P7.6 |
| Severity | **P0** |
| Files | `live-infrastructure.executor.ts`, `edge-application.providers.ts` |
| Original evidence | E1 — snapshot `authorizationValid !== false` fail-open |
| Remediation | `revalidateBoundAuthorization` + lease gate before every mutation; snapshot flags deny-only |
| Re-verify evidence | E1 + E2 (`tsc` 0; edge 875/875) |
| Status | **REMEDIATED_PENDING_REVERIFY** (E4 provision attempt still required) |

### AUD-P0-02 — Infra + Product Control missing lease/fencing

| Field | Value |
|-------|-------|
| Phase | P7.5 / P7.6 |
| Severity | **P0** |
| Files | `live-infrastructure.executor.ts`, `live-product-control.executor.ts` |
| Remediation | Inject `RepositoryWorkflowLeaseValidator`; fail-closed if missing/stale |
| Re-verify evidence | E1 + E2 |
| Status | **REMEDIATED_PENDING_REVERIFY** |

### AUD-P0-03 — Unbound workflow create/start

| Field | Value |
|-------|-------|
| Phase | P7.1 / P7.4 |
| Severity | **P0** |
| Files | `workflow.use-cases.ts`, `workflow.dto.ts`, `workflow.use-cases.spec.ts` |
| Remediation | `definitionRequiresProvisioningAuthorization`; refuse create/start when unbound mutative; start uses `revalidateBoundAuthorization` |
| Re-verify evidence | E2 unit (AUD-P0-03 cases) |
| Status | **REMEDIATED_PENDING_REVERIFY** |

### AUD-P0-04 — Client-supplied `grantedEntitlements`

| Field | Value |
|-------|-------|
| Phase | P7.8 |
| Severity | **P0** |
| Files | `configuration.use-cases.ts` |
| Remediation | Ignore client granted map; require `entitlementSnapshotRef`; empty server ceiling fail-closed |
| Status | **REMEDIATED_PENDING_REVERIFY** |

### AUD-P0-05 — UNBOUND auth allows mutations (P7.13/14/15)

| Field | Value |
|-------|-------|
| Phase | P7.13 / P7.14 / P7.15 |
| Severity | **P0** |
| Files | `live-reconciliation.executor.ts`, `live-connectivity-agent.executor.ts`, `live-certification.executor.ts` |
| Remediation | Fail-closed without bound revalidation (UNBOUND removed) |
| Status | **REMEDIATED_PENDING_REVERIFY** |

### AUD-P0-06 — CERTIFY via client WAIVED/VERIFIED + canCertify from FAILED

| Field | Value |
|-------|-------|
| Phase | P7.15 |
| Severity | **P0** |
| Files | `certification-policy.ts`, certification use-cases/DTO |
| Remediation | WAIVED not satisfiable; CERTIFY only from READY; attach requires `sourceRef` |
| Status | **REMEDIATED_PENDING_REVERIFY** |

### AUD-P1-01 — JWKS fetch SSRF

| Field | Value |
|-------|-------|
| Phase | P7.7 |
| Severity | **P1** |
| Remediation | Same-origin check vs registered Keycloak base URL before JWKS/token use |
| Status | **REMEDIATED_PENDING_REVERIFY** (E4 live KC still required) |

### AUD-P1-02 — Product Control callback signature optional

| Field | Value |
|-------|-------|
| Phase | P7.5 |
| Severity | **P1** |
| Remediation | Missing signature → REJECTED fail-closed |
| Status | **REMEDIATED_PENDING_REVERIFY** |

### AUD-P1-03 — Migration 103 missing schema_migrations + edge_role_permissions

| Field | Value |
|-------|-------|
| Phase | P7.8 |
| Severity | **P1** |
| Remediation | Additive footer / role grants applied in controlled migration fix |
| Status | **REMEDIATED_PENDING_REVERIFY** (clean DB apply E3 not re-run this turn) |

### AUD-P1-04 — Lease optional fail-open on most live executors

| Field | Value |
|-------|-------|
| Phase | P7.4+ |
| Severity | **P1** |
| Remediation | All live executors fail-closed when lease missing; infra/PCI lease mandatory |
| Status | **REMEDIATED_PENDING_REVERIFY** |

### AUD-P1-05 — P7.9 verifiedHosts skip

| Field | Value |
|-------|-------|
| Phase | P7.9 |
| Severity | **P1** |
| Remediation | Redirect registration requires ≥1 verified domain; bind assert retained |
| Status | **REMEDIATED_PENDING_REVERIFY** |

### AUD-P1-06 — Agent commandType unrestricted; signatureRef optional

| Field | Value |
|-------|-------|
| Phase | P7.14 |
| Severity | **P1** |
| Remediation | Allowlisted `commandType`; `signatureRef` mandatory |
| Status | **REMEDIATED_PENDING_REVERIFY** |

### AUD-P1-07 — Reconciliation approve authOk when unbound

| Field | Value |
|-------|-------|
| Phase | P7.13 |
| Severity | **P1** |
| Remediation | Unbound approve path fail-closed (`authOk=false`) |
| Status | **REMEDIATED_PENDING_REVERIFY** |

### AUD-P2-01 — Migration 097 missing schema_migrations

| Severity | **P2** | Status | **REMEDIATED_PENDING_REVERIFY** (footer fix) |

### AUD-P2-02 — Local-managed provider in-memory ACTIVE

| Severity | **P2** | Status | **OPEN** |

### AUD-P2-03 — EnvCredentialProvider plaintext PCI secrets

| Severity | **P2** | Status | **OPEN** |

### AUD-P2-04 — Migration 108 P8 intercalated before 109

| Severity | **P2** | Status | **OPEN** |

### AUD-P2-05 — Readiness steps ok after required FAILED

| Severity | **P2** | Status | **OPEN** |
