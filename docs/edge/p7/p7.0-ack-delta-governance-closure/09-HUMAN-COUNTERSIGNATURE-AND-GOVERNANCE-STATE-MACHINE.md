# 09 — Human Countersignature and Governance State Machine

| Document ID | P7.0-ACK-DELTA-GOV-09 |
| Current state | **PENDING_HUMAN_COUNTERSIGNATURE** |
| OQ technical content | **CLOSED** (`17`) — does not advance state alone |

## Required roles (no names invented)

1. Product / Platform Owner  
2. Engineering Lead  
3. Security Architect  
4. P5 Domain Owner  
5. P7 Domain Architect  

**Additional for C-10 / data model:** Principal Architect, Database Architect (recommended co-sign on C-10 only).

## Separate approval scopes

| Scope | Document |
|-------|----------|
| Architecture freeze | Parent ACK 15/17 |
| P7.1 Implementation Start (Gate A) | This pack + governance decision record |
| C-09 | c09-approval-record |
| C-10 | c10-approval-record |

One signature may cover multiple scopes **only if** listed explicitly on the form.

## State machine

```text
ARCHITECTURE_ACK_ISSUED
  → PENDING_HUMAN_COUNTERSIGNATURE
  → P7_1_AUTHORIZATION_EFFECTIVE   [Gate A met: sigs + C-09 + C-10 + OQs closed (done via 17)]
  → P7_1_IN_PROGRESS
  → G1_SUBMITTED → G1_ACCEPTED     [Gate B]
  or P7_1_BLOCKED / P7_1_REVOKED
```

Countersignature alone **insufficient** without C-09/C-10 formal acceptance.

Primary instrument: **`18-P7-1-GATE-A-SIGNATURE-AND-AUTHORIZATION-PACK.md`** (signature rows blank; NOT EFFECTIVE).  
Working templates: `contracts/human-countersignature.template.md`, `c09|c10-approval-record.template.md`, `governance-decision-record.template.md`.
