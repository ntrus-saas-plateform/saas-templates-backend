# 10 — Gate A vs Gate B (Critical Correction)

| Document ID | P7.0-ACK-DELTA-GOV-10 |

## Gate A — P7.1 Implementation Start Authorization

**Purpose:** Authorize coding of P7.1.01–07 only.  
**Timing:** Before implementation.

| Requirement | Need at Gate A |
|-------------|----------------|
| Parent ACK + Delta | Exist |
| Human countersignature | Obtained |
| C-09 / C-10 | **Formal acceptance** |
| Blocking OQs | Accepted (or OQ-06 deferred with rationale) |
| Scope | P7.1.01–07 explicit |
| C-01/C-02/C-03 | **Specification ready** (not full test evidence) |
| C-07 | Boundary accepted |
| C-02/C-03 design | Documented fail-closed / default-off |
| Infra/KC/BB side effects | Forbidden |

Emits: `P7_1_AUTHORIZATION_EFFECTIVE`

## Gate B — G1 Acceptance

**Purpose:** Accept technical delivery of P7.1.  
**Timing:** After implementation.

Requires: C-01/C-02/C-03/C-07 **implementation evidence**, migrations, APIs, RBAC, contract/idempotency/concurrency/recovery/audit tests, zero-side-effects, security review.

Emits: `G1_ACCEPTED` — does **not** authorize P7.2+.

## Comparison

| Aspect | Gate A | Gate B |
|--------|--------|--------|
| Authorize coding | Yes | No |
| Accept impl | No | Yes |
| C-09/C-10 | Accepted | Still valid |
| C-01–C-03 | Spec | Evidence |
| Tests executed | No | Yes |
| Side effects | Forbidden | Forbidden |

**Circular dependency resolved:** Specs before start; proofs after build.
