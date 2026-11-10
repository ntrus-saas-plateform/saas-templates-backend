# 01 — Open Question Register

| Document ID | P7.0-ACK-DELTA-GOV-01 |
| Last update | 2026-11-10 — technical decision package `17-OQ-TECHNICAL-DECISION-PACKAGE.md` |

**Source of titles:** Parent Delta `15-OPEN-QUESTIONS-AND-EXCEPTIONS.md` — titles preserved exactly for OQ-01…OQ-05.

**Note:** Mission prompt §10 labeled “Account transfer” as OQ-05. That would reassign the ID. Per governance rule, OQ-05 remains event deprecation. Account transfer is registered as **OQ-06** (new).

| OQ ID | Title (exact) | Priority | Classification | Status | Target Gate | Decision Owner |
|-------|---------------|----------|----------------|--------|-------------|----------------|
| OQ-01 | Asymmetric signature mandatory vs digest+S2S only in v1? | P0 | BLOCKING | **ACCEPTED** (Option C) | Gate A | Security + P5 + P7 |
| OQ-02 | Default policy: reuse Product Tenant after terminate vs always new? | P0 | BLOCKING | **ACCEPTED** (conditional reuse) | Gate A | Product + P5 + P7 |
| OQ-03 | Multi environment_slot per account+product — commercial offer? | P0 | BLOCKING | **ACCEPTED** (1 PROD + entitlement extras) | Gate A | Product + P5 + P7 Arch |
| OQ-04 | Sync revoke API path/SLA when P5 down during accept? | P0 | BLOCKING | **ACCEPTED** (sync + fail-closed + 2s) | Gate A | P5 + P7 + Security |
| OQ-05 | Timeline for deprecating `subscription.provisioning.requested.v1` | P1 | NON_BLOCKING for Gate A* | **ACCEPTED** (dual-consume + mapping) | Gate A (policy) / G1 (mapping) | P5 |
| OQ-06 | Account transfer & Product Tenant ownership (new) | P0 | Deferred | **DEFERRED_POST_G1** | Post-G1 | P5 + P7 + BB |

\*Gate A may proceed on OQ-05 with transitional dual-consume mapping documented in P7.1.07 / P5.AUTH — full deprecation later.

**Provenance:** Human requestor technical decision package 2026-11-10 (`17-OQ-TECHNICAL-DECISION-PACKAGE.md`). Does **not** substitute multi-role Gate A countersignatures or C-09/C-10 dossier signatures.
