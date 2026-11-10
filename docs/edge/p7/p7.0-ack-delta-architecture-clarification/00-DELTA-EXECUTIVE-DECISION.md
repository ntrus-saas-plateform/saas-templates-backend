# 00 — P7.0 ACK DELTA Executive Decision

| Field | Value |
|-------|-------|
| Document ID | P7.0-ACK-DELTA-00 |
| Version | 1.0.0 |
| Date | 2026-11-10 |
| Parent Freeze | `1.0.0-freeze` |
| **Verdict** | **DELTA ACCEPTED WITH CONDITIONS** |
| Implementation extended? | **NO** |
| P7.1 operationally effective? | **NO** — pending human countersignature + C-09/C-10 acceptance |

---

## Verdict rationale

Architectural ambiguities from the parent ACK are resolved with explicit decisions (cardinality, canonical auth contract, revocation, idempotency, event taxonomy, request≠workflow, governance effectiveness).

**Remaining before operational P7.1 start:**

1. Human countersignatures (`09`)  
2. Formal acceptance of **C-09** (auth/revocation contract) and **C-10** (subscription↔tenant integrity)  
3. C-01/C-02/C-03/C-07 remain open until implemented & evidenced (post this delta — implementation not done here)

This Delta **does not** authorize code, migrations, adapters, or Keycloak/BB calls.

---

## Decisions locked by this Delta

| ID | Decision |
|----|----------|
| D-CARD-01 | Product Tenant is durable per Account+Product; Subscription links via **versioned temporal associations** (not hard permanent 1:1) |
| D-AUTH-01 | P5 owns canonical signed/versioned Authorization; P7 verifies & stores; current port is PARTIALLY_IMPLEMENTED placeholder |
| D-TRUST-01 | Hybrid trust: S2S channel auth + authorization message integrity (digest + key_id; signature preferred) |
| D-REV-01 | Hybrid revocation: reliable revoke events + sync verify before sensitive ops; fail-closed |
| D-IDEM-01 | Uniqueness `(authorization_id, operation, authorization_version)` for active requests |
| D-CANCEL-01 | P7 cancel ≠ P5 revoke ≠ commercial terminate ≠ resource destroy |
| D-EVT-01 | Separate P5 authorization events vs P7 request events vs P6 billing facts |
| D-SEP-01 | Durable Request (P7.1) ≠ Durable Workflow (P7.4) |
| D-GOV-01 | ACK issued ≠ P7.1 authorization effective until countersignature + P0 conditions |

---

## Recommended next step

1. Submit Delta + parent ACK to human approvers.  
2. After signatures + C-09/C-10 accept → P7.1 may become **operationally effective** under existing restricted scope.  
3. Then implement P7.1.01–07 only.
