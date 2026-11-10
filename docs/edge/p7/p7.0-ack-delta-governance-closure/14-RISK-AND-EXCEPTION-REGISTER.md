# 14 — Risk and Exception Register

| Document ID | P7.0-ACK-DELTA-GOV-14 |

| RISK ID | Description | Sev | Owner | Mitigation | Gate | Status |
|---------|-------------|-----|-------|------------|------|--------|
| GOV-R01 | Unauthorized provisioning | P0 | P5/P7 | Auth verify fail-closed | A/B | Open |
| GOV-R02 | Stale authorization | P0 | P7 | expires_at + version | A/B | Open |
| GOV-R03 | Lost revocation event | P0 | P5/P7 | Sync + reconcile | A | Open |
| GOV-R04 | Revocation race | P0 | P7 | OQ-04 policy | A | Open |
| GOV-R05 | Duplicate request | P0 | P7 | D-IDEM-01 | B | Open |
| GOV-R06 | Incorrect tenant reuse | P0 | P5/P7 | OQ-02 | A | Open |
| GOV-R07 | Cross-account ownership | P0 | P5/P7 | OQ-06 | A/Defer | Open |
| GOV-R08 | Product mismatch | P0 | P7 | Integrity rules | B | Open |
| GOV-R09 | Runtime/env confusion | P1 | P7 | OQ-03 | A | Open |
| GOV-R10 | Unauthorized transfer | P0 | P5/P7 | OQ-06 approvals | A/Defer | Open |
| GOV-R11 | P5 unavailable | P0 | P7 | Fail-closed | A | Open |
| GOV-R12 | Key compromise | P0 | Sec/P5 | Rotation | A | Open |
| GOV-R13 | Identity orchestrator reuse | P0 | P7 | C-07 | A/B | Open |
| GOV-R14 | Premature P7.2+ | P0 | Eng | Scope freeze | A | Open |
| GOV-R15 | False ACTIVE UI | P0 | FE | Display rules | B | Open |
| GOV-R16 | Billing/activation confusion | P0 | P5/P6/P7 | ADR-010 | Continuous | Open |

## Exceptions

**None granted.** Template for future: must include ID, scope, reason, risk, compensating control, expiry, approver, review date. No exception may authorize out-of-scope technical ops.
