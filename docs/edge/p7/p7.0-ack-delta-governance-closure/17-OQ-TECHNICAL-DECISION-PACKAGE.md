# 17 — OQ Technical Decision Package

| Field | Value |
|-------|-------|
| Document ID | P7.0-ACK-DELTA-GOV-17 |
| Version | 1.0.0 |
| Date | 2026-11-10 |
| Source | Human requestor — technical decisions to close Gate A OQ blockers |
| Authority claimed | Product / governance requestor decision input |
| Fabricated role signatures | **NONE** |
| Gate A effect alone | **Does not emit `P7_1_AUTHORIZATION_EFFECTIVE`** |

---

## Purpose

Record the technical decisions retained to close OQ-01…OQ-06 content blockers identified by Gate A verification.

This package **closes OQ technical content**. It does **not** replace:

- multi-role human countersignatures ;
- C-09 / C-10 formal dossier acceptance ;
- the Gate A governance decision record.

---

## Decisions retained

| OQ | Decision | Classification outcome |
|----|----------|------------------------|
| **OQ-01** | **Option C** — S2S + payload digest + asymmetric signature in production | **ACCEPTED** |
| **OQ-02** | Conditional Product Tenant reuse — **never automatic** | **ACCEPTED** |
| **OQ-03** | Default **one PROD slot** ; additional slots only via **P5 entitlements** | **ACCEPTED** |
| **OQ-04** | Synchronous verification ; **fail-closed** if P5 unavailable ; recommended timeout **2 seconds** | **ACCEPTED** |
| **OQ-05** | Keep temporary **dual-consume** with **explicit mapping** (legacy + canonical) | **ACCEPTED** (non-blocking) |
| **OQ-06** | **Defer after G1** ; transfer not in P7.1 scope unless later re-scoped | **DEFERRED_POST_G1** |

---

## Binding notes for P7.1

1. **OQ-01:** Lab/dev may document residual risk if signature material is unavailable, but any environment issuing real commercial authorizations requires Option C controls before go-live of auth issuance.
2. **OQ-02:** Eligibility for reuse is a P5 commercial/policy signal; P7 must not invent reuse.
3. **OQ-03:** P7.1 must not execute multi-slot provisioning; schema/contracts must not forbid future slots.
4. **OQ-04:** Default on sync timeout or P5 outage during required verify = **DENY** request creation / sensitive start.
5. **OQ-05:** P7.1.07 must implement dual-consume + mapping; legacy `subscription.provisioning.requested.v1` is **not** a full P5 authorization.
6. **OQ-06:** No account/product-tenant ownership transfer flows in P7.1; reopen OQ-06 before any transfer feature.

---

## Residual Gate A requirements after this package

| Item | Status after package |
|------|----------------------|
| OQ-01…04 technical content | Closed (ACCEPTED) |
| OQ-05 transitional policy | Closed (ACCEPTED) |
| OQ-06 Gate A form | Closed via **DEFER_WITH_RATIONALE** |
| Human countersignatures (5 roles) | **Still required** |
| C-09 formal acceptance | **Still required** |
| C-10 formal acceptance | **Still required** |
| `P7_1_AUTHORIZATION_EFFECTIVE` | **Not issued** |
