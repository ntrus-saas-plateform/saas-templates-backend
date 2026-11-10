# 09 — Human Countersignature & Authorization Effectiveness (DELTA-08)

| Document ID | P7.0-ACK-DELTA-09 | Decision | **D-GOV-01** |

## Governance state machine

```text
ARCHITECTURE_ACK_ISSUED
        → PENDING_HUMAN_COUNTERSIGNATURE
        → P7_1_AUTHORIZATION_EFFECTIVE   [all required signatures + P0 C-09/C-10 accepted]
        → P7_1_IN_PROGRESS
        → G1_SUBMITTED → G1_ACCEPTED
   or → P7_1_BLOCKED / P7_1_REVOKED
```

| State | Meaning |
|-------|---------|
| ARCHITECTURE_ACK_ISSUED | Parent ACK + this Delta exist |
| PENDING_HUMAN_COUNTERSIGNATURE | **Current** until sign-off table filled |
| P7_1_AUTHORIZATION_EFFECTIVE | Org may start P7.1.01–07 |
| P7_1_IN_PROGRESS | Implementation underway |
| G1_* | Evidence pack reviewed |
| BLOCKED/REVOKED | Stop implementation |

## Required signatories (roles only — names not invented)

Product/Platform Owner · Engineering Lead · Security Architect · P5 Domain Owner · P7 Domain Architect  

Each: signature, role, date, baseline versions (`1.0.0-freeze` + Delta `1.0.0`), decision, reserves.

## Effectiveness rule

Until signatures + C-09/C-10 accepted:

- Documents may be reviewed  
- Clarification work may continue  
- **P7.1 must not be treated as operationally authorized**  

Parent wording “AUTHORIZED WITH RESTRICTIONS” = **conditional architectural authorization**, not effective org go-ahead.
