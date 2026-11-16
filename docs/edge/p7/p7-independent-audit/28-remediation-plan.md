# 28 — Remediation Plan

| Field | Value |
|-------|-------|
| **Document** | 28-remediation-plan.md |
| **Date** | 2026-11-16 |
| **Branch** | `feature/console` |
| **Backend HEAD reviewed** | `cd064ee677ea6cc069e3a50408f9d84a31de9cb2` |
| **Frontend HEAD reviewed** | `5b83a1bc5ce839925ff5a717103dd33016eb3db9` |
| **Remote backend `feature/console`** | `4fadf08` (local ahead 16; push **403** to `kabikaAsyst`) |
| **Remote frontend `feature/console`** | `d7dcb2e` (local ahead 10; push **403**) |
| **Independent tests executed** | `tsc` 0 errors; unit **1093/1093**; security **89/89** |
| **Integration / live Keycloak / Testcontainers** | **NOT EXECUTED** this audit run (`skipIf` without containers) → **E4/E5 NOT VERIFIED** |
| **Auditor posture** | Independent, adversarial, evidence-graded (E0–E5) |


Per mandate **§25**, remediate in controlled batches. A finding is **CLOSED** only after independent re-verification (not merely after code change).

## Priority order (§25)

1. **P0 security and authorization** — AUD-P0-01, AUD-P0-03, AUD-P0-05  
2. **P0 tenant isolation and unauthorized provisioning** — AUD-P0-01, AUD-P0-02, AUD-P0-03  
3. **P0 activation and data integrity** — AUD-P0-04, AUD-P0-06, AUD-P2-05  
4. **P1 distributed concurrency and fencing** — AUD-P0-02 (complete), AUD-P1-04  
5. **P1 provider integration and recovery** — AUD-P1-01, AUD-P1-02, REL-* E4 suites  
6. **P1 lifecycle and termination** — lifecycle fencing inheritance; E2E-13…15  
7. **P1 external integration correctness** — AUD-P1-05, AUD-P1-06, AUD-P1-07  
8. **P2 functional and operational gaps** — AUD-P2-01…04, AUD-P1-03  
9. **P3 maintainability and usability** — backlog after P0/P1 closed  

## Batch plan

### Batch A — Auth fail-closed (block production)

| Finding | Required correction | Regression tests | Re-audit |
|---------|---------------------|------------------|----------|
| AUD-P0-01 | Wire `revalidateBoundAuthorization`; remove snapshot fail-open | Security + infra unit; deny without bind | E2 + E4 provision attempt |
| AUD-P0-03 | Require `provisioningRequestId` for mutative workflows; refuse unbound start | Workflow security tests | E2 |
| AUD-P0-05 | Delete UNBOUND allow; fail-closed | Reconcile/agent/cert security tests | E2 |

### Batch B — Entitlement & certification integrity

| Finding | Correction | Re-audit |
|---------|------------|----------|
| AUD-P0-04 | Server-side P5 grant projection only | Expansion attack tests E2/E3 |
| AUD-P0-06 | Server-verified evidence; no client VERIFIED/WAIVED without break-glass; block CERTIFY from FAILED | Policy + API tests |

### Batch C — Fencing universalization

| Finding | Correction | Re-audit |
|---------|------------|----------|
| AUD-P0-02 / AUD-P1-04 | Lease required on all live executors (Keycloak pattern) | Stale fencing token rejects E2; E5 when containers available |

### Batch D — P1 integration & agent/experience

| Findings | Correction |
|----------|------------|
| AUD-P1-01 | Allowlist JWKS URI host/path to issuer realm |
| AUD-P1-02 | Reject unsigned callbacks (or quarantine non-actionable) |
| AUD-P1-05 | Reorder/bind domains before client redirects assert; never skip |
| AUD-P1-06 | Enum `commandType`; require real signatureRef |
| AUD-P1-07 | `authOk=false` when unbound; approve denied |

### Batch E — Migrations & ops P2

| Findings | Correction |
|----------|------------|
| AUD-P1-03 / AUD-P2-01 | Add `schema_migrations` (+ role grants for 103) via additive fix migrations |
| AUD-P2-02 | Mark local-managed NON_PRODUCTION; persist or disable ACTIVE claims |
| AUD-P2-03 | Remove plaintext env material from default prod wiring |
| AUD-P2-04 | Document/guard P8 intercalation; consider renumber policy going forward |
| AUD-P2-05 | Return step FAILED when required readiness FAILED |

## After remediation

1. Re-run `tsc`, unit, security.  
2. Execute Testcontainers Keycloak + critical E2E-01…25 subset.  
3. Update finding statuses with new SHAs.  
4. Only then may verdict move to **P7 READY FOR FINAL RE-AUDIT** (not ACCEPTED until independent final pass).

## Batch execution log (2026-11-16)

| Batch | Result |
|-------|--------|
| A–D code remediations | Landed (infra/PCI lease+auth, unbound workflow bind, UNBOUND deny, entitlements, cert policy, JWKS origin, callback signature, agent allowlist, experience redirect bind, lease fail-closed) |
| E2 re-verify | `tsc` 0; edge **875/875**; focused **56/56** |
| Finding status | P0/P1 → `REMEDIATED_PENDING_REVERIFY` (not CLOSED) |
| Verdict update | **P7 READY FOR FINAL RE-AUDIT** (`29-final-independent-audit-report.md`) |
| Still required | Full security suite SHA baseline; E3 migrations; E4/E5 live; authorized push |
