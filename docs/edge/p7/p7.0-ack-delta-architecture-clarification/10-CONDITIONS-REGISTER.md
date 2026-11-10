# 10 — Conditions Register C-01…C-10 (DELTA-09)

| Document ID | P7.0-ACK-DELTA-10 | Version | 1.0.0 |

| ID | Object | Pri | Owner | Gate | Status | Closure evidence | Blocks P7.1 start? | Approver |
|----|--------|-----|-------|------|--------|------------------|--------------------|----------|
| C-01 | Full auth model encoded | P0 | P5+P7 | G1 | **OPEN** — contract defined in Delta; not implemented | Schema+migration+tests | Yes (impl) | P5/P7 owners |
| C-02 | Feature flag; Unavailable default | P0 | P7 | P7.1.03 | **OPEN** — design confirmed | Config+tests | Yes (impl) | Eng Lead |
| C-03 | Fail-closed auth/revoke tests | P0 | P5+P7 | G1 | **OPEN** — scenarios listed | Security test report | Yes (impl) | Security |
| C-04 | Live KC verify | P1 | Ops/IAM | Topology prod | **OPEN** UNVERIFIED | serverinfo+API | No for P7.1 | Security |
| C-05 | PCC + mock BB | P1 | P7+BB | Before P7.5 | **OPEN** | Schema+contract CI | No for P7.1 | P7 Arch |
| C-06 | Workflow design/crash matrix | P0 | P7 Arch | Before P7.4 code | **OPEN** | Design pack | No for P7.1 | P7 Arch |
| C-07 | No Identity orchestrator/ERP UI | P0 | P7+FE | Continuous | **OPEN** (policy); evidence via review | Checklist | Yes (policy accept) | Eng Lead |
| C-08 | P6 staging GO | P2 | P6 | Full commercial E2E | **OPEN** | Staging certify | No for P7.1 | Billing |
| **C-09** | Canonical auth+revocation contract | P0 | P5+P7 Arch | Before P7.1 effective | **OPEN** — Delta drafts ready | Accepted contract+schemas+signoff | **Yes** | P5+P7 owners |
| **C-10** | Subscription/Tenant lifecycle integrity | P0 | P5+P7 Arch | Before P7.1 effective | **OPEN** — Delta decision D-CARD-01 | Accepted ERD+rules+signoff | **Yes** | P5+P7 owners |

**None of C-01…C-10 are CLOSED by this Delta** (no false closure). C-09/C-10 content is **specified**; acceptance pending.
