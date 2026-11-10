# 12 — P7.1 Implementation Readiness Backlog

| Document ID | P7.0-ACK-DELTA-GOV-12 |
| Note | Preparatory only — **do not execute** |

## P7.1.01–07 (scope unchanged)

| ID | Objective | BC | Exclusions |
|----|-----------|-----|------------|
| P7.1.01 | Authorization aggregate + migration | P7 (+consume P5 schema) | No infra |
| P7.1.02 | Request + history | P7 | No workflow exec |
| P7.1.03 | Feature-flagged port → durable request | P7 | Keep Unavailable default |
| P7.1.04 | Revocation handler fail-closed | P7 | No auto-destroy |
| P7.1.05 | Operator APIs + RBAC | P7 | Cancel ≠ revoke |
| P7.1.06 | FE list/detail display | FE | No fake ACTIVE |
| P7.1.07 | Event name docs / dual-consume policy | Docs + P7 | No silent rename of history |

## P5 shared workstream (required for real G1)

| ID | Responsibility |
|----|----------------|
| P5.AUTH.01 | Issue canonical authorization |
| P5.AUTH.02 | Versioning + reissue |
| P5.AUTH.03 | Revocation events |
| P5.AUTH.04 | Sync status API |
| P5.AUTH.05 | Trust/keys (per OQ-01 accept) |

P7.1.03 depends on P5.AUTH.* for end-to-end; P7 may start domain/store against fixtures/mocks after Gate A if P5 delivery lag is tracked as risk.
