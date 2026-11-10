# OKAPI EDGE — P7.0 / P7.1 GATE A SIGNATURE & AUTHORIZATION PACK

| Field | Value |
|-------|-------|
| Document ID | **P7.0-ACK-DELTA-GOV-18** |
| Version | 1.0.0 |
| Date | 2026-11-10 |
| Baseline | ACK `1.0.0-freeze` + Architecture Delta `1.0.0` + Governance Closure `1.0.0` |
| Gate | P7.1 Gate A — Implementation Start |
| **Status** | **PENDING HUMAN APPROVAL — NOT EFFECTIVE** |
| Scope | OQ-01..OQ-06 decisions, C-09/C-10 acceptance, mandatory countersignatures, Gate A decision |
| Related | `17-OQ-TECHNICAL-DECISION-PACKAGE.md` · C-09/C-10 dossiers · `contracts/*` |
| Application code authorized | **NO** |

---

## 1. Accepted technical decisions

These decisions are recorded as the accepted technical direction. They do **not** replace formal C-09/C-10 acceptance or human countersignatures.

| OQ | Status | Binding decision |
|----|--------|------------------|
| OQ-01 | **ACCEPTED** | Option C: authenticated service-to-service communication + canonical payload digest + asymmetric signature verification. Reject invalid signatures, digest mismatches, unknown keys, wrong issuer/audience, expired or revoked authorizations. Support key IDs and controlled key rotation. |
| OQ-02 | **ACCEPTED** | Product Tenant reuse after termination is conditional and never automatic. Require explicit eligibility checks, same Account+Product ownership, clean lifecycle state, no unresolved data/security/legal hold, and auditable approval. Otherwise create a new Product Tenant. |
| OQ-03 | **ACCEPTED** | One PROD slot by default. Additional environment slots require explicit P5 entitlements and validated slot identity. Non-production slots must never be confused with production tenants. |
| OQ-04 | **ACCEPTED** | Synchronous P5 authorization/revocation verification before accepting a new provisioning request; 2-second timeout; fail-closed on timeout, P5 unavailability, or inability to establish current authorization. Events accelerate propagation but do not replace synchronous verification. |
| OQ-05 | **ACCEPTED** | Temporary dual-consume with explicit mapping for the canonical event and legacy `subscription.provisioning.requested.v1`. Deduplicate by stable event/authorization identity. Never interpret a legacy event as authorization without canonical verification. |
| OQ-06 | **DEFERRED_POST_G1** | Account transfer and Product Tenant ownership transfer are excluded from P7.1. No implicit transfer semantics may be introduced. A separate post-G1 decision is required before implementation. |

Canonical detail also recorded in `17-OQ-TECHNICAL-DECISION-PACKAGE.md`.

---

## 2. Cross-cutting invariants

1. P5 is the sole owner and issuer of canonical provisioning authorization and revocation state.
2. P7 verifies authorization integrity and current validity; it does not create commercial eligibility.
3. P6 payment/billing facts never directly authorize provisioning or tenant activation.
4. Product Tenant identity is durable at Account+Product scope; subscription association is temporal and versioned, not a permanent one-to-one identity assumption.
5. P7 request cancellation is not P5 authorization revocation.
6. A durable provisioning request is not the P7.4 durable workflow.
7. No infrastructure, database, Business Backend, or Keycloak resource-creation side effect is allowed in P7.1.
8. P7 adapter remains feature-flagged and default-off; `Unavailable` remains the safe default until readiness and authorization are established.
9. OQ-06 remains deferred and outside P7.1.

---

## 3. C-09 — Canonical Authorization and Revocation Contract

**Required approver roles:**

- P5 Domain Owner
- P7 Domain Architect
- Security Architect
- Engineering Lead

**Acceptance scope** includes the canonical authorization contract and schema, Option C trust model, revocation contract, event taxonomy, synchronous status verification, P5/P7 RACI, fail-closed behavior, idempotency, and compatibility/deprecation mapping.

**References:** `07-C09-FORMAL-ACCEPTANCE-DOSSIER.md` · `contracts/c09-acceptance-checklist.md` · `contracts/c09-approval-record.template.md`

### C-09 approval records

| Approver role | Approver identity | Decision | Signed at | Signature/evidence reference |
|---------------|-------------------|----------|-----------|------------------------------|
| P5 Domain Owner | TO BE COMPLETED BY SIGNER | PENDING | PENDING | PENDING |
| P7 Domain Architect | TO BE COMPLETED BY SIGNER | PENDING | PENDING | PENDING |
| Security Architect | TO BE COMPLETED BY SIGNER | PENDING | PENDING | PENDING |
| Engineering Lead | TO BE COMPLETED BY SIGNER | PENDING | PENDING | PENDING |

**Decision values:** `APPROVED`, `APPROVED_WITH_RESERVATIONS`, or `REJECTED`. Reservations must be explicit and assessed for Gate A impact.

---

## 4. C-10 — Product Tenant / Subscription Lifecycle Integrity

**Required approver roles:**

- P5 Domain Owner
- P7 Domain Architect
- Product / Platform Owner
- Principal Architect
- Database Architect

**Acceptance scope** includes D-CARD-01, temporal SubscriptionTenantAssociation, lifecycle transition matrix, conditional tenant reuse, one default PROD slot plus P5-entitled extras, OQ-06 deferral, integrity/concurrency rules, and ERD/data dictionary.

**References:** `08-C10-FORMAL-ACCEPTANCE-DOSSIER.md` · `contracts/c10-acceptance-checklist.md` · `contracts/c10-approval-record.template.md`

### C-10 approval records

| Approver role | Approver identity | Decision | Signed at | Signature/evidence reference |
|---------------|-------------------|----------|-----------|------------------------------|
| P5 Domain Owner | TO BE COMPLETED BY SIGNER | PENDING | PENDING | PENDING |
| P7 Domain Architect | TO BE COMPLETED BY SIGNER | PENDING | PENDING | PENDING |
| Product / Platform Owner | TO BE COMPLETED BY SIGNER | PENDING | PENDING | PENDING |
| Principal Architect | TO BE COMPLETED BY SIGNER | PENDING | PENDING | PENDING |
| Database Architect | TO BE COMPLETED BY SIGNER | PENDING | PENDING | PENDING |

---

## 5. Five mandatory Gate A countersignatures

Each role must explicitly approve the scope **Gate A / P7.1 implementation start**. A signature may cover C-09, C-10, or architecture freeze only if each additional scope is explicitly listed in the signed record.

**Template:** `contracts/human-countersignature.template.md`

| Required role | Identity | Decision | Signed at | Signature/evidence reference |
|---------------|----------|----------|-----------|------------------------------|
| Product / Platform Owner | TO BE COMPLETED BY SIGNER | PENDING | PENDING | PENDING |
| Engineering Lead | TO BE COMPLETED BY SIGNER | PENDING | PENDING | PENDING |
| Security Architect | TO BE COMPLETED BY SIGNER | PENDING | PENDING | PENDING |
| P5 Domain Owner | TO BE COMPLETED BY SIGNER | PENDING | PENDING | PENDING |
| P7 Domain Architect | TO BE COMPLETED BY SIGNER | PENDING | PENDING | PENDING |

---

## 6. Exact implementation scope authorized after Gate A

Once and only once Gate A is effective, the authorized implementation scope is **P7.1.01–P7.1.07**:

1. **P7.1.01** — ProvisioningAuthorization domain and migration.
2. **P7.1.02** — ProvisioningRequest and immutable request history.
3. **P7.1.03** — Feature-flagged P5 provisioning coordination adapter; `Unavailable` default retained.
4. **P7.1.04** — Revocation handler and fail-closed new-request guard.
5. **P7.1.05** — Operator APIs: list, get, history, cancel, with RBAC and audit.
6. **P7.1.06** — Edge Console provisioning requests list/detail, display-only; no fabricated ACTIVE state.
7. **P7.1.07** — Event-name and legacy dual-consume mapping documentation.

**Explicitly excluded:** P7.2 runtime registry, P7.3 placement, P7.4 workflow-engine code, P7.5 live Business Backend calls, P7.6 infrastructure provisioning, P7.7 Keycloak resource creation, and P7.8–P7.15.

---

## 7. Gate A prerequisite checklist

| Requirement | Evidence required | Status |
|-------------|-------------------|--------|
| Parent ACK and Delta baseline | Existing issued baseline artifacts | **PRESENT** — verify references |
| OQ-01..05 accepted; OQ-06 deferred | Accepted OQ decision package (`17` + §1) | **RECORDED** |
| C-09 formally accepted | Signed C-09 records from all required approvers | **PENDING** |
| C-10 formally accepted | Signed C-10 records from all required approvers | **PENDING** |
| Five mandatory countersignatures | Completed signature records with identity, timestamp, scope, and evidence reference | **PENDING** |
| C-01/C-02/C-03/C-07 specification readiness and boundary | Reviewed specification references and explicit acceptance | **PENDING VERIFICATION** |
| Gate A decision record approved | Completed governance decision record (§8) | **PENDING** |
| `P7_1_AUTHORIZATION_EFFECTIVE` issued | Decision/evidence reference from authorized governance chair or recorder | **NOT ISSUED** |

C-04 / C-05 / C-06 / C-08 remain future-gate conditions and are **not** Gate A blockers under the current Gate A definition.

---

## 8. Final Gate A decision record

Complete only after every mandatory prerequisite above has been verified.

| Field | Value |
|-------|-------|
| decision_id | TO BE ISSUED |
| decision | `P7_1_AUTHORIZATION_EFFECTIVE` / `REJECTED` / `DEFERRED` |
| decision_date | TO BE COMPLETED |
| authorized chair / recorder | TO BE COMPLETED |
| C-09 approval references | TO BE COMPLETED |
| C-10 approval references | TO BE COMPLETED |
| five countersignature references | TO BE COMPLETED |
| C-01/C-02/C-03/C-07 specification evidence | TO BE COMPLETED |
| scope authorized | P7.1.01–P7.1.07 only |
| reservations / exceptions | TO BE COMPLETED |

Only the authorized governance chair/recorder may issue the effective state after validating all signatures and evidence. **The implementation agent must not self-issue it.**

Working copy template also at: `contracts/governance-decision-record.template.md`.

---

## 9. Execution sequence

1. Circulate this packet and the referenced C-09/C-10 dossiers to the named role holders.
2. Obtain signed C-09 and C-10 approval records.
3. Obtain the five mandatory countersignatures, explicitly covering Gate A / P7.1 start.
4. Complete the Gate A decision record (§8) and have the authorized chair/recorder issue `P7_1_AUTHORIZATION_EFFECTIVE`.
5. Re-run Gate A verification against the signed, committed evidence (`../P7.1-GATE-A-PREIMPLEMENTATION-VERIFICATION.md`).
6. Begin P7.1.01–P7.1.07 immediately after verification confirms Gate A effective.

---

## 10. Explicit non-authorization

This packet is a **prepared approval instrument**, not an approval. Blank identity/signature fields are intentional and must be completed by the actual role holders.

No signature, countersignature, C-09/C-10 acceptance, or `P7_1_AUTHORIZATION_EFFECTIVE` is fabricated or implied by this document.

Until the effective state is issued, **no** P7.1 code changes, migrations, feature-flag activation, tenant creation, infrastructure changes, Business Backend calls, or Keycloak resource creation are authorized.
