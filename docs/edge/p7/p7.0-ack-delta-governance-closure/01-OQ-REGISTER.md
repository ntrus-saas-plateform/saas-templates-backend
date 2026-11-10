# 01 — Open Question Register

| Document ID | P7.0-ACK-DELTA-GOV-01 |

**Source of titles:** Parent Delta `15-OPEN-QUESTIONS-AND-EXCEPTIONS.md` — titles preserved exactly for OQ-01…OQ-05.

**Note:** Mission prompt §10 labeled “Account transfer” as OQ-05. That would reassign the ID. Per governance rule, OQ-05 remains event deprecation. Account transfer is registered as **OQ-06** (new, Gate A blocking if ownership transfers are in commercial scope before P7.1).

| OQ ID | Title (exact) | Priority | Classification | Status | Target Gate | Decision Owner |
|-------|---------------|----------|----------------|--------|-------------|----------------|
| OQ-01 | Asymmetric signature mandatory vs digest+S2S only in v1? | P0 | BLOCKING | RECOMMENDATION_ISSUED / PENDING_HUMAN_DECISION | Gate A | Security + P5 + P7 |
| OQ-02 | Default policy: reuse Product Tenant after terminate vs always new? | P0 | BLOCKING | RECOMMENDATION_ISSUED / PENDING_HUMAN_DECISION | Gate A | Product + P5 + P7 |
| OQ-03 | Multi environment_slot per account+product — commercial offer? | P0 | BLOCKING | RECOMMENDATION_ISSUED / PENDING_HUMAN_DECISION | Gate A | Product + P5 + P7 Arch |
| OQ-04 | Sync revoke API path/SLA when P5 down during accept? | P0 | BLOCKING | RECOMMENDATION_ISSUED / PENDING_HUMAN_DECISION | Gate A | P5 + P7 + Security |
| OQ-05 | Timeline for deprecating `subscription.provisioning.requested.v1` | P1 | NON_BLOCKING for Gate A* | RECOMMENDATION_ISSUED / PENDING_HUMAN_DECISION | Gate A (policy) / G1 (mapping) | P5 |
| OQ-06 | Account transfer & Product Tenant ownership (new) | P0 | BLOCKING if transfers before P7.1; else DEFER to post-G1 | RECOMMENDATION_ISSUED / PENDING_HUMAN_DECISION | Gate A or Deferred | P5 + P7 + BB |

\*Gate A may proceed if OQ-05 accepts a transitional dual-consume mapping documented in P7.1.07 / P5.AUTH — full deprecation can be later.

**Final Decision / Accepted:** none — all PENDING_HUMAN_DECISION.
